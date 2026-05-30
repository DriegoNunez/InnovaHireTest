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
    public string? SearchText { get; set; }
}
