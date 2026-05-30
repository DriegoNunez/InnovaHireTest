using InnovaExam.Domain.Interfaces;
using InnovaExam.Infrastructure.Data;

namespace InnovaExam.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly InnovaExamDbContext _context;

    public UnitOfWork(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
