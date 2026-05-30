using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Audit;

namespace InnovaExam.Application.Interfaces;

public interface IAuditService
{
    Task LogAsync(Guid? userId, string action, string entityType, string? entityId = null,
        string? oldValues = null, string? newValues = null, string? ipAddress = null,
        string? userAgent = null, CancellationToken cancellationToken = default);
    Task<PagedResult<AuditLogDto>> GetPagedAsync(AuditLogFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default);
}
