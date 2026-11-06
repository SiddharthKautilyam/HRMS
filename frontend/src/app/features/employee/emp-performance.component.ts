import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api/api.service';
import { PerformanceReview } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';

interface KpiMetric {
  label: string;
  val: number;
}

interface Feedback {
  from: string;
  role: string;
  msg: string;
  date: string;
  rating: number;
}

/** My Performance — ported from pages/emp-performance.html. */
@Component({
  selector: 'app-emp-performance',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">My Performance</div>
        <div class="page-subtitle">Ratings, KPIs and feedback</div>
      </div>
      <span class="badge badge-primary" style="font-size: 0.82rem; padding: 6px 14px">{{ period() }}</span>
    </div>

    <div class="grid-4" style="margin-bottom: 24px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.c + '18'" [style.color]="k.c"><span [appIcon]="'star'"></span></div>
          <div class="kpi-value" [style.color]="k.c">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div class="grid-2" style="margin-bottom: 24px">
      <div class="card">
        <div class="card-header" style="margin-bottom: 12px"><div class="card-title">KPI Metrics</div></div>
        <div class="card-body" style="padding-top: 0">
          @for (p of metrics(); track p.label) {
            <div style="margin-bottom: 14px">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px">
                <span style="font-weight: 600">{{ p.label }}</span>
                <span style="color: var(--p); font-weight: 700">{{ p.val }}%</span>
              </div>
              <div class="progress" style="height: 6px">
                <div class="progress-bar" [style.width.%]="p.val"></div>
              </div>
            </div>
          }
        </div>
      </div>
      <div class="card">
        <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Performance Trend</div></div>
        <div class="card-body"><div style="position: relative; height: 220px"><canvas #perfChart></canvas></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Manager Feedback</div></div>
      <div class="card-body" style="padding-top: 0">
        @for (f of feedback(); track f.from + f.date) {
          <div style="padding: 16px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 12px">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px">
              <div style="display: flex; align-items: center; gap: 10px">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--p), var(--p)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700">
                  {{ initials(f.from) }}
                </div>
                <div>
                  <div style="font-size: 0.875rem; font-weight: 700">{{ f.from }}</div>
                  <div style="font-size: 0.86rem; color: var(--muted)">{{ f.role }}</div>
                </div>
              </div>
              <div style="text-align: right">
                <div style="display: flex; gap: 2px">
                  @for (s of stars; track s) {
                    <svg width="14" height="14" viewBox="0 0 24 24" [attr.fill]="s <= f.rating ? '#F59E0B' : '#E5E7EB'" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  }
                </div>
                <div style="font-size: 0.86rem; color: var(--muted); margin-top: 2px">{{ f.date }}</div>
              </div>
            </div>
            <div style="font-size: 0.85rem; color: var(--muted); line-height: 1.6">{{ f.msg }}</div>
          </div>
        }
      </div>
    </div>
  `,
})
export class EmpPerformanceComponent implements OnInit, AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly perfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('perfChart');

  private perfChart?: { destroy(): void };
  private renderScheduled = false;

  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly review = signal<PerformanceReview | null>(null);

  protected readonly period = computed(() => this.review()?.period ?? 'Performance');

  protected readonly kpis = computed(() => {
    const review = this.review();
    if (!review) return [];

    return [
      { l: 'Overall Rating', v: `${review.overallRating}/5`, c: 'var(--p)' },
      { l: 'Goals Achieved', v: `${review.goalsAchieved}/${review.goalsTotal}`, c: '#10B981' },
      { l: 'Feedback Score', v: `${review.feedbackScore}%`, c: 'var(--p)' },
      { l: 'Rank', v: review.rank, c: '#F59E0B' },
    ];
  });

  protected readonly metrics = computed<KpiMetric[]>(() =>
    (this.review()?.metrics ?? []).map((m) => ({ label: m.name, val: m.score })),
  );

  protected readonly feedback = computed<Feedback[]>(() =>
    (this.review()?.feedbacks ?? []).map((f) => ({
      from: f.fromName,
      role: f.fromRole,
      msg: f.message,
      date: f.dateLabel,
      rating: f.rating,
    })),
  );

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  ngOnInit(): void {
    this.api.performanceMe().subscribe({
      next: (review) => {
        this.review.set(review);
        this.scheduleRender();
      },
      error: () => {
        /* API offline — no performance data. */
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
    const canvas = this.perfCanvas()?.nativeElement;
    const metrics = this.metrics();
    if (!canvas || metrics.length === 0) return;

    this.perfChart?.destroy();
    this.perfChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: metrics.map((m) => m.label),
        datasets: [
          {
            label: 'Score',
            data: metrics.map((m) => m.val),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,.12)',
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: '#2563eb',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } },
      },
    });
  }
}
