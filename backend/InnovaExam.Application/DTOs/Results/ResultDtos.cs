using InnovaExam.Domain.Enums;

namespace InnovaExam.Application.DTOs.Results;

public class ExamResultDto
{
    public Guid ExamAttemptId { get; set; }
    public Guid ExamId { get; set; }
    public string CandidateName { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string ExamTitle { get; set; } = string.Empty;
    public ExamAttemptStatus Status { get; set; }
    public int? TotalScore { get; set; }
    public decimal? PercentageScore { get; set; }
    public int TotalPoints { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public FinalReportDto? FinalReport { get; set; }
    public ICollection<ExamResultQuestionDto> Questions { get; set; } = new List<ExamResultQuestionDto>();
}

public class ExamResultQuestionDto
{
    public Guid ExamQuestionId { get; set; }
    public int DisplayOrder { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public string QuestionType { get; set; } = string.Empty;
    public int Points { get; set; }
    public string? AnswerText { get; set; }
    public string? SelectedOptionIds { get; set; }
    public int? TimeSpentSeconds { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public int? PointsAwarded { get; set; }
    public int? MaxPoints { get; set; }
    public string? AiFeedback { get; set; }
    public bool IsAutoGraded { get; set; }
    public bool IsOverridden { get; set; }
    public string? OverrideReason { get; set; }
    public ICollection<ExamResultOptionDto> Options { get; set; } = new List<ExamResultOptionDto>();
}

public class ExamResultOptionDto
{
    public Guid Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

public class FinalReportDto
{
    public Guid Id { get; set; }
    public int TotalScore { get; set; }
    public decimal PercentageScore { get; set; }
    public HiringRecommendation HiringRecommendation { get; set; }
    public RiskLevel IntegrityRiskLevel { get; set; }
    public string? StrengthAreas { get; set; }
    public string? WeaknessAreas { get; set; }
    public string? DetailedAnalysis { get; set; }
    public string? CategoryScores { get; set; }
    public string? ReportPdfUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ResultFilterRequest
{
    public Guid? CandidateId { get; set; }
    public ExamAttemptStatus? Status { get; set; }
    public bool CompletedOnly { get; set; }
    public string? SearchText { get; set; }
}

public class UpdateQuestionGradeRequest
{
    public Guid ExamQuestionId { get; set; }
    public int PointsAwarded { get; set; }
    public string? Feedback { get; set; }
    public string? OverrideReason { get; set; }
}
