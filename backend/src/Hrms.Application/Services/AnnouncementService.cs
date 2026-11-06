using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;

namespace Hrms.Application.Services;

public sealed class AnnouncementService : IAnnouncementService
{
    private readonly IUnitOfWork _uow;

    public AnnouncementService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IReadOnlyList<AnnouncementDto>> ListAsync(CancellationToken ct = default)
    {
        var items = await _uow.Announcements.ToListAsync(
            _uow.Announcements.Query().Where(a => a.IsActive).OrderByDescending(a => a.PublishedAtUtc),
            ct);

        return items.Select(ToDto).ToList();
    }

    public async Task<AnnouncementDto> CreateAsync(SaveAnnouncementRequest request, CancellationToken ct = default)
    {
        var announcement = new Announcement
        {
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Tag = request.Tag.Trim(),
            Severity = request.Severity,
            PublishedAtUtc = DateTime.UtcNow,
        };

        await _uow.Announcements.AddAsync(announcement, ct);
        await _uow.SaveChangesAsync(ct);
        return ToDto(announcement);
    }

    public async Task<AnnouncementDto> UpdateAsync(Guid id, SaveAnnouncementRequest request, CancellationToken ct = default)
    {
        var announcement = await _uow.Announcements.GetByIdAsync(id, ct)
                           ?? throw NotFoundException.For("Announcement", id);

        announcement.Title = request.Title.Trim();
        announcement.Message = request.Message.Trim();
        announcement.Tag = request.Tag.Trim();
        announcement.Severity = request.Severity;

        _uow.Announcements.Update(announcement);
        await _uow.SaveChangesAsync(ct);
        return ToDto(announcement);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var announcement = await _uow.Announcements.GetByIdAsync(id, ct)
                           ?? throw NotFoundException.For("Announcement", id);

        announcement.IsActive = false;
        _uow.Announcements.Update(announcement);
        await _uow.SaveChangesAsync(ct);
    }

    private static AnnouncementDto ToDto(Announcement a) => new(
        a.Id,
        a.Title,
        a.Message,
        a.Tag,
        a.Severity.ToString(),
        a.PublishedAtUtc,
        Formatting.Relative(a.PublishedAtUtc),
        a.IsActive);
}
