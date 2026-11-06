import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api/api.service';
import { AttendanceRecord, EmployeeDashboard, MonthlyMusterDay } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

interface LogRow {
  d: string;
  day: string;
  in: string;
  out: string;
  brk: string;
  hrs: string;
  s: string;
}

interface CalendarDay {
  d: number;
  weekend: boolean;
  late: boolean;
  absent: boolean;
}

/** My Attendance — ported from pages/emp-attendance.html. */
@Component({
  selector: 'app-emp-attendance',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">My Attendance</div>
        <div class="page-subtitle">Track your daily check-in and attendance history</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom: 15px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Attendance Trend</div>
          <div class="card-subtitle">This week</div>
        </div>
        <div class="card-body"><div style="position: relative; height: 180px"><canvas #trendChart></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header" style="margin-bottom: 12px">
          <div class="card-title">Monthly Summary</div>
          <select class="form-control form-select" style="width: 140px" [value]="monthLabel()">
            @for (month of monthOptions(); track month) {
              <option [value]="month">{{ month }}</option>
            }
          </select>
        </div>
        <div class="card-body" style="padding-top: 0">
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; margin-bottom: 8px">
            @for (d of weekDays; track $index) {
              <div style="font-size: 12px; font-weight: 700; color: var(--muted); padding: 4px 0">{{ d }}</div>
            }
            @for (blank of blanks(); track $index) {
              <div></div>
            }
            @for (day of calendar(); track day.d) {
              <div
                style="padding: 5px 2px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer"
                [style.background]="dayBg(day)"
                [style.color]="dayColor(day)"
              >
                {{ day.d }}
              </div>
            }
          </div>
          <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px">
            <span style="display: flex; align-items: center; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 2px; background: rgba(16,185,129,.5); display: inline-block"></span>Present</span>
            <span style="display: flex; align-items: center; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 2px; background: rgba(239,68,68,.5); display: inline-block"></span>Absent</span>
            <span style="display: flex; align-items: center; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 2px; background: rgba(245,158,11,.5); display: inline-block"></span>Late</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px">
        <div class="card-title">Attendance Log</div>
        <div style="display: flex; gap: 8px">
          <input class="form-control" type="month" style="width: 160px" value="2025-01" />
          <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="exportCsv()">
            <span [appIcon]="'download'"></span> Export
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Break</th>
              <th>Work Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (r of log(); track r.d) {
              <tr>
                <td style="font-weight: 600">{{ r.d }}</td>
                <td style="color: var(--text)">{{ r.day }}</td>
                <td>{{ r.in }}</td>
                <td>{{ r.out }}</td>
                <td style="color: var(--warning); font-weight: 600">{{ r.brk }}</td>
                <td style="font-weight: 600">{{ r.hrs }}</td>
                <td><span class="badge" [class]="logClass(r.s)">{{ r.s }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EmpAttendanceComponent implements OnInit, AfterViewInit {
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);
  private readonly trendCanvas = viewChild<ElementRef<HTMLCanvasElement>>('trendChart');

  private trendChart?: { destroy(): void };
  private renderScheduled = false;

  protected readonly weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  protected readonly dashboard = signal<EmployeeDashboard | null>(null);
  protected readonly muster = signal<MonthlyMusterDay[]>([]);
  protected readonly log = signal<LogRow[]>([]);

  protected readonly monthLabel = computed(() => {
    const now = new Date();
    return `${now.toLocaleDateString('en-US', { month: 'long' })} ${now.getFullYear()}`;
  });

  protected readonly blanks = computed(() => {
    const now = new Date();
    return Array.from({ length: new Date(now.getFullYear(), now.getMonth(), 1).getDay() }, (_, i) => i);
  });

  protected readonly monthOptions = computed(() => {
    const now = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${date.toLocaleDateString('en-US', { month: 'long' })} ${date.getFullYear()}`;
    });
  });

  protected readonly calendar = computed<CalendarDay[]>(() =>
    this.muster().map((day) => ({
      d: Number(day.date.slice(8, 10)),
      weekend: day.status === 'Weekend' || day.status === 'Holiday',
      late: day.status === 'Late',
      absent: day.status === 'Absent',
    })),
  );

  ngOnInit(): void {
    this.api.dashboardMe().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.scheduleRender();

        this.api.muster(dashboard.employeeId).subscribe({
          next: (days) => this.muster.set(days),
          error: () => {
            /* API offline — no calendar. */
          },
        });

        this.api.attendanceForEmployee(dashboard.employeeId).subscribe({
          next: (records) => this.log.set(records.map((record) => this.toRow(record))),
          error: () => {
            /* API offline — no log. */
          },
        });
      },
      error: () => {
        /* API offline — the page stays empty. */
      },
    });
  }

  private toRow(record: AttendanceRecord): LogRow {
    const date = new Date(record.date);
    const minutes = record.breakMinutes ?? 0;

    return {
      d: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      in: record.checkIn ?? ' · ',
      out: record.checkOut ?? ' · ',
      brk: minutes > 0 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : ' · ',
      hrs: `${record.workHours}h`,
      s: record.status,
    };
  }

  protected dayBg(day: CalendarDay): string {
    if (day.weekend) return 'var(--bg)';
    if (day.absent) return 'rgba(239,68,68,.1)';
    if (day.late) return 'rgba(245,158,11,.1)';
    return 'rgba(16,185,129,.1)';
  }

  protected dayColor(day: CalendarDay): string {
    if (day.weekend) return 'var(--light)';
    if (day.absent) return 'var(--danger)';
    if (day.late) return 'var(--warning)';
    return 'var(--success)';
  }

  protected logClass(s: string): string {
    return `badge-${s === 'Present' ? 'success' : s === 'Late' ? 'warning' : 'danger'}`;
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
    const canvas = this.trendCanvas()?.nativeElement;
    const trend = this.dashboard()?.attendanceTrend ?? [];
    if (!canvas || trend.length === 0) return;

    this.trendChart?.destroy();
    this.trendChart = new Chart(canvas, {
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
        plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12, padding: 16 } } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, min: 0, grid: { color: 'rgba(0,0,0,.04)' } },
        },
      },
    });
  }

  protected exportCsv(): void {
    const header = ['Date', 'Day', 'Check In', 'Check Out', 'Break', 'Work Hours', 'Status'];
    const csv = [
      header.join(','),
      ...this.log().map((r) => [r.d, r.day, r.in, r.out, r.brk, r.hrs, r.s].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Attendance exported');
  }
}
