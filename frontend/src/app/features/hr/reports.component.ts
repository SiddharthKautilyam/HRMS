import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface PayrollReport {
  m: string;
  emp: number;
  gross: string;
  allow: string;
  ded: string;
  net: string;
  status: string;
}

interface AttendReport {
  n: string;
  dept: string;
  present: number;
  absent: number;
  late: number;
  avg: string;
  rating: string;
}

interface LeaveReport {
  n: string;
  annual: number;
  sick: number;
  emergency: number;
  unpaid: number;
  balance: number;
}

interface OtReport {
  n: string;
  hours: number;
  rate: string;
  amount: string;
  status: string;
}

/** Reports — ported from pages/reports.html. */
@Component({
  selector: 'app-reports',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">Reports</div>
        <div class="page-subtitle">Analytics and data exports</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-outline btn-sm" (click)="exportActiveTab()" [title]="'Export ' + activeTabLabel() + ' to Excel'">
          <span [appIcon]="'download'"></span> Export {{ activeTabLabel() }}
        </button>
        <button class="btn btn-primary btn-sm" (click)="exportAllToExcel()" title="Export all reports (Payroll, Attendance, Leave, Overtime) to an Excel workbook">
          <span [appIcon]="'download'"></span> Export All
        </button>
      </div>
    </div>

    <div style="margin-bottom: 20px">
      <div class="tabs mb-4">
        @for (t of tabs; track t.id) {
          <button class="tab-btn" [class.active]="tab() === t.id" (click)="tab.set(t.id)" style="display: flex; align-items: center; gap: 8px">
            <span [appIcon]="t.icon"></span> {{ t.label }}
          </button>
        }
      </div>

      @if (tab() === 'payroll') {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Payroll Summary Report</div>
            <div>
              <app-select [options]="yearOptions()" [value]="year()" (valueChange)="year.set($event)" width="150px" />
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Employees</th>
                  <th class="rpt-col-hide">Gross</th>
                  <th class="rpt-col-hide">Allowances</th>
                  <th class="rpt-col-hide">Deductions</th>
                  <th>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of filteredPayrollRows(); track r.m) {
                  <tr>
                    <td style="font-weight: 700">{{ r.m }}</td>
                    <td>{{ r.emp }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.gross }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.allow }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.ded }}</td>
                    <td style="font-weight: 800; color: var(--p)">{{ r.net }}</td>
                    <td><span class="badge badge-success">{{ r.status }}</span></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--muted);">
                      No payroll records found for {{ year() === 'all' ? 'any period' : year() }}.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (tab() === 'attendance') {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Attendance Report · {{ reportPeriod() }}</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th class="rpt-col-hide">Department</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th class="rpt-col-hide">Late</th>
                  <th class="rpt-col-hide">Avg Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of attendRows(); track r.n) {
                  <tr>
                    <td style="font-weight: 600">{{ r.n }}</td>
                    <td class="rpt-col-hide"><span class="badge badge-info">{{ r.dept }}</span></td>
                    <td style="color: var(--text); font-weight: 700">{{ r.present }}</td>
                    <td style="color: var(--text); font-weight: 700">{{ r.absent }}</td>
                    <td class="rpt-col-hide" style="color: var(--text); font-weight: 700">{{ r.late }}</td>
                    <td class="rpt-col-hide" style="font-weight: 600">{{ r.avg }}</td>
                    <td><span class="badge" [class]="ratingClass(r.rating)">{{ r.rating }}</span></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--muted);">
                      No attendance records found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (tab() === 'leave') {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Leave Report · {{ reportPeriod() }}</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th class="rpt-col-hide">Annual Used</th>
                  <th class="rpt-col-hide">Sick Used</th>
                  <th class="rpt-col-hide">Emergency</th>
                  <th class="rpt-col-hide">Unpaid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                @for (r of leaveRows(); track r.n) {
                  <tr>
                    <td style="font-weight: 600">{{ r.n }}</td>
                    <td class="rpt-col-hide">{{ r.annual }}</td>
                    <td class="rpt-col-hide">{{ r.sick }}</td>
                    <td class="rpt-col-hide">{{ r.emergency }}</td>
                    <td class="rpt-col-hide">{{ r.unpaid }}</td>
                    <td style="font-weight: 700; color: var(--p)">{{ r.balance }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 24px; color: var(--muted);">
                      No leave records found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (tab() === 'overtime') {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Overtime Report · {{ reportPeriod() }}</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>OT Hours</th>
                  <th class="rpt-col-hide">OT Rate</th>
                  <th>OT Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of otRows(); track r.n) {
                  <tr>
                    <td style="font-weight: 600">{{ r.n }}</td>
                    <td>{{ r.hours }}</td>
                    <td class="rpt-col-hide">{{ r.rate }}</td>
                    <td style="font-weight: 700; color: var(--p)">{{ r.amount }}</td>
                    <td><span class="badge" [class]="r.status === 'Approved' ? 'badge-success' : 'badge-warning'">{{ r.status }}</span></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: var(--muted);">
                      No overtime records found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      thead th,
      tbody td {
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        .rpt-col-hide {
          display: none;
        }
      }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly tabs = [
    { id: 'payroll', label: 'Payroll', icon: 'money' },
    { id: 'attendance', label: 'Attendance', icon: 'clock' },
    { id: 'leave', label: 'Leave', icon: 'leave' },
    { id: 'overtime', label: 'Overtime', icon: 'clock' },
  ] as const;

  protected readonly tab = signal<'payroll' | 'attendance' | 'leave' | 'overtime'>('payroll');

  protected readonly activeTabLabel = computed(() => {
    const current = this.tabs.find((t) => t.id === this.tab());
    return current ? current.label : 'Report';
  });

  protected readonly year = signal('2026');

  protected readonly payrollRows = signal<PayrollReport[]>([]);

  protected readonly yearOptions = computed<SelectOption[]>(() => {
    const yearSet = new Set<string>();
    const curYear = new Date().getFullYear();
    yearSet.add(curYear.toString());
    yearSet.add((curYear - 1).toString());
    yearSet.add((curYear - 2).toString());

    for (const r of this.payrollRows()) {
      const match = r.m.match(/\b(20\d{2})\b/);
      if (match) {
        yearSet.add(match[1]);
      }
    }

    const sorted = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
    return [
      { v: 'all', l: 'All Years' },
      ...sorted.map((y) => ({ v: y, l: y })),
    ];
  });

  protected readonly filteredPayrollRows = computed(() => {
    const selectedYear = this.year();
    const rows = this.payrollRows();
    if (!selectedYear || selectedYear === 'all') {
      return rows;
    }
    return rows.filter((r) => r.m.includes(selectedYear));
  });

  protected readonly reportPeriod = computed(() => {
    const y = this.year();
    return !y || y === 'all' ? 'All Time' : y;
  });

  protected readonly attendRows = signal<AttendReport[]>([]);

  protected readonly leaveRows = signal<LeaveReport[]>([]);

  protected readonly otRows = signal<OtReport[]>([]);

  ngOnInit(): void {
    this.api.reportsPayroll().subscribe({
      next: (rows) => {
        this.payrollRows.set(
          rows.map((r) => ({
            m: r.month,
            emp: r.employees,
            gross: this.money(r.gross),
            allow: this.money(r.allowances),
            ded: this.money(r.deductions),
            net: this.money(r.net),
            status: r.status,
          })),
        );
        // If there are records and current year isn't matching any, default to the year of the latest record
        if (rows.length > 0) {
          const match = rows[0].month.match(/\b(20\d{2})\b/);
          if (match && this.year() !== match[1] && !rows.some((r) => r.month.includes(this.year()))) {
            this.year.set(match[1]);
          }
        }
      },
      error: () => {
        /* API offline — keep demo report rows. */
      },
    });

    this.api.reportsAttendance().subscribe({
      next: (rows) =>
        this.attendRows.set(
          rows.map((r) => ({
            n: r.employee,
            dept: r.department,
            present: r.present,
            absent: r.absent,
            late: r.late,
            avg: `${r.averageHours.toFixed(1)}h`,
            rating: r.rating,
          })),
        ),
      error: () => {
        /* API offline — keep demo report rows. */
      },
    });

    this.api.reportsLeave().subscribe({
      next: (rows) =>
        this.leaveRows.set(
          rows.map((r) => ({
            n: r.employee,
            annual: r.annualUsed,
            sick: r.sickUsed,
            emergency: r.emergencyUsed,
            unpaid: r.unpaidUsed,
            balance: r.balance,
          })),
        ),
      error: () => {
        /* API offline — keep demo report rows. */
      },
    });

    this.api.reportsOvertime().subscribe({
      next: (rows) =>
        this.otRows.set(
          rows.map((r) => ({
            n: r.employee,
            hours: r.hours,
            rate: r.rate,
            amount: this.money(r.amount),
            status: r.status,
          })),
        ),
      error: () => {
        /* API offline — keep demo report rows. */
      },
    });
  }

  protected exportActiveTab(): void {
    const current = this.tab();
    const period = this.reportPeriod();

    if (current === 'payroll') {
      const rows = this.filteredPayrollRows();
      if (rows.length === 0) {
        this.toast.show('No payroll records to export for this period', 'warning');
        return;
      }
      this.downloadExcelWorkbook(
        [
          {
            name: 'Payroll Summary',
            headers: ['Month', 'Employees', 'Gross', 'Allowances', 'Deductions', 'Net', 'Status'],
            rows: rows.map((r) => [r.m, r.emp, r.gross, r.allow, r.ded, r.net, r.status]),
          },
        ],
        `HRMS_Payroll_Report_${period}`
      );
    } else if (current === 'attendance') {
      const rows = this.attendRows();
      if (rows.length === 0) {
        this.toast.show('No attendance records to export', 'warning');
        return;
      }
      this.downloadExcelWorkbook(
        [
          {
            name: 'Attendance Report',
            headers: ['Employee', 'Department', 'Present', 'Absent', 'Late', 'Avg Hours', 'Rating'],
            rows: rows.map((r) => [r.n, r.dept, r.present, r.absent, r.late, r.avg, r.rating]),
          },
        ],
        `HRMS_Attendance_Report_${period}`
      );
    } else if (current === 'leave') {
      const rows = this.leaveRows();
      if (rows.length === 0) {
        this.toast.show('No leave records to export', 'warning');
        return;
      }
      this.downloadExcelWorkbook(
        [
          {
            name: 'Leave Report',
            headers: ['Employee', 'Annual Used', 'Sick Used', 'Emergency Used', 'Unpaid Used', 'Balance'],
            rows: rows.map((r) => [r.n, r.annual, r.sick, r.emergency, r.unpaid, r.balance]),
          },
        ],
        `HRMS_Leave_Report_${period}`
      );
    } else if (current === 'overtime') {
      const rows = this.otRows();
      if (rows.length === 0) {
        this.toast.show('No overtime records to export', 'warning');
        return;
      }
      this.downloadExcelWorkbook(
        [
          {
            name: 'Overtime Report',
            headers: ['Employee', 'OT Hours', 'OT Rate', 'OT Amount', 'Status'],
            rows: rows.map((r) => [r.n, r.hours, r.rate, r.amount, r.status]),
          },
        ],
        `HRMS_Overtime_Report_${period}`
      );
    }

    this.toast.show(`${this.activeTabLabel()} exported to Excel successfully`, 'success');
  }

  protected exportAllToExcel(): void {
    const period = this.reportPeriod();
    const payrollData = this.filteredPayrollRows().length > 0 ? this.filteredPayrollRows() : this.payrollRows();

    const sheets = [
      {
        name: 'Payroll Summary',
        headers: ['Month', 'Employees', 'Gross', 'Allowances', 'Deductions', 'Net', 'Status'],
        rows: payrollData.map((r) => [r.m, r.emp, r.gross, r.allow, r.ded, r.net, r.status]),
      },
      {
        name: 'Attendance Report',
        headers: ['Employee', 'Department', 'Present', 'Absent', 'Late', 'Avg Hours', 'Rating'],
        rows: this.attendRows().map((r) => [r.n, r.dept, r.present, r.absent, r.late, r.avg, r.rating]),
      },
      {
        name: 'Leave Report',
        headers: ['Employee', 'Annual Used', 'Sick Used', 'Emergency Used', 'Unpaid Used', 'Balance'],
        rows: this.leaveRows().map((r) => [r.n, r.annual, r.sick, r.emergency, r.unpaid, r.balance]),
      },
      {
        name: 'Overtime Report',
        headers: ['Employee', 'OT Hours', 'OT Rate', 'OT Amount', 'Status'],
        rows: this.otRows().map((r) => [r.n, r.hours, r.rate, r.amount, r.status]),
      },
    ];

    this.downloadExcelWorkbook(sheets, `HRMS_All_Reports_${period}`);
    this.toast.show('All reports exported to Excel successfully', 'success');
  }

  private escapeXml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildWorksheetXml(name: string, headers: string[], rows: (string | number)[][]): string {
    const safeSheetName = this.escapeXml(name.replace(/[\[\]*?:/\\]/g, '').slice(0, 31));
    let xml = `  <Worksheet ss:Name="${safeSheetName}">\n`;
    xml += '    <Table>\n';

    // Header Row
    xml += '      <Row ss:Height="24">\n';
    for (const h of headers) {
      xml += `        <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${this.escapeXml(h)}</Data></Cell>\n`;
    }
    xml += '      </Row>\n';

    // Data Rows
    for (const row of rows) {
      xml += '      <Row ss:Height="20">\n';
      for (const val of row) {
        const isNum = typeof val === 'number';
        const type = isNum ? 'Number' : 'String';
        xml += `        <Cell ss:StyleID="DataStyle"><Data ss:Type="${type}">${this.escapeXml(val)}</Data></Cell>\n`;
      }
      xml += '      </Row>\n';
    }

    xml += '    </Table>\n';
    xml += '  </Worksheet>\n';
    return xml;
  }

  private downloadExcelWorkbook(
    sheets: { name: string; headers: string[]; rows: (string | number)[][] }[],
    baseFilename: string
  ): void {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    xml += '  <Styles>\n';
    xml += '    <Style ss:ID="Default" ss:Name="Normal">\n';
    xml += '      <Alignment ss:Vertical="Center"/>\n';
    xml += '      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>\n';
    xml += '    </Style>\n';
    xml += '    <Style ss:ID="HeaderStyle">\n';
    xml += '      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
    xml += '      <Borders>\n';
    xml += '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n';
    xml += '      </Borders>\n';
    xml += '      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>\n';
    xml += '      <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>\n';
    xml += '    </Style>\n';
    xml += '    <Style ss:ID="DataStyle">\n';
    xml += '      <Alignment ss:Vertical="Center"/>\n';
    xml += '      <Borders>\n';
    xml += '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>\n';
    xml += '      </Borders>\n';
    xml += '      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>\n';
    xml += '    </Style>\n';
    xml += '  </Styles>\n';

    for (const sheet of sheets) {
      xml += this.buildWorksheetXml(sheet.name, sheet.headers, sheet.rows);
    }

    xml += '</Workbook>';

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFilename}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  protected ratingClass(rating: string): string {
    return `badge-${rating === 'Excellent' ? 'success' : rating === 'Good' ? 'primary' : rating === 'Average' ? 'warning' : 'danger'}`;
  }
}
