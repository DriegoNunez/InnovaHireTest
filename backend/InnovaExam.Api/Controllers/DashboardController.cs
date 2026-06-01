using InnovaExam.Application.Common;
using InnovaExam.Domain.Enums;
using InnovaExam.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,HR")]
public class DashboardController : ControllerBase
{
    private readonly InnovaExamDbContext _context;

    public DashboardController(InnovaExamDbContext context)
    {
        _context = context;
    }

    [HttpGet("admin")]
    public async Task<IActionResult> GetAdminDashboard(CancellationToken cancellationToken)
    {
        var totalQuestions = await _context.Questions.CountAsync(cancellationToken);
        var activeQuestions = await _context.Questions
            .CountAsync(q => q.Status == QuestionStatus.Published, cancellationToken);
        var totalCandidates = await _context.Candidates.CountAsync(cancellationToken);
        var totalExams = await _context.Exams.CountAsync(cancellationToken);
        var completedExams = await _context.ExamAttempts
            .CountAsync(a => a.Status == ExamAttemptStatus.Submitted || a.Status == ExamAttemptStatus.Completed, cancellationToken);

        var scoredAttempts = await _context.ExamAttempts
            .Where(a => a.PercentageScore.HasValue)
            .Select(a => a.PercentageScore!.Value)
            .ToListAsync(cancellationToken);

        var averageScore = scoredAttempts.Count > 0 ? Math.Round(scoredAttempts.Average(), 1) : 0;
        var passingRate = scoredAttempts.Count > 0
            ? Math.Round(scoredAttempts.Count(score => score >= 70) * 100m / scoredAttempts.Count, 1)
            : 0;

        var recentActivity = await _context.AuditLogs
            .Include(a => a.User)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new
            {
                id = a.Id,
                action = a.Action,
                userId = a.UserId.HasValue ? a.UserId.Value.ToString() : string.Empty,
                userName = a.User != null ? a.User.Email : "System",
                userRole = "admin",
                targetType = a.EntityType,
                targetId = a.EntityId ?? string.Empty,
                details = a.NewValues ?? a.OldValues ?? string.Empty,
                ipAddress = a.IpAddress ?? string.Empty,
                userAgent = a.UserAgent ?? string.Empty,
                timestamp = a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var stats = new
        {
            totalQuestions,
            activeQuestions,
            totalCandidates,
            totalExams,
            completedExams,
            averageScore,
            passingRate,
            recentActivity
        };

        return Ok(ApiResponse<object>.Ok(stats));
    }

    [HttpGet("hr")]
    public async Task<IActionResult> GetHrDashboard(CancellationToken cancellationToken)
    {
        var totalCandidates = await _context.Candidates.CountAsync(cancellationToken);
        var pendingInvites = await _context.Exams
            .CountAsync(e => !e.ExamAttempts.Any() && e.TokenExpiresAt > DateTime.UtcNow, cancellationToken);
        var inProgressExams = await _context.ExamAttempts
            .CountAsync(a => a.Status == ExamAttemptStatus.InProgress, cancellationToken);
        var completedExams = await _context.ExamAttempts
            .CountAsync(a => a.Status == ExamAttemptStatus.Submitted || a.Status == ExamAttemptStatus.Completed, cancellationToken);

        var scoredAttempts = await _context.ExamAttempts
            .Where(a => a.PercentageScore.HasValue)
            .Select(a => a.PercentageScore!.Value)
            .ToListAsync(cancellationToken);

        var averageScore = scoredAttempts.Count > 0 ? Math.Round(scoredAttempts.Average(), 1) : 0;
        var passingRate = scoredAttempts.Count > 0
            ? Math.Round(scoredAttempts.Count(score => score >= 70) * 100m / scoredAttempts.Count, 1)
            : 0;

        var recentCandidates = await _context.Candidates
            .OrderByDescending(c => c.CreatedAt)
            .Take(5)
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Email,
                c.Phone,
                c.ExperienceLevel,
                c.YearsOfExperience,
                c.CurrentCompany,
                c.Notes,
                c.IsActive,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var stats = new
        {
            totalCandidates,
            pendingInvites,
            inProgressExams,
            completedExams,
            averageScore,
            passingRate,
            recentCandidates
        };

        return Ok(ApiResponse<object>.Ok(stats));
    }
}
