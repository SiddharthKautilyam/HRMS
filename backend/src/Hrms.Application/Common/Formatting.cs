using System.Globalization;

namespace Hrms.Application.Common;

/// <summary>Small presentation helpers shared by the mapping code.</summary>
public static class Formatting
{
    private static readonly CultureInfo Culture = CultureInfo.InvariantCulture;

    public static string Initials(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "—";
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts.Take(2).Select(p => char.ToUpperInvariant(p[0])));
    }

    public static string ShortDate(DateOnly date) => date.ToString("MMM d", Culture);

    public static string ShortDate(DateTime date) => date.ToString("MMM d", Culture);

    public static string FullDate(DateOnly date) => date.ToString("MMM d, yyyy", Culture);

    public static string MonthName(int month) => Culture.DateTimeFormat.GetAbbreviatedMonthName(month);

    public static string MonthYear(int month, int year) => $"{Culture.DateTimeFormat.GetMonthName(month)} {year}";

    public static string DayName(DateOnly date) => date.DayOfWeek.ToString();

    /// <summary>Compact relative label such as "2h ago" / "3d ago".</summary>
    public static string Relative(DateTime utc)
    {
        var delta = DateTime.UtcNow - utc;
        if (delta.TotalMinutes < 1) return "just now";
        if (delta.TotalMinutes < 60) return $"{(int)delta.TotalMinutes}m ago";
        if (delta.TotalHours < 24) return $"{(int)delta.TotalHours}h ago";
        if (delta.TotalDays < 7) return $"{(int)delta.TotalDays}d ago";
        if (delta.TotalDays < 30) return $"{(int)(delta.TotalDays / 7)}w ago";
        return $"{(int)(delta.TotalDays / 30)}mo ago";
    }

    public static string Money(decimal value, string currency = "$") =>
        $"{currency}{value.ToString("N0", Culture)}";

    public static string Time(TimeOnly? time) => time?.ToString("HH:mm", Culture) ?? "—";
}
