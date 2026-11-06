using Microsoft.OpenApi;

namespace Hrms.Api.Configuration;

/// <summary>Swagger/OpenAPI setup with a Bearer security scheme for manual testing.</summary>
public static class SwaggerConfiguration
{
    public static IServiceCollection AddHrmsSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();

        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "HRMS API",
                Version = "v1",
                Description = "HRMS backend — authentication, employees, leave, attendance, payroll, loans, documents, approvals, organisation setup and dashboards.",
            });

            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Paste the JWT access token returned by POST /api/auth/login. Swagger adds the 'Bearer ' prefix automatically.",
            });

            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>(),
            });
        });

        return services;
    }

    public static WebApplication UseHrmsSwagger(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = "swagger";
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "HRMS API v1");
            options.DocumentTitle = "HRMS API";
            options.DisplayRequestDuration();
            options.EnablePersistAuthorization();
            options.DefaultModelsExpandDepth(-1);
        });

        return app;
    }
}
