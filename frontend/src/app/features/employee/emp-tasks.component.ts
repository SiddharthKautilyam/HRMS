import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';

interface Task {
  id?: string;
  t: string;
  due: string;
  s: 'Completed' | 'In Progress' | 'Pending';
  p: 'High' | 'Medium' | 'Low';
  assign: string;
}

/** My Tasks — ported from pages/emp-tasks.html. */
@Component({
  selector: 'app-emp-tasks',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">My Tasks</div>
        <div class="page-subtitle">Track your assigned tasks and deadlines</div>
      </div>
      <div style="display: flex; gap: 8px">
        <select class="form-control form-select" style="width: 140px; font-size: 0.82rem" [value]="filter()" (change)="filter.set($any($event.target).value)">
          <option value="">All Tasks</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 24px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.c + '18'" [style.color]="k.c"><span [appIcon]="'approvals'"></span></div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Task List</div></div>
      <div class="card-body" style="padding-top: 0">
        @for (t of visible(); track t.t) {
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border)">
            <div [style.background]="dotColor(t.s)" style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0"></div>
            <div style="flex: 1">
              <div style="font-size: 0.875rem; font-weight: 600" [style.text-decoration]="t.s === 'Completed' ? 'line-through' : 'none'" [style.color]="t.s === 'Completed' ? 'var(--muted)' : 'var(--text)'">
                {{ t.t }}
              </div>
              <div style="font-size: 0.86rem; color: var(--muted)">Due: {{ t.due }} · Assigned by: {{ t.assign }}</div>
            </div>
            <span class="badge" [class]="priorityClass(t.p)" style="font-size: 0.86rem">{{ t.p }}</span>
            <span class="badge" [class]="statusClass(t.s)" style="font-size: 0.86rem">{{ t.s }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class EmpTasksComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly filter = signal('');

  protected readonly tasks = signal<Task[]>([]);

  protected readonly kpis = computed(() => {
    const tasks = this.tasks();
    const count = (status: Task['s']) => tasks.filter((task) => task.s === status).length;

    return [
      { l: 'Total', v: String(tasks.length), c: 'var(--p)' },
      { l: 'Completed', v: String(count('Completed')), c: '#10B981' },
      { l: 'In Progress', v: String(count('In Progress')), c: 'var(--p)' },
      { l: 'Pending', v: String(count('Pending')), c: '#F59E0B' },
    ];
  });

  ngOnInit(): void {
    this.api.dashboardMe().subscribe({
      next: (dashboard) => {
        this.api.tasks(dashboard.employeeId).subscribe({
          next: (tasks) =>
            this.tasks.set(
              tasks.map((task) => ({
                id: task.id,
                t: task.title,
                due: task.dueLabel,
                s: EmpTasksComponent.status(task.status),
                p: (task.priority as Task['p']) ?? 'Medium',
                assign: task.assignedBy ?? 'Self',
              })),
            ),
          error: () => {
            /* API offline — no tasks. */
          },
        });
      },
      error: () => {
        /* API offline — no tasks. */
      },
    });
  }

  private static status(value: string): Task['s'] {
    return value === 'Completed' ? 'Completed' : value === 'InProgress' ? 'In Progress' : 'Pending';
  }

  protected visible(): Task[] {
    const f = this.filter();
    return f ? this.tasks().filter((t) => t.s === f) : this.tasks();
  }

  protected dotColor(s: Task['s']): string {
    return s === 'Completed' ? '#10B981' : s === 'In Progress' ? 'var(--p)' : '#F59E0B';
  }

  protected priorityClass(p: Task['p']): string {
    return `badge-${p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'info'}`;
  }

  protected statusClass(s: Task['s']): string {
    return `badge-${s === 'Completed' ? 'success' : s === 'In Progress' ? 'primary' : 'warning'}`;
  }
}
