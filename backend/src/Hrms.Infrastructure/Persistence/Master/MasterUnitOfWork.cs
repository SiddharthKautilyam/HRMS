using Hrms.Application.Abstractions.Persistence;
using Hrms.Domain.Common;
using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence.Master;

/// <summary>Generic repository over the master database context.</summary>
public class MasterRepository<TEntity> : IRepository<TEntity> where TEntity : BaseEntity
{
    protected readonly HrmsMasterDbContext Db;
    protected readonly DbSet<TEntity> Set;

    public MasterRepository(HrmsMasterDbContext db)
    {
        Db = db;
        Set = db.Set<TEntity>();
    }

    public IQueryable<TEntity> Query() => Set.AsNoTracking();

    public async Task<TEntity?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await Set.FindAsync(new object?[] { id }, ct);

    public async Task<IReadOnlyList<TEntity>> ListAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking().ToListAsync(ct);

    public async Task AddAsync(TEntity entity, CancellationToken ct = default) =>
        await Set.AddAsync(entity, ct);

    public async Task AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken ct = default) =>
        await Set.AddRangeAsync(entities, ct);

    public void Update(TEntity entity) => Set.Update(entity);

    public void Remove(TEntity entity) => Set.Remove(entity);

    public void RemoveRange(IEnumerable<TEntity> entities) => Set.RemoveRange(entities);

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default) =>
        await Set.AnyAsync(e => e.Id == id, ct);

    public async Task<int> CountAsync(CancellationToken ct = default) => await Set.CountAsync(ct);

    public async Task<IReadOnlyList<TResult>> ToListAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default) =>
        await query.ToListAsync(ct);

    public async Task<TResult?> FirstOrDefaultAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default) =>
        await query.FirstOrDefaultAsync(ct);

    public async Task<bool> AnyAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default) =>
        await query.AnyAsync(ct);

    public async Task<int> CountQueryAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default) =>
        await query.CountAsync(ct);

    public async Task<decimal> SumDecimalAsync(IQueryable<decimal?> query, CancellationToken ct = default) =>
        await query.SumAsync(ct) ?? 0m;
}

public sealed class CompanyRepository : MasterRepository<Company>, ICompanyRepository
{
    public CompanyRepository(HrmsMasterDbContext db) : base(db)
    {
    }

    public async Task<Company?> GetByCodeAsync(string code, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(c => c.Code == code, ct);

    public async Task<Company?> GetByDatabaseNameAsync(string databaseName, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(c => c.DatabaseName == databaseName, ct);

    public async Task<Company?> GetDefaultAsync(CancellationToken ct = default) =>
        await Set.Where(c => c.IsDefault).OrderBy(c => c.CreatedAtUtc).FirstOrDefaultAsync(ct);

    public async Task<bool> CodeExistsAsync(string code, CancellationToken ct = default) =>
        await Set.AnyAsync(c => c.Code == code, ct);

    public async Task<IReadOnlyList<Company>> ListAsync(string? search, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => c.Name.Contains(term) || c.Code.Contains(term) || c.AdminEmail.Contains(term));
        }

        return await query.OrderBy(c => c.Name).ToListAsync(ct);
    }
}

public sealed class CompanyInvitationRepository : MasterRepository<CompanyInvitation>, ICompanyInvitationRepository
{
    public CompanyInvitationRepository(HrmsMasterDbContext db) : base(db)
    {
    }

    public async Task<CompanyInvitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(i => i.TokenHash == tokenHash, ct);

    public async Task<CompanyInvitation?> GetOpenForCompanyAsync(Guid companyId, CancellationToken ct = default) =>
        await Set
            .Where(i => i.CompanyId == companyId && i.Status != Domain.Enums.InvitationStatus.Accepted)
            .OrderByDescending(i => i.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

    public async Task<CompanyInvitation?> GetLatestForCompanyAsync(Guid companyId, CancellationToken ct = default) =>
        await Set
            .Where(i => i.CompanyId == companyId)
            .OrderByDescending(i => i.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
}

/// <summary>Owns the master-database repositories for one request and the single save point.</summary>
public sealed class MasterUnitOfWork : IMasterUnitOfWork
{
    private readonly HrmsMasterDbContext _db;

    private ICompanyRepository? _companies;
    private ICompanyInvitationRepository? _invitations;
    private IRepository<ProvisioningLog>? _provisioningLogs;

    public MasterUnitOfWork(HrmsMasterDbContext db)
    {
        _db = db;
    }

    public ICompanyRepository Companies => _companies ??= new CompanyRepository(_db);

    public ICompanyInvitationRepository Invitations => _invitations ??= new CompanyInvitationRepository(_db);

    public IRepository<ProvisioningLog> ProvisioningLogs =>
        _provisioningLogs ??= new MasterRepository<ProvisioningLog>(_db);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
