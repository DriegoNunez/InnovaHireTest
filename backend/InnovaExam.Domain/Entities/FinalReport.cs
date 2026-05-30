using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class FinalReport
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public int TotalScore { get; set; }
    public decimal PercentageScore { get; set; }
    public HiringRecommendation HiringRecommendation { get; set; }
    public RiskLevel IntegrityRiskLevel { get; set; }
    public string? StrengthAreas { get; set; } // JSON array
    public string? WeaknessAreas { get; set; } // JSON array
    public string? DetailedAnalysis { get; set; }
    public string? CategoryScores { get; set; } // JSON object with category-wise scores
    public string? ReportPdfUrl { get; set; }
    public Guid GeneratedBy { get; set; } // System or user who triggered generation
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ExamAttempt ExamAttempt { get; set; } = null!;
}
