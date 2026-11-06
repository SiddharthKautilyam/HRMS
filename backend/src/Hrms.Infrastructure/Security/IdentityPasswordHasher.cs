using Hrms.Application.Abstractions.Security;
using Hrms.Domain.Entities;
using IdentityHasher = Microsoft.AspNetCore.Identity.PasswordHasher<Hrms.Domain.Entities.User>;

namespace Hrms.Infrastructure.Security;

/// <summary>
/// Wraps ASP.NET Core Identity's PBKDF2 password hasher so the application layer
/// never depends on the Identity package directly.
/// </summary>
public sealed class IdentityPasswordHasher : IPasswordHasher
{
    private readonly IdentityHasher _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(new User(), password);

    public bool Verify(string password, string hash) =>
        _hasher.VerifyHashedPassword(new User(), hash, password) != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed;
}
