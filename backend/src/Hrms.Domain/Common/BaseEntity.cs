namespace Hrms.Domain.Common;

/// <summary>
/// Base type for every persisted aggregate. Uses a Guid primary key so ids are
/// safe to expose over HTTP, plus audit timestamps maintained by the DbContext.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}
