using InnovaExam.Application.DTOs.Exams;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/hr/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,HR")]
public class ExamsController : ControllerBase
{
    private readonly IExamService _examService;

    public ExamsController(IExamService examService)
    {
        _examService = examService;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateExam([FromBody] GenerateExamRequest dto)
    {
        var exam = await _examService.GenerateExamAsync(dto, Guid.Empty);
        return Ok(exam);
    }
}
