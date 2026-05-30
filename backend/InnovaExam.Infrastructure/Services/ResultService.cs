using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Results;
using InnovaExam.Application.Interfaces;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Services;

public class ResultService : IResultService
{
    private readonly InnovaExamDbContext _context;

    public ResultService(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task<ExamResultDto?> GetByAttemptIdAsync(Guid attemptId, CancellationToken cancellationToken = default)
    {
        var attempt = await _context.ExamAttempts
            .Include(a => a.Exam)
            .ThenInclude(e => e.Candidate)
            .Include(a => a.FinalReport)
            .FirstOrDefaultAsync(a => a.Id == attemptId, cancellationToken);

        if (attempt == null) return null;

        return MapToDto(attempt);
    }

    public async Task<PagedResult<ExamResultDto>> GetPagedAsync(ResultFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        var query = _context.ExamAttempts
            .Include(a => a.Exam)
            .ThenInclude(e => e.Candidate)
            .Include(a => a.FinalReport)
            .AsQueryable();

        if (filter.CandidateId.HasValue)
            query = query.Where(a => a.Exam.CandidateId == filter.CandidateId.Value);

        if (filter.Status.HasValue)
            query = query.Where(a => a.Status == filter.Status.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var search = filter.SearchText.ToLower();
            query = query.Where(a =>
                a.Exam.Candidate.FirstName.ToLower().Contains(search) ||
                a.Exam.Candidate.LastName.ToLower().Contains(search) ||
                a.Exam.Title.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ExamResultDto>
        {
            Items = items.Select(MapToDto),
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    private static ExamResultDto MapToDto(Domain.Entities.ExamAttempt a) => new()
    {
        ExamAttemptId = a.Id,
        ExamId = a.ExamId,
        CandidateName = $"{a.Exam.Candidate.FirstName} {a.Exam.Candidate.LastName}",
        CandidateEmail = a.Exam.Candidate.Email,
        ExamTitle = a.Exam.Title,
        Status = a.Status,
        TotalScore = a.TotalScore,
        PercentageScore = a.PercentageScore,
        TotalPoints = a.Exam.TotalPoints,
        StartedAt = a.StartedAt,
        SubmittedAt = a.SubmittedAt,
        CompletedAt = a.CompletedAt,
        FinalReport = a.FinalReport != null ? new FinalReportDto
        {
            Id = a.FinalReport.Id,
            TotalScore = a.FinalReport.TotalScore,
            PercentageScore = a.FinalReport.PercentageScore,
            HiringRecommendation = a.FinalReport.HiringRecommendation,
            IntegrityRiskLevel = a.FinalReport.IntegrityRiskLevel,
            StrengthAreas = a.FinalReport.StrengthAreas,
            WeaknessAreas = a.FinalReport.WeaknessAreas,
            DetailedAnalysis = a.FinalReport.DetailedAnalysis,
            CategoryScores = a.FinalReport.CategoryScores,
            ReportPdfUrl = a.FinalReport.ReportPdfUrl,
            CreatedAt = a.FinalReport.CreatedAt
        } : null
    };
}
