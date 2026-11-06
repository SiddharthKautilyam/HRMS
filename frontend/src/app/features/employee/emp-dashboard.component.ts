import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDashboard } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';

interface Holiday {
  mon: string;
  day: string;
  name: string;
  type: string;
}

interface LeaveBalance {
  t: string;
  n: string;
  total: number;
  c: string;
}

interface Announcement {
  title: string;
  msg: string;
  type: string;
  time: string;
}

import { EmployeePunchWidgetComponent } from '../../shared/employee-punch-widget.component';

/** Employee dashboard — ported from pages/emp-dashboard.html. */
@Component({
  selector: 'app-emp-dashboard',
  imports: [CommonModule, RouterLink, IconDirective, EmployeePunchWidgetComponent],
  template: `
    <div class="hero-banner">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0">
        <div style="position: relative; flex-shrink: 0">
          <div class="profile-avatar" style="width: 48px; height: 48px; font-size: 1rem">{{ dashboard()?.initials ?? '—' }}</div>
          <div style="position: absolute; bottom: 1px; right: 1px; width: 10px; height: 10px; border-radius: 50%; background: var(--success); border: 2px solid var(--surface)"></div>
        </div>
        <div style="min-width: 0">
          <div class="hero-title">{{ greeting }}, {{ firstName() }} 👋</div>
          <div class="hero-sub">{{ dateStr }} - {{ dashboard()?.jobTitle ?? '—' }} - {{ dashboard()?.department ?? '—' }}</div>
          <div style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap">
            <span class="hero-status">{{ dashboard()?.status ?? '—' }}</span>
            <span style="font-size: 0.86rem; color: var(--muted)">Check-in: {{ dashboard()?.checkInLabel ?? '—' }}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
        <button routerLink="/me/leave" class="btn btn-outline btn-sm" style="justify-content: center">
          <span [appIcon]="'plus'"></span> Apply Leave
        </button>
      </div>
    </div>

    <!-- Live Punch Card -->
    <app-employee-punch-widget />

    <div class="grid-3" style="margin-bottom: 14px">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Attendance Overview</div>
            <div class="card-subtitle">Last 7 days</div>
          </div>
          <div style="display: flex; gap: 6px">
            <button class="btn btn-outline btn-sm">7D</button>
            <button class="btn btn-outline btn-sm">30D</button>
          </div>
        </div>
        <div class="card-body"><div style="position: relative; height: 180px"><canvas #attChart></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Working Hours</div>
            <div class="card-subtitle">This week</div>
          </div>
          <span class="badge badge-primary">{{ workingHours() }} hrs</span>
        </div>
        <div class="card-body"><div style="position: relative; height: 180px"><canvas #hoursChart></canvas></div></div>
      </div>
      @if (holidays().length > 0) {
        <div class="card">
          <div class="card-header"><div class="card-title">Upcoming Holidays</div></div>
          <div class="card-body" style="padding: 0; max-height: 280px; overflow-y: auto">
            @for (h of holidays(); track h.name + h.day) {
              <div class="holiday-item" style="padding: 6px 10px">
                <div class="holiday-date" style="width: 42px; height: 42px; border-radius: 5px">
                  <div class="holiday-day" style="font-size: 10px; line-height: 1">{{ h.mon }}</div>
                  <div class="holiday-num" style="font-size: 16px">{{ h.day }}</div>
                </div>
                <div style="flex: 1; min-width: 0">
                  <div style="font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px">{{ h.name }}</div>
                  <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: var(--p-soft); color: var(--p)">{{ h.type }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Leave Balance</div>
          <button class="btn btn-outline btn-sm" routerLink="/me/leave">Apply</button>
        </div>
        <div class="card-body">
          @if (leaveBalances().length > 0) {
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px">
              @for (l of leaveBalances(); track l.t) {
                <div class="leave-bal">
                  <div class="leave-bal-num" [style.color]="l.c">{{ l.n }}</div>
                  <div class="leave-bal-label">{{ l.t }}</div>
                  <div class="leave-bal-sub">{{ l.total ? 'of ' + l.total : '--' }}</div>
                  @if (l.total) {
                    <div class="progress" style="margin-top: 6px; height: 3px">
                      <div class="progress-bar" [style.width.%]="ratio(l)" [style.background]="l.c"></div>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @for (r of recentLeave(); track r.t + r.d) {
            <div style="display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border)">
              <div style="flex: 1">
                <div style="font-size: 14px; font-weight: 600">{{ r.t }}</div>
                <div style="font-size: 14px; color: var(--muted)">{{ r.d }}</div>
              </div>
              <span class="badge" [class]="r.s === 'Approved' ? 'badge-success' : 'badge-warning'">{{ r.s }}</span>
            </div>
          }
        </div>
      </div>
      @if (announcements().length > 0) {
        <div class="card">
          <div class="card-header">
            <div class="card-title">Announcements</div>
            <button class="btn btn-outline btn-sm" routerLink="/me/announcements">All</button>
          </div>
          <div class="card-body">
            @for (a of announcements(); track a.title) {
              <div class="ann-card" [class.warning]="a.type === 'warning'" [class.danger]="a.type === 'danger'" style="margin-bottom: 8px">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px">
                  <div style="font-size: 14px; font-weight: 700; color: var(--text)">{{ a.title }}</div>
                  <div style="font-size: 12px; color: var(--muted); white-space: nowrap; margin-left: 8px">{{ a.time }}</div>
                </div>
                <div style="font-size: 13px; color: var(--muted); line-height: 1.5">{{ a.msg }}</div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @media (max-width: 768px) {
        .grid-3 {
          grid-template-columns: 1fr !important;
        }
      }
    `,
  ],
})
export class EmpDashboardComponent implements OnInit, AfterViewInit {
  private readonly api = inject(ApiService);

