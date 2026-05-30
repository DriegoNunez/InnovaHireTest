using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Candidates;
using InnovaExam.Application.Interfaces;
using InnovaExam.Domain.Entities;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Services;

public class CandidateService : ICandidateService
{
    private readonly InnovaExamDbContext _context;

    public CandidateService(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task<CandidateDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var candidate = await _context.Candidates
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        return candidate == null ? null : MapToDto(candidate);
    }

    public async Task<PagedResult<CandidateDto>> GetPagedAsync(CandidateFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        var query = _context.Candidates.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var search = filter.SearchText.ToLower();
            query = query.Where(c =>
                c.FirstName.ToLower().Contains(search) ||
                c.LastName.ToLower().Contains(search) ||
                c.Email.ToLower().Contains(search));
        }

        if (filter.ExperienceLevel.HasValue)
            query = query.Where(c => c.ExperienceLevel == filter.ExperienceLevel.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(c => c.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<CandidateDto>
        {
            Items = items.Select(MapToDto),
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<CandidateDto> CreateAsync(CreateCandidateRequest request, Guid createdBy, CancellationToken cancellationToken = default)
    {
        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            ExperienceLevel = request.ExperienceLevel,
            YearsOfExperience = request.YearsOfExperience,
            CurrentCompany = request.CurrentCompany,
            ResumeUrl = request.ResumeUrl,
            Notes = request.Notes,
            IsActive = true,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Candidates.AddAsync(candidate, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return MapToDto(candidate);
    }

    public async Task<CandidateDto?> UpdateAsync(Guid id, UpdateCandidateRequest request, CancellationToken cancellationToken = default)
    {
        var candidate = await _context.Candidates.FindAsync(new object[] { id }, cancellationToken);
        if (candidate == null) return null;

        candidate.FirstName = request.FirstName;
        candidate.LastName = request.LastName;
        candidate.Email = request.Email;
        candidate.Phone = request.Phone;
        candidate.ExperienceLevel = request.ExperienceLevel;
        candidate.YearsOfExperience = request.YearsOfExperience;
        candidate.CurrentCompany = request.CurrentCompany;
        candidate.ResumeUrl = request.ResumeUrl;
        candidate.Notes = request.Notes;
        candidate.IsActive = request.IsActive;
        candidate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return MapToDto(candidate);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var candidate = await _context.Candidates.FindAsync(new object[] { id }, cancellationToken);
        if (candidate == null) return false;

        candidate.IsActive = false;
        candidate.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static CandidateDto MapToDto(Candidate c) => new()
    {
        Id = c.Id,
        FirstName = c.FirstName,
        LastName = c.LastName,
        Email = c.Email,
        Phone = c.Phone,
        ExperienceLevel = c.ExperienceLevel,
        YearsOfExperience = c.YearsOfExperience,
        CurrentCompany = c.CurrentCompany,
        ResumeUrl = c.ResumeUrl,
        Notes = c.Notes,
        IsActive = c.IsActive,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
