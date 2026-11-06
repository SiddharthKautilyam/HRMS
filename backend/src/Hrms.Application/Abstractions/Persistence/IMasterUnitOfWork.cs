using Hrms.Domain.Entities;

namespace Hrms.Application.Abstractions.Persistence;

/// <summary>Unit of work for the master (registry) database.</summary>
public interface IMasterUnitOfWork
{
    ICompanyRepository Companies { get; }

    ICompanyInvitationRepository Invitations { get; }

    IRepository<ProvisioningLog> ProvisioningLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface ICompanyRepository : IRepository<Company>
{
    Task<Company?> GetByCodeAsync(string code, CancellationToken ct = default);

    Task<Company?> GetByDatabaseNameAsync(string databaseName, CancellationToken ct = default);

    Task<Company?> GetDefaultAsync(CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<IReadOnlyList<Company>> ListAsync(string? search, CancellationToken ct = default);
}

public interface ICompanyInvitationRepository : IRepository<CompanyInvitation>
{
    Task<CompanyInvitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    /// <summary>The latest invitation that has not yet been accepted (reused by retries).</summary>
    Task<CompanyInvitation?> GetOpenForCompanyAsync(Guid companyId, CancellationToken ct = default);

    Task<CompanyInvitation?> GetLatestForCompanyAsync(Guid companyId, CancellationToken ct = default);
}
