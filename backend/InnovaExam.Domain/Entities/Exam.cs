using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class Exam
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ExperienceLevel ExperienceLevel { get; set; }
    public int TotalQuestions { get; set; }
    public int TotalPoints { get; set; }
    public int TimeLimitMinutes { get; set; }
    public string? AccessToken { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public string? InvitationUrl { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Candidate Candidate { get; set; } = null!;
    public ICollection<ExamQuestion> ExamQuestions { get; set; } = new List<ExamQuestion>();
    public ICollection<ExamAttempt> ExamAttempts { get; set; } = new List<ExamAttempt>();
    public ICollection<EmailLog> EmailLogs { get; set; } = new List<EmailLog>();
}
