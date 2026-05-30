using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class ExamAttempt
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public ExamAttemptStatus Status { get; set; } = ExamAttemptStatus.Pending;
    public DateTime? StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? TotalScore { get; set; }
    public decimal? PercentageScore { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Exam Exam { get; set; } = null!;
    public ICollection<CandidateAnswer> CandidateAnswers { get; set; } = new List<CandidateAnswer>();
    public ICollection<BehaviorLog> BehaviorLogs { get; set; } = new List<BehaviorLog>();
    public ICollection<GradingResult> GradingResults { get; set; } = new List<GradingResult>();
    public ICollection<AIMisuseReview> AIMisuseReviews { get; set; } = new List<AIMisuseReview>();
    public FinalReport? FinalReport { get; set; }
}
