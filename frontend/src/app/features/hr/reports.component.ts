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
      <button class="btn btn-primary btn-sm" (click)="toast.show('Exporting report...')"><span [appIcon]="'download'"></span> Export All</button>
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
            <div style="display: flex; gap: 8px">
              <app-select [options]="yearOptions" [value]="year()" (valueChange)="year.set($event)" width="150px" />
              <button class="btn btn-outline btn-sm" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span> Download</button>
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
                @for (r of payrollRows(); track r.m) {
                  <tr>
                    <td style="font-weight: 700">{{ r.m }}</td>
                    <td>{{ r.emp }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.gross }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.allow }}</td>
                    <td class="rpt-col-hide" style="color: var(--text)">{{ r.ded }}</td>
                    <td style="font-weight: 800; color: var(--p)">{{ r.net }}</td>
                    <td><span class="badge badge-success">{{ r.status }}</span></td>
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
            <button class="btn btn-outline btn-sm" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span> Download</button>
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
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (tab() === 'leave') {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Leave Report · 2025</div>
            <button class="btn btn-outline btn-sm" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span> Download</button>
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
            <button class="btn btn-outline btn-sm" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span> Download</button>
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

  protected readonly yearOptions: SelectOption[] = [
    { v: '2025', l: '2025' },
    { v: '2024', l: '2024' },
  ];
  protected readonly year = signal('2025');

  protected readonly reportPeriod = computed(() => this.year() || 'All Time');

  protected readonly payrollRows = signal<PayrollReport[]>([]);

  protected readonly attendRows = signal<AttendReport[]>([]);

  protected readonly leaveRows = signal<LeaveReport[]>([]);

  protected readonly otRows = signal<OtReport[]>([]);

  ngOnInit(): void {
    this.api.reportsPayroll().subscribe({
      next: (rows) =>
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
        ),
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

  private money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  protected ratingClass(rating: string): string {
    return `badge-${rating === 'Excellent' ? 'success' : rating === 'Good' ? 'primary' : rating === 'Average' ? 'warning' : 'danger'}`;
  }
}
