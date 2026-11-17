using System.Globalization;
using System.Text;

namespace Hrms.Application.Services;

public sealed record PayslipPdfData(
    string CompanyName,
    string CompanyAddress,
    string Trn,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string Designation,
    string BankName,
    string AccountNumber,
    int Month,
    int Year,
    DateOnly PayDate,
    int WorkingDays,
    decimal BasicSalary,
    decimal Allowances,
    decimal Deductions,
    decimal NetPay,
    string Status,
    decimal LoanAdvance = 0m,
    decimal OvertimePay = 0m
);

public static class PayslipPdfBuilder
{
    private static readonly CultureInfo Culture = CultureInfo.InvariantCulture;

    public static byte[] Build(PayslipPdfData data)
    {
        var content = new StringBuilder();

        // 1. Dark Blue Header Banner (top of page: y=740 to 842)
        AppendRect(content, 0, 740, 595.28f, 102, 0.118f, 0.227f, 0.541f);

        // Header Text
        var compName = Sanitize(string.IsNullOrWhiteSpace(data.CompanyName) ? "HRNEXUS CORP" : data.CompanyName.ToUpperInvariant());
        AppendText(content, compName, 40, 800, "F2", 18, 1f, 1f, 1f);

        var compSub = Sanitize($"{data.CompanyAddress ?? "Dubai Internet City, Dubai, UAE"} - TRN: {data.Trn ?? "100-2495-9201"}");
        AppendText(content, compSub, 40, 782, "F1", 8.5f, 0.85f, 0.88f, 0.95f);

        // Right side header
        AppendText(content, "PAYSLIP", 450, 800, "F2", 16, 1f, 1f, 1f);
        var monthYear = $"{Culture.DateTimeFormat.GetMonthName(data.Month)} {data.Year}";
        AppendText(content, $"Period: {Sanitize(monthYear)}", 450, 782, "F1", 8.5f, 0.85f, 0.88f, 0.95f);
        AppendText(content, $"Pay Date: {data.PayDate:yyyy-MM-dd}", 450, 768, "F1", 8.5f, 0.85f, 0.88f, 0.95f);

        // 2. Employee Details Card (y=625 to 720, height 95)
        AppendRect(content, 40, 625, 515.28f, 95, 0.973f, 0.98f, 0.988f, true, 0.88f, 0.91f, 0.94f);

        // Section Titles
        AppendText(content, "EMPLOYEE INFORMATION", 55, 698, "F2", 9.5f, 0.12f, 0.16f, 0.23f);
        AppendText(content, "PAYMENT & ATTENDANCE", 320, 698, "F2", 9.5f, 0.12f, 0.16f, 0.23f);

        // Left Column: Employee details
        AppendText(content, "Employee Name:", 55, 678, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        AppendText(content, Sanitize(data.EmployeeName), 145, 678, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        AppendText(content, "Employee ID:", 55, 660, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        AppendText(content, Sanitize(data.EmployeeCode), 145, 660, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        AppendText(content, "Department:", 55, 642, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        AppendText(content, Sanitize(data.Department), 145, 642, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        // Right Column: Payment & Attendance
        AppendText(content, "Designation:", 320, 678, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        AppendText(content, Sanitize(data.Designation), 405, 678, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        AppendText(content, "Bank / Account:", 320, 660, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        var bankText = string.IsNullOrWhiteSpace(data.BankName) ? "Direct Bank Transfer (WPS)" : $"{data.BankName} - {data.AccountNumber}";
        AppendText(content, Sanitize(bankText), 405, 660, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        AppendText(content, "Days Worked:", 320, 642, "F1", 8.5f, 0.45f, 0.50f, 0.58f);
        AppendText(content, $"{data.WorkingDays} Days (Full Month)", 405, 642, "F2", 8.5f, 0.08f, 0.10f, 0.15f);

        // 3. Earnings & Deductions Tables Header (y=580)
        // Earnings Table Header (left: 40 to 290)
        AppendRect(content, 40, 580, 250, 24, 0.945f, 0.961f, 0.976f);
        AppendText(content, "EARNINGS", 55, 588, "F2", 9f, 0.086f, 0.455f, 0.224f);
        AppendText(content, "AMOUNT ($)", 220, 588, "F2", 9f, 0.086f, 0.455f, 0.224f);

        // Deductions Table Header (right: 305 to 555)
        AppendRect(content, 305, 580, 250.28f, 24, 0.945f, 0.961f, 0.976f);
        AppendText(content, "DEDUCTIONS", 320, 588, "F2", 9f, 0.725f, 0.110f, 0.110f);
        AppendText(content, "AMOUNT ($)", 485, 588, "F2", 9f, 0.725f, 0.110f, 0.110f);

        // Table Rows
        var earnings = new List<(string Label, decimal Amount)>
        {
            ("Basic Salary", data.BasicSalary),
            ("Fixed Allowances (Housing & Transport)", data.Allowances),
        };
        if (data.OvertimePay > 0)
        {
            earnings.Add(("Overtime Pay", data.OvertimePay));
        }

        var deductions = new List<(string Label, decimal Amount)>
        {
            ("Statutory & Standard Deductions", data.Deductions),
        };
        if (data.LoanAdvance > 0)
        {
            deductions.Add(("Loan / Salary Advance EMI", data.LoanAdvance));
        }

        var maxRows = Math.Max(earnings.Count, deductions.Count);
        float currentY = 556;

        for (int i = 0; i < maxRows; i++)
        {
            // Divider lines
            AppendLine(content, 40, currentY - 6, 290, currentY - 6, 0.92f, 0.94f, 0.96f);
            AppendLine(content, 305, currentY - 6, 555.28f, currentY - 6, 0.92f, 0.94f, 0.96f);

            if (i < earnings.Count)
            {
                var (lbl, amt) = earnings[i];
                AppendText(content, Sanitize(lbl), 55, currentY, "F1", 8.5f, 0.25f, 0.30f, 0.36f);
                AppendText(content, $"${amt:N2}", 225, currentY, "F2", 8.5f, 0.08f, 0.10f, 0.15f);
            }

            if (i < deductions.Count)
            {
                var (lbl, amt) = deductions[i];
                AppendText(content, Sanitize(lbl), 320, currentY, "F1", 8.5f, 0.25f, 0.30f, 0.36f);
                AppendText(content, $"${amt:N2}", 490, currentY, "F2", 8.5f, 0.725f, 0.110f, 0.110f);
            }

            currentY -= 24;
        }

        // Totals Rows
        currentY -= 6;
        AppendRect(content, 40, currentY, 250, 22, 0.965f, 0.975f, 0.985f);
        AppendText(content, "Total Gross Earnings", 55, currentY + 6, "F2", 8.5f, 0.086f, 0.455f, 0.224f);
        var totalEarnings = data.BasicSalary + data.Allowances + data.OvertimePay;
        AppendText(content, $"${totalEarnings:N2}", 225, currentY + 6, "F2", 8.5f, 0.086f, 0.455f, 0.224f);

        AppendRect(content, 305, currentY, 250.28f, 22, 0.965f, 0.975f, 0.985f);
        AppendText(content, "Total Deductions", 320, currentY + 6, "F2", 8.5f, 0.725f, 0.110f, 0.110f);
        var totalDeductions = data.Deductions + data.LoanAdvance;
        AppendText(content, $"${totalDeductions:N2}", 490, currentY + 6, "F2", 8.5f, 0.725f, 0.110f, 0.110f);

        // 4. Net Payable Box (Highlighted Banner)
        float netY = currentY - 70;
        AppendRect(content, 40, netY, 515.28f, 52, 0.933f, 0.949f, 0.996f, true, 0.388f, 0.400f, 0.945f, 1.5f);

        AppendText(content, "TOTAL NET TAKE-HOME PAY", 55, netY + 30, "F2", 11f, 0.118f, 0.106f, 0.290f);
        AppendText(content, $"Status: {Sanitize(data.Status).ToUpperInvariant()} - Electronic Payment via Bank WPS", 55, netY + 14, "F1", 8f, 0.310f, 0.275f, 0.898f);

        var netStr = $"${data.NetPay:N2}";
        AppendText(content, netStr, 440, netY + 20, "F2", 18f, 0.263f, 0.220f, 0.792f);

        // 5. Notes & Sign-off
        float notesY = netY - 50;
        AppendText(content, "PAYROLL REMARKS & NOTES", 40, notesY, "F2", 8.5f, 0.30f, 0.35f, 0.42f);
        AppendText(content, "1. This payslip is electronically generated by HRNexus HRMS and does not require a physical signature.", 40, notesY - 16, "F1", 8f, 0.45f, 0.50f, 0.58f);
        AppendText(content, "2. For discrepancies in attendance days, allowances, or loan deductions, please contact HR Operations.", 40, notesY - 28, "F1", 8f, 0.45f, 0.50f, 0.58f);

        // 6. Footer Divider & Copyright
        AppendLine(content, 40, 60, 555.28f, 60, 0.88f, 0.91f, 0.94f);
        AppendText(content, $"Generated by HRNexus Enterprise HRMS - Confidential - Page 1 of 1", 40, 46, "F1", 7.5f, 0.55f, 0.60f, 0.68f);
        AppendText(content, $"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC", 480, 46, "F1", 7.5f, 0.55f, 0.60f, 0.68f);

        // Assemble standard PDF 1.4 document
        return AssemblePdfDocument(content.ToString());
    }

    private static void AppendRect(
        StringBuilder sb,
        float x,
        float y,
        float width,
        float height,
        float r,
        float g,
        float b,
        bool stroke = false,
        float strokeR = 0,
        float strokeG = 0,
        float strokeB = 0,
        float lineWidth = 1)
    {
        sb.Append(string.Create(Culture, $"{r:F3} {g:F3} {b:F3} rg\n"));
        if (stroke)
        {
            sb.Append(string.Create(Culture, $"{strokeR:F3} {strokeG:F3} {strokeB:F3} RG\n"));
            sb.Append(string.Create(Culture, $"{lineWidth:F1} w\n"));
            sb.Append(string.Create(Culture, $"{x:F2} {y:F2} {width:F2} {height:F2} re B\n"));
        }
        else
        {
            sb.Append(string.Create(Culture, $"{x:F2} {y:F2} {width:F2} {height:F2} re f\n"));
        }
    }

    private static void AppendLine(
        StringBuilder sb,
        float x1,
        float y1,
        float x2,
        float y2,
        float r,
        float g,
        float b,
        float width = 0.5f)
    {
        sb.Append(string.Create(Culture, $"{r:F3} {g:F3} {b:F3} RG\n"));
        sb.Append(string.Create(Culture, $"{width:F1} w\n"));
        sb.Append(string.Create(Culture, $"{x1:F2} {y1:F2} m {x2:F2} {y2:F2} l S\n"));
    }

    private static void AppendText(
        StringBuilder sb,
        string text,
        float x,
        float y,
        string fontKey,
        float fontSize,
        float r,
        float g,
        float b)
    {
        sb.Append("BT\n");
        sb.Append($"/{fontKey} {fontSize.ToString("F1", Culture)} Tf\n");
        sb.Append(string.Create(Culture, $"{r:F3} {g:F3} {b:F3} rg\n"));
        sb.Append(string.Create(Culture, $"{x:F2} {y:F2} Td\n"));
        sb.Append($"({EscapePdf(text)}) Tj\n");
        sb.Append("ET\n");
    }

    private static string Sanitize(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        return text
            .Replace('—', '-')
            .Replace('–', '-')
            .Replace('·', '-')
            .Replace('’', '\'')
            .Replace('“', '"')
            .Replace('”', '"');
    }

    private static string EscapePdf(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var c in text)
        {
            if (c == '\\') sb.Append(@"\\");
            else if (c == '(') sb.Append(@"\(");
            else if (c == ')') sb.Append(@"\)");
            else if (c < 32 || c > 126) sb.Append(' ');
            else sb.Append(c);
        }
        return sb.ToString();
    }

    private static byte[] AssemblePdfDocument(string streamContent)
    {
        var streamBytes = Encoding.ASCII.GetBytes(streamContent);
        var sb = new StringBuilder();

        sb.Append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

        var offsets = new long[8];

        offsets[1] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

        offsets[2] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

        offsets[3] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n");

        offsets[4] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

        offsets[5] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

        offsets[6] = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append($"6 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n");
        sb.Append(streamContent);
        sb.Append("\nendstream\nendobj\n");

        var xrefOffset = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append("xref\n0 7\n");
        sb.Append("0000000000 65535 f \n");
        for (int i = 1; i <= 6; i++)
        {
            sb.Append($"{offsets[i]:D10} 00000 n \n");
        }
        sb.Append("trailer\n<< /Size 7 /Root 1 0 R >>\n");
        sb.Append($"startxref\n{xrefOffset}\n%%EOF\n");

        return Encoding.ASCII.GetBytes(sb.ToString());
    }
}
