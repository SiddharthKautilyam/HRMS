import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDashboard, LeaveRequest, LeaveType } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface LeaveBalance {
  t: string;
  bal: number;
  total: number;
  used: number;
  c: string;
}

interface LeaveHistory {
  t: string;
  f: string;
  to: string;
  d: number;
  r: string;
  s: string;
}

/** My Leave — ported from pages/emp-leave.html. */
@Component({
  selector: 'app-emp-leave',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">Leave Management</div>
        <div class="page-subtitle">Apply and track your leave requests</div>
      </div>
      <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="ui.open('applyModal')">
        <span [appIcon]="'plus'"></span> Apply Leave
      </button>
    </div>

    <div class="grid-4" style="margin-bottom: 15px">
      @for (l of balances(); track l.t) {
        <div class="kpi-card">
          <div class="flex items-center gap-3" style="margin-bottom: 10px">
            <div class="kpi-icon" [style.background]="l.c + '18'" [style.color]="l.c" style="margin-bottom: 0">
              <span [appIcon]="'leave'"></span>
            </div>
            <div>
              <div class="kpi-value" [style.color]="l.c">{{ l.bal }}</div>
              <div class="kpi-label">{{ l.t }} Leave</div>
            </div>
          </div>
          <div style="font-size: 0.86rem; color: var(--muted); margin-top: 4px">
            {{ l.total ? l.used + ' used of ' + l.total : 'No limit' }}
          </div>
          <div class="progress" style="margin-top: 8px">
            <div class="progress-bar" [style.width.%]="l.total ? (l.used / l.total) * 100 : 0" [style.background]="l.c"></div>
          </div>
        </div>
      }
    </div>

    <div class="grid-2" style="margin-bottom: 15px">
      <div class="card">
        <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Leave Calendar · {{ monthLabel() }}</div></div>
        <div class="card-body" style="padding-top: 0">
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center">
            @for (d of weekDays; track $index) {
              <div style="font-size: 0.86rem; font-weight: 700; color: var(--muted); padding: 6px 0">{{ d }}</div>
            }
            @for (blank of blanks(); track $index) {
              <div></div>
            }
            @for (day of calendar(); track day.d) {
              <div
                style="padding: 6px 4px; border-radius: 8px; font-size: 0.8rem; font-weight: 500"
                [style.background]="dayBg(day)"
                [style.color]="dayColor(day)"
              >
                {{ day.d }}
              </div>
            }
          </div>
          <div style="display: flex; gap: 14px; margin-top: 12px; font-size: 0.75rem">
            <span style="display: flex; align-items: center; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 2px; background: rgba(37,99,235,.4); display: inline-block"></span>On Leave</span>
            <span style="display: flex; align-items: center; gap: 4px"><span style="width: 8px; height: 8px; border-radius: 2px; background: rgba(239,68,68,.4); display: inline-block"></span>Holiday</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Leave History</div></div>
        <div class="card-body" style="padding-top: 0">
          @for (r of history(); track r.t + r.f + r.s) {
            <div style="padding: 11px 0; border-bottom: 1px solid var(--border)">
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px">
                <div style="font-size: 13px; font-weight: 700">{{ r.t }}</div>
                <span class="badge" [class]="historyClass(r.s)">{{ r.s }}</span>
              </div>
              <div style="font-size: 13px; color: var(--muted)">{{ r.f }} – {{ r.to }} · {{ r.d }}d · {{ r.r }}</div>
            </div>
          }
        </div>
      </div>
    </div>

    <div class="modal-overlay" [class.open]="ui.isOpen('applyModal')" (click)="ui.onOverlayClick($event, 'applyModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">Apply for Leave</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('applyModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Leave Type</label>
            <app-select [options]="typeOptions()" [value]="type()" (valueChange)="type.set($event)" width="100%" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">From Date</label>
              <input class="form-control" type="date" [value]="from()" (input)="from.set($any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">To Date</label>
              <input class="form-control" type="date" [value]="to()" (input)="to.set($any($event.target).value)" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Reason</label>
            <textarea class="form-control" rows="3" placeholder="Reason for leave..." [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('applyModal')">Cancel</button>
          <button class="btn btn-primary" (click)="submit()">Submit</button>
        </div>
      </div>
    </div>
  `,
})
export class EmpLeaveComponent implements OnInit {
  protected readonly ui = inject(UiService);
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  protected readonly types = signal<LeaveType[]>([]);
  protected readonly dashboard = signal<EmployeeDashboard | null>(null);
  protected readonly requests = signal<LeaveRequest[]>([]);

  protected readonly typeOptions = computed<SelectOption[]>(() => this.types().map((t) => ({ v: t.id, l: t.name })));

  protected readonly balances = computed<LeaveBalance[]>(() =>
    (this.dashboard()?.leaveBalances ?? []).map((b) => ({
      t: b.type.replace(/ Leave$/, ''),
      bal: b.balance,
      total: b.total,
      used: b.used,
      c: b.color,
    })),
  );

  protected readonly monthLabel = computed(() => {
    const now = new Date();
    return `${now.toLocaleDateString('en-US', { month: 'long' })} ${now.getFullYear()}`;
  });

  protected readonly blanks = computed(() => {
    const now = new Date();
    return Array.from({ length: new Date(now.getFullYear(), now.getMonth(), 1).getDay() }, (_, i) => i);
  });

  protected readonly calendar = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const holidays = new Set(
      (this.dashboard()?.upcomingHolidays ?? [])
        .filter((h) => new Date(h.date).getFullYear() === year && new Date(h.date).getMonth() === month)
        .map((h) => new Date(h.date).getDate()),
    );

    const leaveDays = new Set<number>();
    for (const request of this.requests()) {
      if (request.status === 'Rejected') continue;
      const from = new Date(request.fromDate);
      const to = new Date(request.toDate);
      for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
        if (day.getFullYear() === year && day.getMonth() === month) leaveDays.add(day.getDate());
      }
    }

    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const weekday = new Date(year, month, d).getDay();
      return {
        d,
        weekend: weekday === 0 || weekday === 6,
        leave: leaveDays.has(d),
        holiday: holidays.has(d),
      };
    });
  });

  protected readonly history = computed<LeaveHistory[]>(() =>
    this.requests().map((r) => ({
      t: r.leaveType,
      f: this.shortDate(r.fromDate),
      to: this.shortDate(r.toDate),
      d: r.days,
      r: r.reason || '—',
      s: r.status,
    })),
  );

  protected readonly type = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly reason = signal('');

  ngOnInit(): void {
    this.api.leaveTypes().subscribe({
      next: (types) => {
        this.types.set(types);
        if (types.length > 0) this.type.set(types[0].id);
      },
      error: () => {
        /* API offline — no leave types. */
      },
    });

    this.reload();
  }

  private reload(): void {
    this.api.dashboardMe().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.api.leaveRequestsForEmployee(dashboard.employeeId).subscribe({
          next: (requests) => this.requests.set(requests),
          error: () => {
            /* API offline — no leave history. */
          },
        });
      },
      error: () => {
        /* API offline — no balances. */
      },
    });
  }

  protected dayBg(day: { weekend: boolean; leave: boolean; holiday: boolean }): string {
    if (day.holiday) return 'rgba(239,68,68,.15)';
    if (day.leave) return 'rgba(37,99,235,.15)';
    return day.weekend ? 'var(--bg)' : 'transparent';
  }

  protected dayColor(day: { weekend: boolean; leave: boolean; holiday: boolean }): string {
    if (day.holiday) return 'var(--danger)';
    if (day.leave) return 'var(--p)';
    return day.weekend ? 'var(--light)' : 'var(--text)';
  }

  protected historyClass(s: string): string {
    return `badge-${s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'warning'}`;
  }

  protected submit(): void {
    const employeeId = this.dashboard()?.employeeId;
    if (!employeeId) {
      this.toast.show('Your profile is still loading — please try again.', 'danger');
      return;
    }

    if (!this.type() || !this.from() || !this.to()) {
      this.toast.show('Please choose a leave type and both dates.', 'danger');
      return;
    }

    this.api
      .createLeaveRequest({
        employeeId,
        leaveTypeId: this.type(),
        fromDate: this.from(),
        toDate: this.to(),
        reason: this.reason(),
      })
      .subscribe({
        next: () => {
          this.ui.close('applyModal');
          this.toast.show('Leave submitted!');
          this.reason.set('');
          this.reload();
        },
        error: (error) => this.toast.show(error?.error?.title ?? 'Could not submit the leave request.', 'danger'),
      });
  }

  private shortDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
