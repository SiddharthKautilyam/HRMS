using Hrms.Application.Abstractions.Persistence;
using Hrms.Domain.Common;
using Hrms.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence.Repositories;

/// <summary>EF Core implementation of the generic repository over <typeparamref name="TEntity"/>.</summary>
public class Repository<TEntity> : IRepository<TEntity> where TEntity : BaseEntity
{
    protected readonly HrmsDbContext Db;
    protected readonly DbSet<TEntity> Set;

    public Repository(HrmsDbContext db)
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

    public void Update(TEntity entity)
    {
        var local = Set.Local.FirstOrDefault(e => e.Id == entity.Id);
        if (local != null)
        {
            if (!ReferenceEquals(local, entity))
            {
                Db.Entry(local).CurrentValues.SetValues(entity);
            }
            else
            {
                Db.Entry(local).State = EntityState.Modified;
            }
        }
        else
        {
            Set.Update(entity);
        }
    }

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
