using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Results;
using InnovaExam.Application.Interfaces;
using InnovaExam.Domain.Entities;
using InnovaExam.Domain.Enums;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

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
        var attempt = await LoadAttemptAsync(attemptId, cancellationToken);

        if (attempt == null) return null;

        return MapToDto(attempt);
    }

    public async Task<ExamResultDto?> GenerateAiGradesAsync(Guid attemptId, CancellationToken cancellationToken = default)
    {
        var attempt = await LoadAttemptAsync(attemptId, cancellationToken);
        if (attempt == null) return null;

        attempt.Status = ExamAttemptStatus.Grading;

        foreach (var examQuestion in attempt.Exam.ExamQuestions)
        {
            var answer = attempt.CandidateAnswers.FirstOrDefault(candidateAnswer => candidateAnswer.ExamQuestionId == examQuestion.Id);
            if (answer == null)
            {
                answer = new CandidateAnswer
                {
                    Id = Guid.NewGuid(),
                    ExamAttemptId = attempt.Id,
                    ExamQuestionId = examQuestion.Id,
                    IsMarkedForReview = false,
                    CreatedAt = DateTime.UtcNow
                };
                await _context.CandidateAnswers.AddAsync(answer, cancellationToken);
                attempt.CandidateAnswers.Add(answer);
            }

            var grade = attempt.GradingResults.FirstOrDefault(grading => grading.CandidateAnswerId == answer.Id);
            if (grade == null)
            {
                grade = new GradingResult
                {
                    Id = Guid.NewGuid(),
                    ExamAttemptId = attempt.Id,
                    CandidateAnswerId = answer.Id,
                    CreatedAt = DateTime.UtcNow
                };
                await _context.GradingResults.AddAsync(grade, cancellationToken);
                attempt.GradingResults.Add(grade);
            }

            if (grade.IsOverridden == true)
            {
                continue;
            }

            var draft = DraftAiGrade(examQuestion, answer);
            grade.PointsAwarded = draft.PointsAwarded;
            grade.MaxPoints = examQuestion.Points;
            grade.AiFeedback = draft.Feedback;
            grade.ConfidenceScore = draft.ConfidenceScore;
            grade.IsAutoGraded = true;
            grade.IsOverridden = false;
            grade.UpdatedAt = DateTime.UtcNow;
        }

        RecalculateAttempt(attempt, Guid.Empty);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(attempt);
    }

    public async Task<ExamResultDto?> UpdateQuestionGradeAsync(Guid attemptId, UpdateQuestionGradeRequest request, Guid reviewedBy, CancellationToken cancellationToken = default)
    {
        var attempt = await LoadAttemptAsync(attemptId, cancellationToken);
        if (attempt == null) return null;

        var examQuestion = attempt.Exam.ExamQuestions.FirstOrDefault(question => question.Id == request.ExamQuestionId);
        if (examQuestion == null) return null;

        var answer = attempt.CandidateAnswers.FirstOrDefault(candidateAnswer => candidateAnswer.ExamQuestionId == request.ExamQuestionId);
        if (answer == null)
        {
            answer = new CandidateAnswer
            {
                Id = Guid.NewGuid(),
                ExamAttemptId = attempt.Id,
                ExamQuestionId = request.ExamQuestionId,
                IsMarkedForReview = false,
                CreatedAt = DateTime.UtcNow
            };
            await _context.CandidateAnswers.AddAsync(answer, cancellationToken);
            attempt.CandidateAnswers.Add(answer);
        }

        var grade = attempt.GradingResults.FirstOrDefault(grading => grading.CandidateAnswerId == answer.Id);
        if (grade == null)
        {
            grade = new GradingResult
            {
                Id = Guid.NewGuid(),
                ExamAttemptId = attempt.Id,
                CandidateAnswerId = answer.Id,
                CreatedAt = DateTime.UtcNow
            };
            await _context.GradingResults.AddAsync(grade, cancellationToken);
            attempt.GradingResults.Add(grade);
        }

        grade.PointsAwarded = Math.Clamp(request.PointsAwarded, 0, examQuestion.Points);
        grade.MaxPoints = examQuestion.Points;
        grade.AiFeedback = request.Feedback;
        grade.IsAutoGraded = false;
        grade.IsOverridden = true;
        grade.OverrideReason = request.OverrideReason;
        grade.OverriddenBy = reviewedBy == Guid.Empty ? null : reviewedBy;
        grade.UpdatedAt = DateTime.UtcNow;

        RecalculateAttempt(attempt, reviewedBy);
        await _context.SaveChangesAsync(cancellationToken);

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

        if (filter.CompletedOnly)
            query = query.Where(a => a.Status == ExamAttemptStatus.Submitted || a.Status == ExamAttemptStatus.Grading || a.Status == ExamAttemptStatus.Completed);

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

    private async Task<ExamAttempt?> LoadAttemptAsync(Guid attemptId, CancellationToken cancellationToken) =>
        await _context.ExamAttempts
            .Include(a => a.Exam)
            .ThenInclude(e => e.Candidate)
            .Include(a => a.Exam)
            .ThenInclude(e => e.ExamQuestions)
            .ThenInclude(eq => eq.Question)
            .ThenInclude(q => q.Options)
            .Include(a => a.CandidateAnswers)
            .Include(a => a.GradingResults)
            .Include(a => a.FinalReport)
            .FirstOrDefaultAsync(a => a.Id == attemptId, cancellationToken);

    private static (int PointsAwarded, string Feedback, decimal ConfidenceScore) DraftAiGrade(ExamQuestion examQuestion, CandidateAnswer answer)
    {
        var correctOptionIds = examQuestion.Question.Options
            .Where(option => option.IsCorrect)
            .Select(option => option.Id)
            .OrderBy(id => id)
            .ToList();

        if (correctOptionIds.Count > 0)
        {
            var selectedOptionIds = ParseSelectedOptionIds(answer.SelectedOptionIds)
                .OrderBy(id => id)
                .ToList();
            var isCorrect = selectedOptionIds.SequenceEqual(correctOptionIds);

            return (
                isCorrect ? examQuestion.Points : 0,
                isCorrect
                    ? "AI draft: selected option set matches the answer key."
                    : "AI draft: selected option set does not match the answer key. Human review can override if needed.",
                0.98m
            );
        }

        if (string.IsNullOrWhiteSpace(answer.AnswerText))
        {
            return (0, "AI draft: no candidate answer was provided.", 0.95m);
        }

        var draftScore = Math.Max(1, (int)Math.Round(examQuestion.Points * 0.6m));
        return (
            Math.Min(draftScore, examQuestion.Points),
            "AI draft: written response has been scored provisionally. Review rubric alignment and adjust before final use.",
            0.62m
        );
    }

    private static List<Guid> ParseSelectedOptionIds(string? selectedOptionIds)
    {
        if (string.IsNullOrWhiteSpace(selectedOptionIds)) return new List<Guid>();

        try
        {
            return JsonSerializer.Deserialize<List<Guid>>(selectedOptionIds) ?? new List<Guid>();
        }
        catch
        {
            return new List<Guid>();
        }
    }

    private static void RecalculateAttempt(ExamAttempt attempt, Guid generatedBy)
    {
        var totalScore = attempt.GradingResults.Sum(grade => grade.PointsAwarded);
        var totalPoints = attempt.Exam.TotalPoints > 0
            ? attempt.Exam.TotalPoints
            : attempt.Exam.ExamQuestions.Sum(question => question.Points);
        var percentage = totalPoints > 0
            ? Math.Round((decimal)totalScore / totalPoints * 100, 2)
            : 0;

        attempt.TotalScore = totalScore;
        attempt.PercentageScore = percentage;
        attempt.CompletedAt ??= DateTime.UtcNow;
        attempt.Status = ExamAttemptStatus.Completed;
        attempt.UpdatedAt = DateTime.UtcNow;

        var overriddenCount = attempt.GradingResults.Count(grade => grade.IsOverridden == true);
        var detailedAnalysis = $"AI draft grading completed. Human overrides applied to {overriddenCount} question(s).";

        if (attempt.FinalReport == null)
        {
            attempt.FinalReport = new FinalReport
            {
                Id = Guid.NewGuid(),
                ExamAttemptId = attempt.Id,
                GeneratedBy = generatedBy,
                CreatedAt = DateTime.UtcNow
            };
        }

        attempt.FinalReport.TotalScore = totalScore;
        attempt.FinalReport.PercentageScore = percentage;
        attempt.FinalReport.HiringRecommendation = percentage switch
        {
            >= 85 => HiringRecommendation.StrongHire,
            >= 70 => HiringRecommendation.Hire,
            >= 55 => HiringRecommendation.HireWithTraining,
            >= 40 => HiringRecommendation.FurtherInterviewRequired,
            _ => HiringRecommendation.DoNotHire
        };
        attempt.FinalReport.IntegrityRiskLevel = RiskLevel.Low;
        attempt.FinalReport.DetailedAnalysis = detailedAnalysis;
        attempt.FinalReport.UpdatedAt = DateTime.UtcNow;
    }

    private static ExamResultDto MapToDto(ExamAttempt a) => new()
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
        } : null,
        Questions = a.Exam.ExamQuestions
            .OrderBy(eq => eq.DisplayOrder)
            .Select(eq =>
            {
                var answer = a.CandidateAnswers.FirstOrDefault(candidateAnswer => candidateAnswer.ExamQuestionId == eq.Id);
                var grade = answer == null
                    ? null
                    : a.GradingResults.FirstOrDefault(grading => grading.CandidateAnswerId == answer.Id);

                return new ExamResultQuestionDto
                {
                    ExamQuestionId = eq.Id,
                    DisplayOrder = eq.DisplayOrder,
                    QuestionText = eq.Question.QuestionText,
                    QuestionImageUrl = eq.Question.QuestionImageUrl,
                    QuestionType = eq.Question.QuestionType.ToString(),
                    Points = eq.Points,
                    AnswerText = answer?.AnswerText,
                    SelectedOptionIds = answer?.SelectedOptionIds,
                    TimeSpentSeconds = answer?.TimeSpentSeconds,
                    AnsweredAt = answer?.AnsweredAt,
                    PointsAwarded = grade?.PointsAwarded,
                    MaxPoints = grade?.MaxPoints,
                    AiFeedback = grade?.AiFeedback,
                    IsAutoGraded = grade?.IsAutoGraded ?? false,
                    IsOverridden = grade?.IsOverridden ?? false,
                    OverrideReason = grade?.OverrideReason,
                    Options = eq.Question.Options
                        .OrderBy(option => option.DisplayOrder)
                        .Select(option => new ExamResultOptionDto
                        {
                            Id = option.Id,
                            OptionText = option.OptionText,
                            IsCorrect = option.IsCorrect,
                            DisplayOrder = option.DisplayOrder
                        })
                        .ToList()
                };
            })
            .ToList()
    };
}
