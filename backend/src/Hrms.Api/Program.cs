using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Claims;
using Hrms.Api.Configuration;
using Hrms.Api.Middleware;
using Hrms.Api.Services;
using Hrms.Api.Startup;
using Hrms.Api.Workers;
using Hrms.Application;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Common;
using Hrms.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

// Ensure wwwroot exists before WebApplication.CreateBuilder initializes StaticWebAssets
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads"));

var builder = WebApplication.CreateBuilder(args);

// ── Controllers / JSON ──
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<Hrms.Api.Security.PermissionAuthorizationFilter>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    // KnownProxies and KnownIPNetworks default to loopback (127.0.0.1 and ::1).
    // Read additional trusted proxy IPs or CIDR networks from configuration if provided:
    var proxyIps = builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? Array.Empty<string>();
    foreach (var ipStr in proxyIps)
    {
        if (System.Net.IPAddress.TryParse(ipStr, out var ip))
        {
            options.KnownProxies.Add(ip);
        }
    }

    var networkCidrs = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? Array.Empty<string>();
    foreach (var cidr in networkCidrs)
    {
        if (System.Net.IPNetwork.TryParse(cidr, out var network))
        {
            options.KnownIPNetworks.Add(network);
        }
    }
});


// ── Layers ──
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ── Current user ──
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// ── Authentication / authorisation ──
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                 ?? throw new InvalidOperationException("The 'Jwt' configuration section is missing.");

if (string.IsNullOrWhiteSpace(jwtOptions.Key) || jwtOptions.Key.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key must be configured with at least 32 characters.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role,
        };
    });

builder.Services.AddAuthorization(options =>
{
    // HrAdmin policy: Super Admin, Company Admin, HR Manager, or dynamic custom roles (PermissionAuthorizationFilter enforces granular rights)
    options.AddPolicy("HrAdmin", policy => policy.RequireAssertion(ctx =>
    {
        var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
        if (string.IsNullOrWhiteSpace(role)) return false;
        if (role.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("Company Admin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("HR Manager", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("HrManager", StringComparison.OrdinalIgnoreCase))
            return true;

        // Custom roles: allowed past basic policy check; PermissionAuthorizationFilter validates granular module permissions
        return !role.Equals("Employee", StringComparison.OrdinalIgnoreCase);
    }));

    options.AddPolicy("ManagerOrAbove", policy => policy.RequireAssertion(ctx =>
    {
        var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
        if (string.IsNullOrWhiteSpace(role)) return false;
        return !role.Equals("Employee", StringComparison.OrdinalIgnoreCase);
    }));

    // Platform-level: only the Super Admin may manage companies.
    options.AddPolicy("SuperAdminOnly", policy => policy.RequireRole("Super Admin", "SuperAdmin"));
});

// ── Response Compression ──
builder.Services.AddResponseCompression();

// ── CORS (Angular dev server) ──
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:4200" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("Angular", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// ── Background Workers ──
builder.Services.AddHostedService<DailyAttendanceCloseoutWorker>();

// ── OpenAPI / Swagger ──
builder.Services.AddHrmsSwagger();

var app = builder.Build();

if (app.Environment.IsProduction())
{
    var proxyIps = builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? Array.Empty<string>();
    var networkCidrs = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? Array.Empty<string>();
    if (proxyIps.Length == 0 && networkCidrs.Length == 0)
    {
        var secLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Security");
        secLogger.LogWarning("[SECURITY WARNING] Running in Production environment with no trusted reverse proxies configured in ForwardedHeaders:KnownProxies or ForwardedHeaders:KnownNetworks. Forwarded headers (X-Forwarded-For, X-Forwarded-Proto) from upstream reverse proxies (e.g. NGINX, Cloudflare, ALB) will be untrusted, and client RemoteIpAddress will reflect the load balancer instead of the real client IP.");
    }
}

if (args.Length > 0 && args[0].Equals("seed-admin", StringComparison.OrdinalIgnoreCase))
{
    var exitCode = await SeedAdminCli.ExecuteAsync(args, app.Services);
    Environment.Exit(exitCode);
    return;
}

// ── Databases: migrate the master registry, register the default company, seed the default tenant ──
await DatabaseBootstrap.InitializeAsync(app.Services, builder.Configuration);

// ── Pipeline ──
// ForwardedHeaders MUST execute first so subsequent middleware and logging see the true RemoteIpAddress
app.UseForwardedHeaders();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseResponseCompression();
app.UseCors("Angular");

var webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
Directory.CreateDirectory(Path.Combine(webRoot, "uploads"));

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot),
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (ctx.File.Name.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers["Content-Security-Policy"] = "sandbox";
        }
    }
});

app.UseAuthentication();

// Resolves the tenant database from the validated company claim before any query runs.
app.UseMiddleware<TenantResolutionMiddleware>();

app.UseAuthorization();

// Swagger UI is enabled in every environment so the API can be exercised by hand.
app.UseHrmsSwagger();

app.MapControllers();

app.MapGet("/", () => Results.Redirect("/swagger"))
    .ExcludeFromDescription();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "HRMS API", timestamp = DateTime.UtcNow }))
    .WithTags("System");

app.Run();

public partial class Program { }
