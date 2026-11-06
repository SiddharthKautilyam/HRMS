using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record AnnouncementDto(
    Guid Id,
    string Title,
    string Message,
    string Tag,
    string Severity,
    DateTime PublishedAtUtc,
    string PublishedLabel,
    bool IsActive);

public sealed record SaveAnnouncementRequest(
    [Required, MaxLength(160)] string Title,
    [Required, MaxLength(2000)] string Message,
    [Required, MaxLength(40)] string Tag,
    AnnouncementSeverity Severity);

public sealed record NotificationDto(
    Guid Id,
    string IconKey,
    string Title,
    string Message,
    string TimeLabel,
    bool IsRead);
