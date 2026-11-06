namespace Hrms.Application.Common;

/// <summary>Base type for expected, mapped-to-HTTP application failures.</summary>
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message) { }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message) { }

    public static NotFoundException For(string entity, object id) => new($"{entity} '{id}' was not found.");
}

public sealed class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Invalid credentials.") : base(message) { }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message = "You do not have permission to perform this action.") : base(message) { }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message) : base(message) { }
}

public sealed class BadRequestException : AppException
{
    public BadRequestException(string message) : base(message) { }
}

/// <summary>Field-level validation failure (returned as a 400 validation problem).</summary>
public sealed class ValidationException : AppException
{
    public ValidationException(string message) : base(message)
    {
        Errors = new Dictionary<string, string[]> { ["general"] = new[] { message } };
    }

    public ValidationException(IReadOnlyDictionary<string, string[]> errors) : base("One or more validation errors occurred.")
    {
        Errors = errors;
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
