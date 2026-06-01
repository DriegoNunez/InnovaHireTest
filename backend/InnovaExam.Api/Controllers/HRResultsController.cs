using InnovaExam.Application.DTOs.Results;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/hr/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,HR")]
public class ResultsController : ControllerBase
{
    private readonly IResultService _resultService;

    public ResultsController(IResultService resultService)
    {
        _resultService = resultService;
    }

    [HttpGet]
    public async Task<IActionResult> GetResults([FromQuery] ResultFilterRequest filter, [FromQuery] InnovaExam.Application.Common.PagedRequest paging)
    {
        var results = await _resultService.GetPagedAsync(filter, paging);
        return Ok(results);
    }

    [HttpGet("{attemptId}")]
    public async Task<IActionResult> GetResult(Guid attemptId)
    {
        var result = await _resultService.GetByAttemptIdAsync(attemptId);
        if (result == null)
            return NotFound();

        return Ok(result);
    }
}
