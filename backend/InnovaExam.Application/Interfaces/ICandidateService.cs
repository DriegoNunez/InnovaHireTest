using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Candidates;

namespace InnovaExam.Application.Interfaces;

public interface ICandidateService
{
    Task<CandidateDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PagedResult<CandidateDto>> GetPagedAsync(CandidateFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default);
    Task<CandidateDto> CreateAsync(CreateCandidateRequest request, Guid createdBy, CancellationToken cancellationToken = default);
    Task<CandidateDto?> UpdateAsync(Guid id, UpdateCandidateRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
