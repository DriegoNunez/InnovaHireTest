using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class AIMisuseReview
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public Guid CandidateAnswerId { get; set; }
    public RiskLevel RiskLevel { get; set; }
    public decimal ConfidenceScore { get; set; }
    public string? Indicators { get; set; } // JSON array of detected indicators
    public string? AiAnalysis { get; set; }
    public bool? IsConfirmed { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }

    // Navigation properties
    public ExamAttempt ExamAttempt { get; set; } = null!;
    public CandidateAnswer CandidateAnswer { get; set; } = null!;
}
