using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

/// <summary>A payroll cycle (one month) covering all employees.</summary>
public class PayrollRun : BaseEntity
{
    public int Month { get; set; }

    public int Year { get; set; }

    public DateOnly PayDate { get; set; }

    public PaymentMode PaymentMethod { get; set; } = PaymentMode.BankTransfer;

    public PayrollStatus Status { get; set; } = PayrollStatus.Processing;

    public int EmployeeCount { get; set; }

    public decimal TotalGross { get; set; }

    public decimal TotalAllowances { get; set; }

    public decimal TotalDeductions { get; set; }

    public decimal TotalNet { get; set; }

    public DateTime? ProcessedAtUtc { get; set; }

    public ICollection<Payslip> Payslips { get; set; } = new List<Payslip>();
}

/// <summary>Per-employee payslip generated for a payroll run.</summary>
public class Payslip : BaseEntity
{
    public Guid PayrollRunId { get; set; }

    public PayrollRun? PayrollRun { get; set; }

    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public int Month { get; set; }

    public int Year { get; set; }

    public decimal BasicSalary { get; set; }

    public decimal Allowances { get; set; }

    public decimal Deductions { get; set; }

    public decimal NetPay { get; set; }

    public int WorkingDays { get; set; }

    public PayrollStatus Status { get; set; } = PayrollStatus.Processed;

    public DateOnly PayDate { get; set; }
}
