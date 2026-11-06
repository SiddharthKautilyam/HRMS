using Hrms.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Middleware;

/// <summary>Maps application exceptions to RFC 7807 problem responses.</summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IWebHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception exception)
        {
            await HandleAsync(context, exception);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception exception)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            _logger.LogDebug("Request cancelled by client for {Method} {Path}", context.Request.Method, context.Request.Path);
            return;
        }

        var (status, title, errors) = exception switch
        {
            ValidationException validation => (StatusCodes.Status400BadRequest, validation.Message, validation.Errors),
            BadRequestException badRequest => (StatusCodes.Status400BadRequest, badRequest.Message, null),
            NotFoundException notFound => (StatusCodes.Status404NotFound, notFound.Message, null),
            UnauthorizedException unauthorized => (StatusCodes.Status401Unauthorized, unauthorized.Message, null),
            ForbiddenException forbidden => (StatusCodes.Status403Forbidden, forbidden.Message, null),
            ConflictException conflict => (StatusCodes.Status409Conflict, conflict.Message, null),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null),
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
        }

        if (context.Response.HasStarted)
        {
            return;
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = $"https://httpstatuses.io/{status}",
            Instance = context.Request.Path,
        };

        if (errors is { Count: > 0 })
        {
            problem.Extensions["errors"] = errors;
        }

        if (status == StatusCodes.Status500InternalServerError && _environment.IsDevelopment())
        {
            problem.Detail = exception.ToString();
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problem);
    }
}
