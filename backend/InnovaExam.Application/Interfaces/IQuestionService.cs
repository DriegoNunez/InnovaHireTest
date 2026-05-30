using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Questions;

namespace InnovaExam.Application.Interfaces;

public interface IQuestionService
{
    Task<QuestionDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PagedResult<QuestionDto>> GetPagedAsync(QuestionFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default);
    Task<QuestionDto> CreateAsync(CreateQuestionRequest request, Guid createdBy, CancellationToken cancellationToken = default);
    Task<QuestionDto?> UpdateAsync(Guid id, UpdateQuestionRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<QuestionCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default);
}

public class QuestionCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int QuestionCount { get; set; }
}
