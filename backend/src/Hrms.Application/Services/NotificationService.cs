using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;

namespace Hrms.Application.Services;

public sealed class NotificationService : INotificationService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public NotificationService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<NotificationDto>> ListAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var items = await _uow.Notifications.ToListAsync(
            _uow.Notifications.Query()
                .Where(n => n.UserId == null || n.UserId == userId)
                .OrderByDescending(n => n.CreatedAtUtc)
                .Take(100),
            ct);

        return items
            .Select(n => new NotificationDto(n.Id, n.IconKey, n.Title, n.Message, n.TimeLabel, n.IsRead))
            .ToList();
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct = default)
    {
        var notification = await _uow.Notifications.GetByIdAsync(id, ct)
                           ?? throw NotFoundException.For("Notification", id);

        notification.IsRead = true;
        _uow.Notifications.Update(notification);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task MarkAllReadAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var unread = await _uow.Notifications.ToListAsync(
            _uow.Notifications.Query()
                .Where(n => !n.IsRead && (n.UserId == null || n.UserId == userId)),
            ct);

        foreach (var item in unread)
        {
            item.IsRead = true;
            _uow.Notifications.Update(item);
        }

        await _uow.SaveChangesAsync(ct);
    }

    public async Task ClearAllAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var items = await _uow.Notifications.ToListAsync(
            _uow.Notifications.Query()
                .Where(n => n.UserId == null || n.UserId == userId),
            ct);

        _uow.Notifications.RemoveRange(items);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var item = await _uow.Notifications.GetByIdAsync(id, ct);
        if (item != null)
        {
            _uow.Notifications.Remove(item);
            await _uow.SaveChangesAsync(ct);
        }
    }

    public async Task ToggleReadAsync(Guid id, CancellationToken ct = default)
    {
        var notification = await _uow.Notifications.GetByIdAsync(id, ct)
                           ?? throw NotFoundException.For("Notification", id);

        notification.IsRead = !notification.IsRead;
        _uow.Notifications.Update(notification);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<NotificationPreferenceDto>> GetPreferencesAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        if (userId is null)
        {
            return Array.Empty<NotificationPreferenceDto>();
        }

        var existing = await _uow.NotificationPreferences.ToListAsync(
            _uow.NotificationPreferences.Query()
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.CreatedAtUtc),
            ct);

        if (existing.Count == 0)
        {
            var defaults = DefaultPreferences()
                .Select(d => new NotificationPreference
                {
                    UserId = userId.Value,
                    Key = d.Key,
                    Name = d.Name,
                    Description = d.Description,
                    Enabled = d.Enabled,
                })
                .ToList();

            await _uow.NotificationPreferences.AddRangeAsync(defaults, ct);
            await _uow.SaveChangesAsync(ct);
            existing = defaults;
        }

        return existing.Select(ToPreferenceDto).ToList();
    }

    public async Task<NotificationPreferenceDto> UpdatePreferenceAsync(
        string id,
        bool enabled,
        CancellationToken ct = default)
    {
        if (!Guid.TryParse(id, out var preferenceId))
        {
            throw new ValidationException("The notification preference id is invalid.");
        }

        var preference = await _uow.NotificationPreferences.GetByIdAsync(preferenceId, ct)
                         ?? throw NotFoundException.For("Notification preference", id);

        preference.Enabled = enabled;
        _uow.NotificationPreferences.Update(preference);
        await _uow.SaveChangesAsync(ct);

        return ToPreferenceDto(preference);
    }

    private static NotificationPreferenceDto ToPreferenceDto(NotificationPreference p) =>
        new(p.Id.ToString(), p.Key, p.Name, p.Description, p.Enabled);

    private static IEnumerable<(string Key, string Name, string Description, bool Enabled)> DefaultPreferences() =>
        new[]
        {
            ("leave", "Leave Approval Updates", "Get notified when your leave is approved or rejected", true),
            ("payroll", "Payroll Notifications", "Notify when salary is credited", true),
            ("attendance", "Attendance Reminders", "Daily check-in/out reminders", false),
            ("announcements", "Announcements", "Company news and HR updates", true),
            ("tasks", "Task Assignments", "When new tasks are assigned to you", true),
            ("performance", "Performance Reviews", "Review cycle reminders", false),
        };
}
