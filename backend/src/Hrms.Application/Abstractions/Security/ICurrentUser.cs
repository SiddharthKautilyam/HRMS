namespace Hrms.Application.Abstractions.Security;

/// <summary>Ambient information about the caller, populated from the JWT in the API layer.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    Guid? UserId { get; }

    string? Email { get; }

    string? Role { get; }

    Guid? EmployeeId { get; }

    /// <summary>The company (tenant) the caller belongs to, from the validated token.</summary>
    Guid? CompanyId { get; }

    bool IsInRole(string role);
}
