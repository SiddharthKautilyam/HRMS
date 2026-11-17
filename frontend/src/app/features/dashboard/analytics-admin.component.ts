import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api/api.service';
import { AttendanceTrendPoint, DashboardStats } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { SessionService } from '../../core/services/session.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface Kpi {
  icon: string;
  label: string;
  val: string;
  change: string;
  up: boolean;
  color: string;
  bg: string;
  bars: number[];
}

interface ActivityItem {
  name: string;
  dept: string;
  action: string;
  date: string;
  status: string;
  id: string;
  code: string;
  grade: string;
  join: string;
  salary: string;
  email: string;
}

/** Super Admin analytics dashboard — ported from pages/dashboard-admin.html. */
@Component({
  selector: 'app-analytics-admin',
  imports: [CommonModule, IconDirective, SafeHtmlPipe],
  template: `
    <!-- Hero Banner -->
    <div class="hero-banner">
      <div>
        <div class="hero-title">
          {{ greeting }}, {{ userName() }}
          <svg style="display: inline; vertical-align: middle; margin-left: 4px" width="28" height="28" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M36.038 10.646c-.844-1.46-2.72-1.96-4.18-1.116-1.46.843-1.96 2.72-1.116 4.18l6.496 11.25-2.887 1.667-9.382-16.25c-.844-1.46-2.72-1.96-4.18-1.116-1.46.843-1.96 2.72-1.116 4.18l9.382 16.25-2.887 1.666-7.382-12.784c-.844-1.46-2.72-1.96-4.18-1.116-1.46.843-1.96 2.72-1.116 4.18l7.382 12.784-2.887 1.667-4.382-7.588c-.844-1.46-2.72-1.96-4.18-1.116-1.46.843-1.96 2.72-1.116 4.18l8.666 15.008c3.372 5.838 9.673 8.834 15.98 8.126l.06-.007c6.96-.78 12.44-6.22 13.274-13.174l1.426-11.752c.22-1.814-1.074-3.466-2.888-3.686-1.814-.22-3.466 1.074-3.686 2.888l-.714 5.882-2.998-5.192 5.498-9.52c.844-1.46.344-3.337-1.116-4.18-1.46-.844-3.337-.344-4.18 1.116l-3.498 6.058-3.498-6.058 1.748-3.027z" fill="#FBBF24" />
          </svg>
        </div>
        <div class="hero-sub">{{ dateStr }} · Company Overview &amp; Attendance Analytics.</div>
        <div style="display: flex; align-items: center; gap: 0">
          <span class="hero-status">All systems normal</span>
          <span class="hero-sync">Last sync: Just now</span>
        </div>
      </div>
      <div class="hero-btns">
        <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="go('/employees')">
          <span [appIcon]="'plus'"></span> Add Employee
        </button>
        <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="go('/reports')">
          <span [appIcon]="'reports'"></span> View Reports
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
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

    <!-- Charts Row -->
    <div class="grid-2" style="margin-bottom: 15px">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Attendance Overview</div>
            <div class="card-subtitle">Weekly breakdown · Present / Absent / Late</div>
          </div>
          <div style="display: flex; gap: 8px">
            <button class="btn btn-outline btn-sm" style="color: var(--p); border-color: var(--p)">This Week</button>
            <button class="btn btn-outline btn-sm" (click)="exportAttendanceTrend()">Export</button>
          </div>
        </div>
        <div class="card-body">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 14px; font-size: 0.8rem; font-weight: 600">
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--p); display: inline-block"></span>Present</span>
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--danger); display: inline-block"></span>Absent</span>
            <span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--warning); display: inline-block"></span>Late</span>
          </div>
          <div style="position: relative; height: 180px"><canvas #attendOverview></canvas></div>
          <div style="display: flex; justify-content: space-around; margin-top: 12px">
            @for (d of weekSummary(); track d.d) {
              <div style="text-align: center">
                <div style="font-size: 0.86rem; color: var(--p); font-weight: 700">{{ d.d }}</div>
                <div style="font-size: 0.86rem; font-weight: 700; color: var(--text); margin-top: 2px">{{ d.p }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Department Split</div>
            <div class="card-subtitle">By headcount</div>
          </div>
        </div>
        <div class="card-body">
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap">
            <div style="position: relative; width: 150px; height: 150px; flex-shrink: 0; margin: 0 auto">
              <canvas #deptChart></canvas>
            </div>
            <div style="flex: 1; min-width: 120px">
              @for (d of depts(); track d; let i = $index) {
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 7px">
                  <div [style.background]="deptColors[i]" style="width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0"></div>
                  <div style="font-size: 13px; color: var(--text); flex: 1">{{ d }}</div>
                  <div style="font-size: 13px; font-weight: 700">{{ deptData()[i] }}</div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity Table -->
    <div class="card">
      <div class="card-header" style="margin-bottom: 16px">
        <div>
          <div class="card-title">Recent Employee Activity</div>
          <div class="card-subtitle">Latest HR events</div>
        </div>
        <button class="btn btn-outline btn-sm" (click)="go('/employees')">View All</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Action</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of activity(); track r.id) {
              <tr>
                <td>
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar">{{ initials(r.name) }}</div>
                    <div>
                      <div style="font-weight: 600; font-size: 13px">{{ r.name }}</div>
                      <div style="font-size: 13px; color: var(--muted)">{{ r.code || r.id }}</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge badge-primary">{{ r.dept }}</span></td>
                <td>{{ r.action }}</td>
                <td style="color: var(--muted)">{{ r.date }}</td>
                <td><span class="badge" [class]="activityClass(r.status)">{{ r.status }}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="viewProfile(r)">
                    <span [appIcon]="'eye'"></span>
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
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        gap: 12px;
        flex-wrap: wrap;
        box-shadow: var(--shadow);
      }
      .hero-title {
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 2px;
      }
      .hero-sub {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 7px;
      }
      .hero-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.86rem;
        font-weight: 600;
        color: var(--success);
        background: var(--success-soft);
        border: 1px solid #86efac;
        padding: 2px 7px;
        border-radius: 20px;
      }
      .hero-status::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--success);
        flex-shrink: 0;
      }
      .hero-sync {
        font-size: 0.86rem;
        color: var(--light);
        margin-left: 8px;
      }
      .hero-btns {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      .kpi-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .kpi-new .kn-icon {
        margin-bottom: 0;
      }
      .kpi-new .kn-val {
        font-size: 1.6rem;
        font-weight: 700;
      }
      .kpi-new .kn-change {
        font-size: 0.86rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .sparkbar {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 24px;
        margin-top: 8px;
      }
      .sparkbar span {
        flex: 1;
        border-radius: 2px 2px 0 0;
        min-width: 4px;
        opacity: 0.4;
      }
      .sparkbar span.last {
        opacity: 1;
      }
      @media (max-width: 1200px) {
        .grid-4 {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .hero-btns {
          width: 100%;
        }
        .hero-btns .btn {
          flex: 1;
          justify-content: center;
        }
      }
    `,
  ],
})
export class AnalyticsAdminComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  private readonly attendCanvas = viewChild<ElementRef<HTMLCanvasElement>>('attendOverview');
  private readonly deptCanvas = viewChild<ElementRef<HTMLCanvasElement>>('deptChart');

  private attendChart?: { destroy(): void };
  private deptChartInstance?: { destroy(): void };
  private renderScheduled = false;

  protected readonly greeting = AnalyticsAdminComponent.greet();
  protected readonly dateStr = AnalyticsAdminComponent.dateString();
  protected readonly userName = computed(() => this.session.user()?.name || 'Administrator');

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly trend = signal<AttendanceTrendPoint[]>([]);
  protected readonly depts = signal<string[]>([]);
  protected readonly deptData = signal<number[]>([]);
  protected readonly deptColors = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
  protected readonly activity = signal<ActivityItem[]>([]);

  protected readonly weekSummary = computed(() =>
    this.trend().map((point) => ({ d: point.label, p: `${point.present}` })),
  );

  protected readonly kpis = computed<Kpi[]>(() => {
    const stats = this.stats();
    if (!stats) return [];

    const trendBars = this.trend().length > 0 ? this.trend().map((t) => t.present) : [0];
    const deptBars = this.deptData().length > 0 ? this.deptData() : [0];

    return [
      { icon: ICON.employees, label: 'Total Employees', val: stats.totalEmployees.toLocaleString(), change: `${stats.newJoinersThisMonth} new this month`, up: true, color: 'var(--p)', bg: 'var(--p-soft)', bars: trendBars },
      { icon: ICON.company, label: 'Departments', val: `${stats.departments}`, change: `${stats.onLeaveToday} on leave today`, up: true, color: 'var(--purple)', bg: 'var(--purple-soft)', bars: deptBars },
      { icon: ICON.payroll, label: 'Monthly Payroll Cost', val: this.compactMoney(stats.monthlyPayroll), change: `Attendance ${stats.attendanceRate}%`, up: true, color: 'var(--success)', bg: 'var(--success-soft)', bars: trendBars },
      { icon: ICON.employees, label: 'Pending Approvals', val: `${stats.pendingApprovals}`, change: `${stats.resignations} resignations`, up: false, color: 'var(--warning)', bg: 'var(--warning-soft)', bars: trendBars },
    ];
  });

  ngOnInit(): void {
    this.api.dashboardStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.scheduleRender();
      },
      error: () => {
        /* API offline — no KPI data. */
      },
    });

    this.api.attendanceTrend().subscribe({
      next: (trend) => {
        this.trend.set(trend);
        this.scheduleRender();
      },
      error: () => {
        /* API offline — no trend data. */
      },
    });

    this.api.departmentHeadcount().subscribe({
      next: (rows) => {
        this.depts.set(rows.map((r) => r.department));
        this.deptData.set(rows.map((r) => r.count));
        this.scheduleRender();
      },
      error: () => {
        /* API offline — no department data. */
      },
    });

    this.api.recentActivity(6).subscribe({
      next: (rows) =>
        this.activity.set(
          rows.map((r) => ({
            name: r.employeeName,
            dept: r.department,
            action: r.action,
            date: r.dateLabel,
            status: r.status,
            id: r.employeeId || r.employeeCode,
            code: r.employeeCode,
            grade: '',
            join: '',
            salary: '',
            email: '',
          })),
        ),
      error: () => {
        /* API offline — no activity data. */
      },
    });
  }

  private compactMoney(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    setTimeout(() => {
      this.renderScheduled = false;
      this.renderCharts();
    });
  }

  private renderCharts(): void {
    const attend = this.attendCanvas()?.nativeElement;
    const trend = this.trend();

    if (attend && trend.length > 0) {
      this.attendChart?.destroy();
      this.attendChart = new Chart(attend, {
        type: 'bar',
        data: {
          labels: trend.map((t) => t.label),
          datasets: [
            { label: 'Present', data: trend.map((t) => t.present), backgroundColor: '#2563eb', borderRadius: 4, stack: 's' },
            { label: 'Absent', data: trend.map((t) => t.absent), backgroundColor: '#fca5a5', borderRadius: 4, stack: 's' },
            { label: 'Late', data: trend.map((t) => t.late), backgroundColor: '#fcd34d', borderRadius: 4, stack: 's' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: '#2563eb', font: { weight: 'bold' } } },
            y: { stacked: true, grid: { color: 'rgba(0,0,0,.04)' } },
          },
        },
      });
    }

    const dept = this.deptCanvas()?.nativeElement;
    const labels = this.depts();

    if (dept && labels.length > 0) {
      this.deptChartInstance?.destroy();
      this.deptChartInstance = new Chart(dept, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: this.deptData(), backgroundColor: this.deptColors, borderWidth: 0, hoverOffset: 4 }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '72%', plugins: { legend: { display: false } } },
      });
    }
  }

  protected exportAttendanceTrend(): void {
    const trend = this.trend();
    if (trend.length === 0) return;
    const headers = ['Day', 'Present', 'Absent', 'Late'];
    const rows = trend.map((t) => [t.label, t.present, t.absent, t.late]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_trend_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected barHeight(value: number, bars: number[]): number {
    const max = Math.max(...bars, 1);
    return Math.max(15, Math.round((value / max) * 100));
  }

  protected initials(name?: string): string {
    if (!name || name === '—') return 'HR';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'HR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  protected activityClass(status: string): string {
    return `badge-${status === 'Active' ? 'success' : status === 'Pending' ? 'warning' : status === 'Alert' ? 'danger' : 'info'}`;
  }

  protected viewProfile(r: ActivityItem): void {
    void this.router.navigate(['/employee-profile'], { queryParams: { id: r.id } });
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

/** Small subset of ICONS used by the KPI cards. */
const ICON = {
  employees: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  company: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  payroll: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
};
