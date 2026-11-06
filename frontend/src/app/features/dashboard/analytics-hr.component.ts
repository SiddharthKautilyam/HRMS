import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api/api.service';
import {
  AttendanceTrendPoint,
  DashboardStats,
  ExpoAlert,
  PayrollSummary,
  PendingApproval,
} from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface Approval {
  name: string;
  type: string;
  detail: string;
}

interface DocAlert {
  name: string;
  doc: string;
  exp: string;
  days: number;
  s: 'Critical' | 'Warning' | 'OK';
}

/** HR Manager analytics dashboard — ported from pages/dashboard-hr.html. */
@Component({
  selector: 'app-analytics-hr',
  imports: [CommonModule, IconDirective, SafeHtmlPipe],
  template: `
    <div class="hero-banner">
      <div>
        <div class="hero-title">{{ greeting }}, HR Manager 👋</div>
        <div class="hero-sub">{{ dateStr }} &nbsp;-&nbsp; Employee activities, approvals &amp; payroll summary.</div>
        <div style="display: flex; align-items: center; gap: 0">
          <span class="hero-status">All Systems Normal</span>
          <span class="hero-sync">Last Sync: 2 Min Ago</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px; flex-shrink: 0">
        <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="go('/approvals')">
          <span [appIcon]="'approvals'"></span> Approvals
        </button>
        <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="go('/onboarding')">
          <span [appIcon]="'plus'"></span> Add Employee
        </button>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 15px">
      @for (k of kpis(); track k.label) {
        <div class="kpi-new">
          <div class="kpi-header">
            <div class="kn-icon" [style.background]="k.bg" [style.color]="k.color" [innerHTML]="k.icon | safeHtml"></div>
            <div>
              <div class="kn-val">{{ k.val }}</div>
              <div class="kn-label">{{ k.label }}</div>
            </div>
          </div>
          <div class="kn-change" [class.up]="k.up" [class.down]="!k.up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline [attr.points]="k.up ? '18 15 12 9 6 15' : '6 9 12 15 18 9'" />
            </svg>
            {{ k.change }}
          </div>
          <div class="sparkbar">
            @for (bar of k.bars; track $index) {
              <span
                [style.height.%]="barHeight(bar, k.bars)"
                [style.background]="k.color"
                [class.last]="$index === k.bars.length - 1"
              ></span>
            }
          </div>
        </div>
      }
    </div>

    <div class="grid-2" style="margin-bottom: 15px">
      <div class="card">
        <div class="card-header" style="margin-bottom: 4px">
          <div>
            <div class="card-title">Pending Approvals</div>
            <div class="card-subtitle">Requires your action</div>
          </div>
          <span class="badge badge-danger">18 Pending</span>
        </div>
        <div class="card-body" style="padding-top: 8px">
          @for (a of approvals(); track a.id) {
            <div class="appr-row-hr">
              <div class="avatar-placeholder avatar" style="flex-shrink: 0">{{ initials(a.employeeName) }}</div>
              <div class="appr-info">
                <div class="appr-name">{{ a.employeeName }}</div>
                <div class="appr-detail">{{ a.type }} - {{ a.detail }}</div>
              </div>
              <div class="appr-btns">
                <button class="btn btn-success btn-sm" data-tooltip="Approve" (click)="toast.show('Approved!')">
                  <span [appIcon]="'check'"></span>
                </button>
                <button class="btn btn-danger btn-sm" data-tooltip="Reject" (click)="toast.show('Rejected', 'danger')">
                  <span [appIcon]="'x'"></span>
                </button>
              </div>
            </div>
          }
          <button class="btn btn-outline w-full" style="margin-top: 12px" (click)="go('/approvals')">View All Approvals</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="margin-bottom: 4px">
          <div>
            <div class="card-title">Payroll Summary</div>
            <div class="card-subtitle">January 2025</div>
          </div>
          <span class="badge badge-warning">Processing</span>
        </div>
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
            <div style="position: relative; width: 130px; height: 130px; flex-shrink: 0; margin: 0 auto">
              <canvas #payrollPie></canvas>
            </div>
            <div style="flex: 1; min-width: 160px">
              @for (r of payrollRows(); track r.label) {
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border)">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <div [style.background]="r.color" style="width: 8px; height: 8px; border-radius: 2px"></div>
                    <span style="font-size: 13px; color: var(--muted)">{{ r.label }}</span>
                  </div>
                  <span style="font-size: 0.9rem; font-weight: 700">{{ r.val }}</span>
                </div>
              }
            </div>
          </div>
          <button class="btn btn-primary w-full mt-4" (click)="go('/payroll')">Process Payroll</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px">
        <div><div class="card-title">Document Expiry Alerts</div></div>
        <button class="btn btn-outline btn-sm" (click)="go('/documents')">Manage Docs</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Document</th>
              <th class="doc-col-exp">Expiry</th>
              <th class="doc-col-days">Days Left</th>
              <th class="doc-col-status">Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of docAlerts(); track r.document + r.employeeName) {
              <tr>
                <td class="doc-emp-cell">
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar-sm">{{ initials(r.employeeName) }}</div>
                    <span style="font-weight: 600; font-size: 13px">{{ r.employeeName }}</span>
                  </div>
                </td>
                <td class="doc-doc-cell">{{ r.document }}</td>
                <td class="doc-col-exp">{{ r.expiryLabel }}</td>
                <td class="doc-col-days"><span style="font-weight: 700; color: var(--text)">{{ r.daysLeft }}d</span></td>
                <td class="doc-col-status">
                  <span class="badge" [class]="docClass(r.status)">{{ r.status }}</span>
                </td>
                <td>
                  <button class="btn btn-ghost btn-sm" data-tooltip="Notify" (click)="toast.show('Reminder sent!')">
                    <span [appIcon]="'bell'"></span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .hero-banner {
        background: var(--p-soft);
        border-radius: 16px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 15px;
        gap: 12px;
        flex-wrap: wrap;
        border: 1px solid var(--p-mid);
      }
      .hero-title {
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 4px;
      }
      .hero-sub {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 12px;
      }
      .hero-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.86rem;
        font-weight: 600;
        color: var(--success);
        background: var(--success-soft);
        border: 1px solid rgba(34, 197, 94, 0.3);
        padding: 4px 10px;
        border-radius: 20px;
      }
      .hero-status::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
        flex-shrink: 0;
      }
      .hero-sync {
        font-size: 0.86rem;
        color: var(--light);
        margin-left: 12px;
      }
      .kpi-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .kpi-new .kn-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }
      .kpi-new .kn-change {
        font-size: 0.86rem;
        margin-bottom: 12px;
        gap: 4px;
      }
      .sparkbar {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 32px;
      }
      .sparkbar span {
        flex: 1;
        border-radius: 3px 3px 0 0;
        min-width: 6px;
        opacity: 0.45;
      }
      .sparkbar span.last {
        opacity: 1;
      }
      .appr-row-hr {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 11px 0;
        border-bottom: 1px solid var(--border);
      }
      .appr-info {
        flex: 1;
        min-width: 0;
      }
      .appr-name {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .appr-detail {
        font-size: 13px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .appr-btns {
        display: flex;
        gap: 5px;
        flex-shrink: 0;
      }
      .doc-emp-cell,
      .doc-doc-cell {
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        .doc-col-exp,
        .doc-col-status {
          display: none;
        }
        .hero-sync {
          margin-left: 6px;
        }
        .hero-banner {
          padding: 14px;
        }
      }
    `,
  ],
})
export class AnalyticsHrComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  private readonly payrollCanvas = viewChild<ElementRef<HTMLCanvasElement>>('payrollPie');

  private payrollChart?: { destroy(): void };
  private renderScheduled = false;

  protected readonly greeting = AnalyticsHrComponent.greet();
  protected readonly dateStr = AnalyticsHrComponent.dateString();

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly trend = signal<AttendanceTrendPoint[]>([]);
  protected readonly approvals = signal<PendingApproval[]>([]);
  protected readonly payroll = signal<PayrollSummary | null>(null);
  protected readonly docAlerts = signal<ExpoAlert[]>([]);

  protected readonly kpis = computed(() => {
    const stats = this.stats();
    if (!stats) return [];

    const bars = this.trend().length > 0 ? this.trend().map((t) => t.present) : [1];

    return [
      { icon: ICON.employees, label: 'Total Employees', val: stats.totalEmployees.toLocaleString(), change: `${stats.newJoinersThisMonth} New This Month`, up: true, color: 'var(--p)', bg: 'var(--p-soft)', bars },
      { icon: ICON.leave, label: 'On Leave Today', val: `${stats.onLeaveToday}`, change: `${stats.pendingApprovals} Pending Approval`, up: false, color: 'var(--warning)', bg: 'var(--warning-soft)', bars },
      { icon: ICON.onboarding, label: 'Attendance Rate', val: `${stats.attendanceRate}%`, change: 'Latest working day', up: true, color: 'var(--success)', bg: 'var(--success-soft)', bars },
      { icon: ICON.approvals, label: 'Resignations', val: `${stats.resignations}`, change: 'In Notice Period', up: false, color: 'var(--danger)', bg: 'var(--danger-soft)', bars },
    ];
  });

  protected readonly payrollRows = computed(() => {
    const payroll = this.payroll();
    if (!payroll) return [];

    return [
      { label: 'Gross Salary', val: this.money(payroll.grossPayroll), color: 'var(--p)' },
      { label: 'Allowances', val: this.money(payroll.totalAllowances), color: 'var(--light)' },
      { label: 'Deductions', val: this.money(payroll.totalDeductions), color: 'var(--danger)' },
      { label: 'Net Payable', val: this.money(payroll.netPayable), color: 'var(--warning)' },
    ];
  });

  ngOnInit(): void {
    this.api.dashboardStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => {
        /* API offline — no KPI data. */
      },
    });

    this.api.attendanceTrend().subscribe({
      next: (trend) => this.trend.set(trend),
      error: () => {
        /* API offline — no trend data. */
      },
    });

    this.api.pendingApprovals(3).subscribe({
      next: (approvals) => this.approvals.set(approvals),
      error: () => {
        /* API offline — no approval data. */
      },
    });

    this.api.payrollSummary().subscribe({
      next: (payroll) => {
        this.payroll.set(payroll);
        this.scheduleRender();
      },
      error: () => {
        /* API offline — no payroll data. */
      },
    });

    this.api.documentAlerts(4).subscribe({
      next: (alerts) => this.docAlerts.set(alerts),
      error: () => {
        /* API offline — no document alerts. */
      },
    });
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    setTimeout(() => {
      this.renderScheduled = false;
      this.renderChart();
    });
  }

  private renderChart(): void {
    const canvas = this.payrollCanvas()?.nativeElement;
    const payroll = this.payroll();

    if (!canvas || !payroll) return;

    this.payrollChart?.destroy();
    this.payrollChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Basic', 'Allowances', 'Deductions'],
        datasets: [
          {
            data: [payroll.grossPayroll, payroll.totalAllowances, payroll.totalDeductions],
            backgroundColor: ['#2563eb', '#60a5fa', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: true, cutout: '68%', plugins: { legend: { display: false } } },
    });
  }

  private money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  protected barHeight(value: number, bars: number[]): number {
    return Math.round((value / Math.max(...bars)) * 100);
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected docClass(status: string): string {
    return `badge-${status === 'Critical' || status === 'Expired' ? 'danger' : status === 'Warning' ? 'warning' : 'success'}`;
  }

  protected go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  private static greet(): string {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  }

  private static dateString(): string {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
}

const ICON = {
  employees: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  leave: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  onboarding: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  approvals: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
};
