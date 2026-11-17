using System.Text;
using Hrms.Application.Services;
using Xunit;

namespace Hrms.Tests;

public class PayrollDownloadTests
{
    [Fact]
    public void PayslipPdfBuilder_GeneratesValidPdfBytes()
    {
        var data = new PayslipPdfData(
            CompanyName: "HRNexus Corp",
            CompanyAddress: "Dubai Internet City, Dubai, UAE",
            Trn: "100-2495-9201",
            EmployeeName: "Sarah Jenkins",
            EmployeeCode: "EMP-001",
            Department: "Engineering",
            Designation: "Senior Fullstack Engineer",
            BankName: "First Abu Dhabi Bank",
            AccountNumber: "AE0703312345678901234",
            Month: 11,
            Year: 2026,
            PayDate: new DateOnly(2026, 11, 30),
            WorkingDays: 22,
            BasicSalary: 8500m,
            Allowances: 2125m,
            Deductions: 250m,
            NetPay: 10375m,
            Status: "Processed"
        );

        var bytes = PayslipPdfBuilder.Build(data);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 200, "PDF should not be empty");

        var text = Encoding.ASCII.GetString(bytes);
        Assert.StartsWith("%PDF-1.4", text);
        Assert.Contains("%%EOF", text);
        Assert.Contains("HRNEXUS CORP", text);
        Assert.Contains("EMP-001", text);
        Assert.Contains("Sarah Jenkins", text);
    }
}
