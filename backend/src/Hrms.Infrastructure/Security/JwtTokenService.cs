using System.Security.Claims;
using System.Text;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Common;
using Hrms.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Hrms.Infrastructure.Security;

/// <summary>Issues HS256 JWT access tokens containing the user id, role, employee id and company.</summary>
public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public AuthToken CreateToken(User user, string roleName, Guid? companyId = null, string? companyCode = null) =>
        CreateToken(new TokenSubject(
            user.Id,
            user.FullName,
            user.Initials,
            user.Email,
            roleName,
            user.EmployeeId,
            companyId,
            companyCode));

    public AuthToken CreateToken(TokenSubject subject)
    {
        if (string.IsNullOrWhiteSpace(_options.Key))
        {
            throw new InvalidOperationException("JWT signing key is not configured (Jwt:Key).");
        }

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subject.UserId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, subject.UserId.ToString()),
            new(ClaimTypes.Name, subject.FullName),
            new(ClaimTypes.Email, subject.Email),
            new(ClaimTypes.Role, subject.RoleName),
            new("initials", subject.Initials),
        };

        if (subject.EmployeeId is { } employeeId)
        {
            claims.Add(new Claim("employeeId", employeeId.ToString()));
        }

        if (subject.CompanyId is { } companyId)
        {
            claims.Add(new Claim("companyId", companyId.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(subject.CompanyCode))
        {
            claims.Add(new Claim("companyCode", subject.CompanyCode));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expires,
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            SigningCredentials = credentials,
        };

        var handler = new JsonWebTokenHandler();
        var token = handler.CreateToken(descriptor);

        return new AuthToken(token, expires);
    }
}
