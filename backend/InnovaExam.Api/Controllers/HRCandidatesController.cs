using InnovaExam.Application.DTOs.Candidates;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/hr/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,HR")]
public class CandidatesController : ControllerBase
{
    private readonly ICandidateService _candidateService;

    public CandidatesController(ICandidateService candidateService)
    {
        _candidateService = candidateService;
    }

    [HttpGet]
    public async Task<IActionResult> GetCandidates([FromQuery] CandidateFilterRequest filter, [FromQuery] InnovaExam.Application.Common.PagedRequest paging)
    {
        var candidates = await _candidateService.GetPagedAsync(filter, paging);
        return Ok(candidates);
    }

    [HttpPost]
    public async Task<IActionResult> CreateCandidate([FromBody] CreateCandidateRequest dto)
    {
        var candidate = await _candidateService.CreateAsync(dto, Guid.Empty);
        return Ok(candidate);
    }
}
