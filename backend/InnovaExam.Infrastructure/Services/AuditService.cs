using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Audit;
using InnovaExam.Application.Interfaces;
using InnovaExam.Domain.Entities;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly InnovaExamDbContext _context;

    public AuditService(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(Guid? userId, string action, string entityType, string? entityId = null,
        string? oldValues = null, string? newValues = null, string? ipAddress = null,
        string? userAgent = null, CancellationToken cancellationToken = default)
    {
        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValues = oldValues,
            NewValues = newValues,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        await _context.AuditLogs.AddAsync(auditLog, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<AuditLogDto>> GetPagedAsync(AuditLogFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        var query = _context.AuditLogs
            .Include(a => a.User)
            .AsQueryable();

        if (filter.UserId.HasValue)
            query = query.Where(a => a.UserId == filter.UserId.Value);

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
            query = query.Where(a => a.EntityType == filter.EntityType);

        if (!string.IsNullOrWhiteSpace(filter.Action))
            query = query.Where(a => a.Action.Contains(filter.Action));

        if (filter.FromDate.HasValue)
            query = query.Where(a => a.CreatedAt >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            query = query.Where(a => a.CreatedAt <= filter.ToDate.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                UserEmail = a.User != null ? a.User.Email : null,
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                OldValues = a.OldValues,
                NewValues = a.NewValues,
                IpAddress = a.IpAddress,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<AuditLogDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }
}