  private readonly attCanvas = viewChild<ElementRef<HTMLCanvasElement>>('attChart');
  private readonly hoursCanvas = viewChild<ElementRef<HTMLCanvasElement>>('hoursChart');

  protected readonly greeting = EmpDashboardComponent.greet();
  protected readonly dateStr = EmpDashboardComponent.dateString();

  protected readonly dashboard = signal<EmployeeDashboard | null>(null);

  private attChart?: { destroy(): void };
  private hoursChart?: { destroy(): void };
  private renderScheduled = false;

  protected readonly firstName = computed(() => (this.dashboard()?.fullName ?? '').split(' ')[0]);
  protected readonly workingHours = computed(() => this.dashboard()?.workingHoursThisWeek ?? 0);

  protected readonly holidays = computed<Holiday[]>(() =>
    (this.dashboard()?.upcomingHolidays ?? []).map((h) => ({
      mon: new Date(h.date).toLocaleDateString('en-US', { month: 'short' }),
      day: h.date ? String(Number(h.date.slice(8, 10))) : '',
      name: h.name,
      type: h.type,
    })),
  );

  protected readonly leaveBalances = computed<LeaveBalance[]>(() =>
    (this.dashboard()?.leaveBalances ?? []).map((l) => ({
      t: l.type,
      n: String(l.balance),
      total: l.total,
      c: l.color,
    })),
  );

  protected readonly recentLeave = computed(() =>
    (this.dashboard()?.recentLeaves ?? []).map((r) => ({
      t: r.leaveType,
      d: r.dateLabel,
      s: r.status,
    })),
  );

  protected readonly announcements = computed<Announcement[]>(() =>
    (this.dashboard()?.announcements ?? []).map((a) => ({
      title: a.title,
      msg: a.message,
      type: a.severity.toLowerCase(),
      time: a.publishedLabel,
    })),
  );

  ngOnInit(): void {
    this.api.dashboardMe().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.scheduleRender();
      },
      error: () => {
        /* API offline — the dashboard stays empty. */
      },
    });
  }

  protected ratio(l: LeaveBalance): number {
    const n = parseFloat(l.n);
    return Number.isNaN(n) ? 0 : (n / l.total) * 100;
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
    const trend = this.dashboard()?.attendanceTrend ?? [];
    if (trend.length === 0) return;

    const P = '#2563eb';
    const labels = trend.map((t) => t.label);

    const att = this.attCanvas()?.nativeElement;
    if (att) {
      this.attChart?.destroy();
      this.attChart = new Chart(att, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Present', data: trend.map((t) => t.present), backgroundColor: P, borderRadius: 4, stack: 's' },
            { label: 'Absent', data: trend.map((t) => t.absent), backgroundColor: '#fca5a5', borderRadius: 4, stack: 's' },
            { label: 'Late', data: trend.map((t) => t.late), backgroundColor: '#fcd34d', borderRadius: 4, stack: 's' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, grid: { color: 'rgba(0,0,0,.04)' } },
          },
        },
      });
    }

    const hours = this.hoursCanvas()?.nativeElement;
    if (hours) {
      this.hoursChart?.destroy();
      this.hoursChart = new Chart(hours, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Hours',
              data: trend.map((t) => t.present),
              borderColor: P,
              backgroundColor: 'rgba(37,99,235,.12)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: P,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: (v) => `${v}h` } },
            x: { grid: { display: false } },
          },
        },
      });
    }
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
