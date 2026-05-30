using InnovaExam.Domain.Enums;

namespace InnovaExam.Application.DTOs.Questions;

public class QuestionDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public QuestionType QuestionType { get; set; }
    public DifficultyLevel DifficultyLevel { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int TimeLimitSeconds { get; set; }
    public QuestionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public ICollection<QuestionOptionDto> Options { get; set; } = new List<QuestionOptionDto>();
    public ICollection<QuestionRubricDto> Rubrics { get; set; } = new List<QuestionRubricDto>();
}

public class QuestionOptionDto
{
    public Guid Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

public class QuestionRubricDto
{
    public Guid Id { get; set; }
    public string Criteria { get; set; } = string.Empty;
    public int MaxPoints { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateQuestionRequest
{
    public Guid CategoryId { get; set; }
    public QuestionType QuestionType { get; set; }
    public DifficultyLevel DifficultyLevel { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int TimeLimitSeconds { get; set; }
    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;
    public ICollection<CreateQuestionOptionRequest> Options { get; set; } = new List<CreateQuestionOptionRequest>();
    public ICollection<CreateQuestionRubricRequest> Rubrics { get; set; } = new List<CreateQuestionRubricRequest>();
}

public class CreateQuestionOptionRequest
{
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateQuestionRubricRequest
{
    public string Criteria { get; set; } = string.Empty;
    public int MaxPoints { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpdateQuestionRequest
{
    public Guid CategoryId { get; set; }
    public QuestionType QuestionType { get; set; }
    public DifficultyLevel DifficultyLevel { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int TimeLimitSeconds { get; set; }
    public QuestionStatus Status { get; set; }
    public ICollection<CreateQuestionOptionRequest> Options { get; set; } = new List<CreateQuestionOptionRequest>();
    public ICollection<CreateQuestionRubricRequest> Rubrics { get; set; } = new List<CreateQuestionRubricRequest>();
}

public class QuestionFilterRequest
{
    public Guid? CategoryId { get; set; }
    public QuestionType? QuestionType { get; set; }
    public DifficultyLevel? DifficultyLevel { get; set; }
    public ExperienceLevel? ExperienceLevel { get; set; }
    public QuestionStatus? Status { get; set; }
    public string? SearchText { get; set; }
}
