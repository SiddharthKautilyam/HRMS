using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record PayrollRunDto(
    Guid Id,
    int Month,
    int Year,
    DateOnly PayDate,
    string Status,
    int EmployeeCount,
    decimal TotalGross,
    decimal TotalAllowances,
    decimal TotalDeductions,
    decimal TotalNet);

public sealed record PayslipDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Department,
    int Month,
    int Year,
    decimal BasicSalary,
    decimal Allowances,
    decimal Deductions,
    decimal NetPay,
    int WorkingDays,
    string Status,
    DateOnly PayDate,
    string? EmployeeCode = null);

public sealed record RunPayrollRequest(
    [Range(1, 12)] int Month,
    [Range(2000, 2100)] int Year,
    DateOnly PayDate,
    PaymentMode PaymentMethod);

public sealed record PayrollSummaryDto(
    decimal GrossPayroll,
    decimal TotalAllowances,
    decimal TotalDeductions,
    decimal NetPayable,
    int EmployeeCount);
