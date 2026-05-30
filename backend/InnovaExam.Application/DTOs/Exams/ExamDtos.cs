using InnovaExam.Domain.Enums;

namespace InnovaExam.Application.DTOs.Exams;

public class ExamDto
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    public string CandidateName { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public ExperienceLevel ExperienceLevel { get; set; }
    public int TotalQuestions { get; set; }
    public int TotalPoints { get; set; }
    public int TimeLimitMinutes { get; set; }
    public string? InvitationUrl { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? LatestAttemptStatus { get; set; }
}

public class GenerateExamRequest
{
    public Guid CandidateId { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public int TimeLimitMinutes { get; set; } = 120;
    public int? TotalQuestions { get; set; }
}

public class SendInviteRequest
{
    public Guid ExamId { get; set; }
}

public class ExamFilterRequest
{
    public Guid? CandidateId { get; set; }
    public ExperienceLevel? ExperienceLevel { get; set; }
    public string? SearchText { get; set; }
}

// DTOs for the candidate-facing exam endpoints
public class ExamSessionDto
{
    public Guid ExamId { get; set; }
    public Guid AttemptId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public int TimeLimitMinutes { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class ExamQuestionDto
{
    public Guid ExamQuestionId { get; set; }
    public int DisplayOrder { get; set; }
    public int Points { get; set; }
    public QuestionType QuestionType { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public int TimeLimitSeconds { get; set; }
    public ICollection<ExamQuestionOptionDto> Options { get; set; } = new List<ExamQuestionOptionDto>();
}

public class ExamQuestionOptionDto
{
    public Guid Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

public class SubmitAnswerRequest
{
    public Guid ExamQuestionId { get; set; }
    public string? AnswerText { get; set; }
    public ICollection<Guid>? SelectedOptionIds { get; set; }
    public int? TimeSpentSeconds { get; set; }
    public bool IsMarkedForReview { get; set; }
}

public class BehaviorLogRequest
{
    public string EventType { get; set; } = string.Empty;
    public string? EventData { get; set; }
}

public class ValidateTokenResponse
{
    public bool IsValid { get; set; }
    public Guid? ExamId { get; set; }
    public string? CandidateName { get; set; }
    public string? ExamTitle { get; set; }
    public bool HasExistingAttempt { get; set; }
}
