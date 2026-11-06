using Hrms.Application.DTOs;

namespace Hrms.Application.Abstractions.Services;

/// <summary>Super Admin operations over the company registry (metadata only).</summary>
public interface ICompanyManagementService
{
    Task<IReadOnlyList<CompanyListItemDto>> ListAsync(string? search, CancellationToken ct = default);

    Task<CompanyDetailDto> GetAsync(Guid id, CancellationToken ct = default);

    Task<CompanyProvisioningResultDto> CreateAsync(CreateCompanyRequest request, CancellationToken ct = default);

    Task<CompanyDetailDto> UpdateAsync(Guid id, UpdateCompanyRequest request, CancellationToken ct = default);

    Task<CompanyDetailDto> ActivateAsync(Guid id, CancellationToken ct = default);

    Task<CompanyDetailDto> SuspendAsync(Guid id, CancellationToken ct = default);

    Task<CompanyProvisioningResultDto> RetryProvisioningAsync(Guid id, CancellationToken ct = default);

    Task<ResendInvitationResponse> ResendInvitationAsync(Guid id, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Validates and consumes company admin account-activation invitations.</summary>
public interface IAccountActivationService
{
    Task<ActivationInfoResponse> ValidateAsync(string token, CancellationToken ct = default);

    Task<LoginResponse> ActivateAsync(ActivateAccountRequest request, CancellationToken ct = default);
}
