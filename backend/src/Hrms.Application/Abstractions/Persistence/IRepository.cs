using Hrms.Domain.Common;

namespace Hrms.Application.Abstractions.Persistence;

/// <summary>
/// Generic repository abstraction over an aggregate. Write operations are staged
/// and flushed by <see cref="IUnitOfWork.SaveChangesAsync"/> so a single request
/// is one transaction.
/// </summary>
public interface IRepository<TEntity> where TEntity : BaseEntity
{
    /// <summary>Composable read query (no tracking) for projections and paging.</summary>
    IQueryable<TEntity> Query();

    Task<TEntity?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<TEntity>> ListAsync(CancellationToken ct = default);

    Task AddAsync(TEntity entity, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken ct = default);

    void Update(TEntity entity);

    void Remove(TEntity entity);

    void RemoveRange(IEnumerable<TEntity> entities);

    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);

    Task<int> CountAsync(CancellationToken ct = default);

    // ── Query materialisers ──
    // These let services compose projections on Query() without referencing EF Core.

    Task<IReadOnlyList<TResult>> ToListAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default);

    Task<TResult?> FirstOrDefaultAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default);

    Task<bool> AnyAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default);

    Task<int> CountQueryAsync<TResult>(IQueryable<TResult> query, CancellationToken ct = default);

    /// <summary>Server-side SUM over a decimal projection, avoiding loading rows into memory.</summary>
    Task<decimal> SumDecimalAsync(IQueryable<decimal?> query, CancellationToken ct = default);
}
