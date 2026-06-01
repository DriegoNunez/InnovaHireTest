using System.Security.Cryptography;
using System.Text.Json;
using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Exams;
using InnovaExam.Application.Interfaces;
using InnovaExam.Domain.Entities;
using InnovaExam.Domain.Enums;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Services;

public class ExamService : IExamService
{
    private readonly InnovaExamDbContext _context;

    public ExamService(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task<ExamDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var exam = await _context.Exams
            .Include(e => e.Candidate)
            .Include(e => e.ExamAttempts)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        return exam == null ? null : MapToDto(exam);
    }

    public async Task<PagedResult<ExamDto>> GetPagedAsync(ExamFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        var query = _context.Exams
            .Include(e => e.Candidate)
            .Include(e => e.ExamAttempts)
            .AsQueryable();

        if (filter.CandidateId.HasValue)
            query = query.Where(e => e.CandidateId == filter.CandidateId.Value);

        if (filter.ExperienceLevel.HasValue)
            query = query.Where(e => e.ExperienceLevel == filter.ExperienceLevel.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var search = filter.SearchText.ToLower();
            query = query.Where(e =>
                e.Title.ToLower().Contains(search) ||
                e.Candidate.FirstName.ToLower().Contains(search) ||
                e.Candidate.LastName.ToLower().Contains(search) ||
                e.Candidate.Email.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ExamDto>
        {
            Items = items.Select(MapToDto),
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<ExamDto> GenerateExamAsync(GenerateExamRequest request, Guid createdBy, CancellationToken cancellationToken = default)
    {
        var candidate = await _context.Candidates.FindAsync(new object[] { request.CandidateId }, cancellationToken)
            ?? throw new InvalidOperationException("Candidate not found");

        // Select random published questions for the experience level
        var totalQuestionsNeeded = request.TotalQuestions ?? 30;

        var questions = await _context.Questions
            .Where(q => q.Status == QuestionStatus.Published
                && q.ExperienceLevel == request.ExperienceLevel)
            .OrderBy(q => Guid.NewGuid()) // random
            .Take(totalQuestionsNeeded)
            .ToListAsync(cancellationToken);

        if (questions.Count == 0)
        {
            throw new InvalidOperationException("No published questions are available for the selected experience level.");
        }

        var accessToken = GenerateAccessToken();
        var totalPoints = questions.Sum(q => q.Points);

        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            CandidateId = request.CandidateId,
            Title = $"INNOVA Structural Engineering Exam - {candidate.FirstName} {candidate.LastName}",
            ExperienceLevel = request.ExperienceLevel,
            TotalQuestions = questions.Count,
            TotalPoints = totalPoints,
            TimeLimitMinutes = request.TimeLimitMinutes,
            AccessToken = accessToken,
            InvitationUrl = $"/exam/{accessToken}",
            TokenExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            ExamQuestions = questions.Select((q, index) => new ExamQuestion
            {
                Id = Guid.NewGuid(),
                QuestionId = q.Id,
                DisplayOrder = index + 1,
                Points = q.Points
            }).ToList()
        };

        await _context.Exams.AddAsync(exam, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Reload with candidate
        var created = await _context.Exams
            .Include(e => e.Candidate)
            .Include(e => e.ExamAttempts)
            .FirstAsync(e => e.Id == exam.Id, cancellationToken);

        return MapToDto(created);
    }

    public async Task<bool> SendInviteAsync(Guid examId, CancellationToken cancellationToken = default)
    {
        var exam = await _context.Exams
            .Include(e => e.Candidate)
            .FirstOrDefaultAsync(e => e.Id == examId, cancellationToken);

        if (exam == null) return false;

        // Create email log (actual sending would use Microsoft Graph)
        var emailLog = new EmailLog
        {
            Id = Guid.NewGuid(),
            ExamId = examId,
            EmailType = EmailType.ExamInvitation,
            RecipientEmail = exam.Candidate.Email,
            Subject = $"INNOVA Technologies - Structural Engineering Exam Invitation",
            Body = $"You have been invited to take the structural engineering exam. Open this link: {exam.InvitationUrl ?? $"/exam/{exam.AccessToken}"}",
            Status = EmailStatus.Queued,
            CreatedAt = DateTime.UtcNow
        };

        await _context.EmailLogs.AddAsync(emailLog, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IEnumerable<ExamQuestionDto>> GetExamPreviewQuestionsAsync(Guid examId, CancellationToken cancellationToken = default)
    {
        var exists = await _context.Exams.AnyAsync(e => e.Id == examId, cancellationToken);
        if (!exists) return Enumerable.Empty<ExamQuestionDto>();

        return await GetExamQuestionDtosAsync(examId, cancellationToken);
    }

    public async Task<ValidateTokenResponse> ValidateTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var exam = await _context.Exams
            .Include(e => e.Candidate)
            .Include(e => e.ExamAttempts)
            .FirstOrDefaultAsync(e => e.AccessToken == token, cancellationToken);

        if (exam == null || exam.TokenExpiresAt < DateTime.UtcNow)
        {
            return new ValidateTokenResponse { IsValid = false };
        }

        return new ValidateTokenResponse
        {
            IsValid = true,
            ExamId = exam.Id,
            CandidateName = $"{exam.Candidate.FirstName} {exam.Candidate.LastName}",
            ExamTitle = exam.Title,
            HasExistingAttempt = exam.ExamAttempts.Any(a => a.Status != ExamAttemptStatus.Expired)
        };
    }

    public async Task<ExamSessionDto?> StartExamAsync(string token, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default)
    {
        var exam = await _context.Exams
            .Include(e => e.ExamAttempts)
            .FirstOrDefaultAsync(e => e.AccessToken == token && e.TokenExpiresAt > DateTime.UtcNow, cancellationToken);

        if (exam == null) return null;

        // Check for existing active attempt
        var existingAttempt = exam.ExamAttempts
            .FirstOrDefault(a => a.Status == ExamAttemptStatus.InProgress);

        if (existingAttempt != null)
        {
            return new ExamSessionDto
            {
                ExamId = exam.Id,
                AttemptId = existingAttempt.Id,
                Title = exam.Title,
                TotalQuestions = exam.TotalQuestions,
                TimeLimitMinutes = exam.TimeLimitMinutes,
                StartedAt = existingAttempt.StartedAt!.Value,
                ExpiresAt = existingAttempt.StartedAt!.Value.AddMinutes(exam.TimeLimitMinutes)
            };
        }

        var attempt = new ExamAttempt
        {
            Id = Guid.NewGuid(),
            ExamId = exam.Id,
            Status = ExamAttemptStatus.InProgress,
            StartedAt = DateTime.UtcNow,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        await _context.ExamAttempts.AddAsync(attempt, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new ExamSessionDto
        {
            ExamId = exam.Id,
            AttemptId = attempt.Id,
            Title = exam.Title,
            TotalQuestions = exam.TotalQuestions,
            TimeLimitMinutes = exam.TimeLimitMinutes,
            StartedAt = attempt.StartedAt!.Value,
            ExpiresAt = attempt.StartedAt!.Value.AddMinutes(exam.TimeLimitMinutes)
        };
    }

    public async Task<IEnumerable<ExamQuestionDto>> GetExamQuestionsAsync(Guid attemptId, CancellationToken cancellationToken = default)
    {
        var attempt = await _context.ExamAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId, cancellationToken);

        if (attempt == null) return Enumerable.Empty<ExamQuestionDto>();

        return await GetExamQuestionDtosAsync(attempt.ExamId, cancellationToken);
    }

    private async Task<IEnumerable<ExamQuestionDto>> GetExamQuestionDtosAsync(Guid examId, CancellationToken cancellationToken = default)
    {
        var examQuestions = await _context.ExamQuestions
            .Include(eq => eq.Question)
            .ThenInclude(q => q.Options.OrderBy(o => o.DisplayOrder))
            .Where(eq => eq.ExamId == examId)
            .OrderBy(eq => eq.DisplayOrder)
            .ToListAsync(cancellationToken);

        return examQuestions.Select(eq => new ExamQuestionDto
        {
            ExamQuestionId = eq.Id,
            DisplayOrder = eq.DisplayOrder,
            Points = eq.Points,
            QuestionType = eq.Question.QuestionType,
            QuestionText = eq.Question.QuestionText,
            QuestionImageUrl = eq.Question.QuestionImageUrl,
            TimeLimitSeconds = eq.Question.TimeLimitSeconds,
            Options = eq.Question.Options.Select(o => new ExamQuestionOptionDto
            {
                Id = o.Id,
                OptionText = o.OptionText,
                DisplayOrder = o.DisplayOrder
            }).ToList()
        });
    }

    public async Task<bool> SubmitAnswerAsync(Guid attemptId, SubmitAnswerRequest request, CancellationToken cancellationToken = default)
    {
        var attempt = await _context.ExamAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.Status == ExamAttemptStatus.InProgress, cancellationToken);

        if (attempt == null) return false;

        var existing = await _context.CandidateAnswers
            .FirstOrDefaultAsync(a => a.ExamAttemptId == attemptId && a.ExamQuestionId == request.ExamQuestionId, cancellationToken);

        if (existing != null)
        {
            existing.AnswerText = request.AnswerText;
            existing.SelectedOptionIds = request.SelectedOptionIds != null
                ? JsonSerializer.Serialize(request.SelectedOptionIds) : null;
            existing.TimeSpentSeconds = request.TimeSpentSeconds;
            existing.IsMarkedForReview = request.IsMarkedForReview;
            existing.AnsweredAt = DateTime.UtcNow;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var answer = new CandidateAnswer
            {
                Id = Guid.NewGuid(),
                ExamAttemptId = attemptId,
                ExamQuestionId = request.ExamQuestionId,
                AnswerText = request.AnswerText,
                SelectedOptionIds = request.SelectedOptionIds != null
                    ? JsonSerializer.Serialize(request.SelectedOptionIds) : null,
                TimeSpentSeconds = request.TimeSpentSeconds,
                IsMarkedForReview = request.IsMarkedForReview,
                AnsweredAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            await _context.CandidateAnswers.AddAsync(answer, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> LogBehaviorAsync(Guid attemptId, BehaviorLogRequest request, CancellationToken cancellationToken = default)
    {
        var attempt = await _context.ExamAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId, cancellationToken);

        if (attempt == null) return false;

        var riskLevel = request.EventType switch
        {
            "TabSwitch" => RiskLevel.Medium,
            "CopyPaste" => RiskLevel.High,
            "RightClick" => RiskLevel.Low,
            "FocusLost" => RiskLevel.Medium,
            _ => RiskLevel.Low
        };

        var log = new BehaviorLog
        {
            Id = Guid.NewGuid(),
            ExamAttemptId = attemptId,
            EventType = request.EventType,
            EventData = request.EventData,
            RiskLevel = riskLevel,
            EventTimestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        await _context.BehaviorLogs.AddAsync(log, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SubmitExamAsync(Guid attemptId, CancellationToken cancellationToken = default)
    {
        var attempt = await _context.ExamAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.Status == ExamAttemptStatus.InProgress, cancellationToken);

        if (attempt == null) return false;

        attempt.Status = ExamAttemptStatus.Submitted;
        attempt.SubmittedAt = DateTime.UtcNow;
        attempt.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string GenerateAccessToken()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static ExamDto MapToDto(Exam e) => new()
    {
        Id = e.Id,
        CandidateId = e.CandidateId,
        CandidateName = $"{e.Candidate.FirstName} {e.Candidate.LastName}",
        CandidateEmail = e.Candidate.Email,
        Title = e.Title,
        ExperienceLevel = e.ExperienceLevel,
        TotalQuestions = e.TotalQuestions,
        TotalPoints = e.TotalPoints,
        TimeLimitMinutes = e.TimeLimitMinutes,
        InvitationUrl = e.InvitationUrl ?? $"/exam/{e.AccessToken}",
        TokenExpiresAt = e.TokenExpiresAt,
        CreatedAt = e.CreatedAt,
        LatestAttemptStatus = e.ExamAttempts.OrderByDescending(a => a.CreatedAt).FirstOrDefault()?.Status.ToString()
    };
}
