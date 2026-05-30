namespace InnovaExam.Domain.Entities;

public class GradingResult
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public Guid CandidateAnswerId { get; set; }
    public int PointsAwarded { get; set; }
    public int MaxPoints { get; set; }
    public string? AiFeedback { get; set; }
    public string? RubricScores { get; set; } // JSON object with rubric scores
    public decimal? ConfidenceScore { get; set; }
    public bool IsAutoGraded { get; set; }
    public bool? IsOverridden { get; set; }
    public string? OverrideReason { get; set; }
    public Guid? OverriddenBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ExamAttempt ExamAttempt { get; set; } = null!;
    public CandidateAnswer CandidateAnswer { get; set; } = null!;
}
