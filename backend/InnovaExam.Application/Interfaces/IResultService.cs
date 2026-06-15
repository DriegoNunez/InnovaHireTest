using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Results;

namespace InnovaExam.Application.Interfaces;

public interface IResultService
{
    Task<ExamResultDto?> GetByAttemptIdAsync(Guid attemptId, CancellationToken cancellationToken = default);
    Task<PagedResult<ExamResultDto>> GetPagedAsync(ResultFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default);
    Task<ExamResultDto?> GenerateAiGradesAsync(Guid attemptId, CancellationToken cancellationToken = default);
    Task<ExamResultDto?> UpdateQuestionGradeAsync(Guid attemptId, UpdateQuestionGradeRequest request, Guid reviewedBy, CancellationToken cancellationToken = default);
}
