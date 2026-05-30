namespace InnovaExam.Domain.Entities;

public class CandidateAnswer
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public Guid ExamQuestionId { get; set; }
    public string? AnswerText { get; set; }
    public string? SelectedOptionIds { get; set; } // JSON array of selected option GUIDs
    public int? TimeSpentSeconds { get; set; }
    public bool IsMarkedForReview { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ExamAttempt ExamAttempt { get; set; } = null!;
    public ExamQuestion ExamQuestion { get; set; } = null!;
}
