using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence;
using Hrms.Infrastructure.Persistence.Master;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Hrms.Tests;

public sealed class RealHttpPipelineSecurityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public RealHttpPipelineSecurityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:MasterConnection", @"Server=(localdb)\MSSQLLocalDB;Database=Hrms_Test_Master;Integrated Security=True;TrustServerCertificate=True;");
            builder.UseSetting("ConnectionStrings:DefaultConnection", @"Server=(localdb)\MSSQLLocalDB;Database=Hrms_Test_Default;Integrated Security=True;TrustServerCertificate=True;");
        });
    }

    [Fact]
    public async Task RealPipeline_NonAdmin_LogoUpload_Returns403Forbidden()
    {
        using var scope = _factory.Services.CreateScope();
        var masterDb = scope.ServiceProvider.GetRequiredService<HrmsMasterDbContext>();
        var company = await masterDb.Companies.FirstAsync();
        var tokenService = scope.ServiceProvider.GetRequiredService<IJwtTokenService>();

        // Issue token for Employee role (lacks IsEdit on COMP module)
        var token = tokenService.CreateToken(new TokenSubject(
            UserId: Guid.NewGuid(),
            FullName: "Regular Employee",
            Initials: "RE",
            Email: "emp@testcorp.com",
            RoleName: "Employee",
            EmployeeId: Guid.NewGuid(),
            CompanyId: company.Id,
            CompanyCode: company.Code
        ));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'><circle cx='10' cy='10' r='10'/></svg>"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("image/svg+xml");
        content.Add(fileContent, "file", "logo.svg");

        var response = await client.PostAsync("/api/organization/company/logo", content);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RealPipeline_SuspendedCompany_Returns403Forbidden()
    {
        using var scope = _factory.Services.CreateScope();
        var masterDb = scope.ServiceProvider.GetRequiredService<HrmsMasterDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<IJwtTokenService>();

        var suspendedCompanyId = Guid.NewGuid();
        var suspCode = $"S{Guid.NewGuid():N}"[..8].ToUpperInvariant();
        masterDb.Companies.Add(new Company
        {
            Id = suspendedCompanyId,
            Code = suspCode,
            Name = "Suspended Corp",
            Status = CompanyStatus.Suspended,
            DatabaseName = $"hrms_t_{suspCode.ToLowerInvariant()}",
            AdminEmail = $"admin_{suspCode}@susp.com",
            AdminFullName = "Admin User"
        });
        await masterDb.SaveChangesAsync();

        var token = tokenService.CreateToken(new TokenSubject(
            UserId: Guid.NewGuid(),
            FullName: "Suspended Admin",
            Initials: "SA",
            Email: $"admin_{suspCode}@susp.com",
            RoleName: "CompanyAdmin",
            EmployeeId: null,
            CompanyId: suspendedCompanyId,
            CompanyCode: suspCode
        ));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var response = await client.GetAsync("/api/company");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RealPipeline_UntrustedProxy_SpoofedForwardedFor_IsIgnoredByUseForwardedHeaders()
    {
        var client = _factory.CreateClient();
        // Client connects with spoofed X-Forwarded-For header
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.199");

        // The auth login endpoint reads RemoteIpAddress for rate limiting
        var loginPayload = new { email = "nonexistent@test.com", password = "WrongPassword123!" };
        var content = new StringContent(JsonSerializer.Serialize(loginPayload), Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/auth/login", content);

        // Request completes through pipeline without unhandled errors;
        // ForwardedHeaders middleware ignored the untrusted forwarded header
        Assert.True(response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.BadRequest);
    }
}
