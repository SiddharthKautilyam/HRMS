namespace Hrms.Application.Common;

/// <summary>A page of results plus the total count for pagination controls.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling((double)Total / PageSize);

    public static PagedResult<T> Empty(int page, int pageSize) => new(Array.Empty<T>(), 0, page, pageSize);
}

/// <summary>Normalised query-string paging values.</summary>
public static class Paging
{
    public static (int Page, int PageSize) Normalise(int page, int pageSize, int maxPageSize = 100)
    {
        var safePage = page < 1 ? 1 : page;
        var safeSize = pageSize < 1 ? 10 : Math.Min(pageSize, maxPageSize);
        return (safePage, safeSize);
    }
}
