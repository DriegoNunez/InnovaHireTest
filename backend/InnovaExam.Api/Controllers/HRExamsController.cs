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

    [HttpGet]
    public async Task<IActionResult> GetExams([FromQuery] ExamFilterRequest filter, [FromQuery] InnovaExam.Application.Common.PagedRequest paging)
    {
        var exams = await _examService.GetPagedAsync(filter, paging);
        return Ok(exams);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetExam(Guid id)
    {
        var exam = await _examService.GetByIdAsync(id);
        if (exam == null)
            return NotFound();

        return Ok(exam);
    }

    [HttpGet("{id}/questions")]
    public async Task<IActionResult> GetExamPreviewQuestions(Guid id)
    {
        var exam = await _examService.GetByIdAsync(id);
        if (exam == null)
            return NotFound();

        var questions = await _examService.GetExamPreviewQuestionsAsync(id);
        return Ok(questions);
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateExam([FromBody] GenerateExamRequest dto)
    {
        var exam = await _examService.GenerateExamAsync(dto, Guid.Empty);
        return Ok(exam);
    }

    [HttpPost("{id}/invite")]
    public async Task<IActionResult> SendInvite(Guid id)
    {
        var sent = await _examService.SendInviteAsync(id);
        if (!sent)
            return NotFound();

        return NoContent();
    }
}
