import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';

interface Approval {
  apiId?: string;
  n: string;
  t: string;
  type: 'leave' | 'overtime' | 'reg';
  d: string;
  sub: string;
  p: 'High' | 'Medium' | 'Low';
  date?: string;
  inTime?: string;
  outTime?: string;
  reason?: string;
}

/** HR Approvals — ported from pages/approvals.html. */
@Component({
  selector: 'app-approvals',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">HR Approvals</div>
        <div class="page-subtitle">Manage all pending approval requests</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="approveAll()">
          <span [appIcon]="'check'"></span> Approve All
        </button>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 15px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.c + '20'" [style.color]="k.c"><span [appIcon]="'approvals'"></span></div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div>
      <div class="tabs">
        <button class="tab-btn" [class.active]="tab() === 'all'" (click)="tab.set('all')">All ({{ allData().length }})</button>
        <button class="tab-btn" [class.active]="tab() === 'leave'" (click)="tab.set('leave')">Leave ({{ leaveData().length }})</button>
        <button class="tab-btn" [class.active]="tab() === 'ot'" (click)="tab.set('ot')">Overtime ({{ overtimeData().length }})</button>
        @if (canReg()) {
          <button class="tab-btn" [class.active]="tab() === 'reg'" (click)="tab.set('reg')">Regularization ({{ regData().length }})</button>
        }
      </div>

      <div style="margin-top: 20px">
        @if (tab() === 'reg' && canReg()) {
          <div class="card">
            <div class="table-wrap">
              <table class="approvals-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Reason</th>
                    <th>Submitted</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @if (regData().length === 0) {
                    <tr>
                      <td colspan="8">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 12px">
                          <div style="font-weight: 600; font-size: 1rem; color: var(--text)">No Records Found</div>
                          <div style="font-size: 0.85rem; color: var(--muted)">There are no pending regularization requests.</div>
                        </div>
                      </td>
                    </tr>
                  }
                  @for (r of regData(); track r.n) {
                    <tr [style.opacity]="decided().has(r.n + r.t) ? '.4' : '1'">
                      <td>
                        <div class="table-avatar">
                          <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p)">{{ initials(r.n) }}</div>
                          <span style="font-weight: 600">{{ r.n }}</span>
                        </div>
                      </td>
                      <td style="font-size: 13px">{{ r.date }}</td>
                      <td style="font-size: 13px; font-weight: 600">{{ r.inTime }}</td>
                      <td style="font-size: 13px; font-weight: 600">{{ r.outTime }}</td>
                      <td style="font-size: 13px; color: var(--muted)">{{ r.reason }}</td>
                      <td style="color: var(--muted)">{{ r.sub }}</td>
                      <td><span class="badge" [class]="priorityClass(r.p)">{{ r.p }}</span></td>
                      <td>
                        <div style="display: flex; gap: 6px">
                          <button class="btn btn-success btn-sm" data-tooltip="Approve" (click)="decide(r, true)"><span [appIcon]="'check'"></span></button>
                          <button class="btn btn-danger btn-sm" data-tooltip="Reject" (click)="decide(r, false)"><span [appIcon]="'x'"></span></button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else {
          <div class="card">
            <div class="table-wrap">
              <table class="approvals-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th>Submitted</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @if (currentRows().length === 0) {
                    <tr>
                      <td colspan="6">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 12px">
                          <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="100" cy="100" r="80" fill="#F1F5F9" />
                            <rect x="55" y="65" width="90" height="110" rx="8" fill="#E2E8F0" />
                            <rect x="65" y="80" width="50" height="6" rx="3" fill="#CBD5E1" />
                            <rect x="65" y="95" width="70" height="6" rx="3" fill="#CBD5E1" />
                            <rect x="65" y="110" width="60" height="6" rx="3" fill="#CBD5E1" />
                            <rect x="65" y="125" width="40" height="6" rx="3" fill="#CBD5E1" />
                            <circle cx="140" cy="60" r="22" fill="#DBEAFE" stroke="#93C5FD" stroke-width="2" />
                            <line x1="133" y1="60" x2="147" y2="60" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" />
                            <line x1="140" y1="53" x2="140" y2="67" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" />
                          </svg>
                          <div style="font-weight: 600; font-size: 1rem; color: var(--text); margin-top: 8px">No Records Found</div>
                          <div style="font-size: 0.85rem; color: var(--muted)">There are no pending approval requests here.</div>
                        </div>
                      </td>
                    </tr>
                  }
                  @for (r of currentRows(); track r.n + r.t) {
                    <tr [style.opacity]="decided().has(r.n + r.t) ? '.4' : '1'">
                      <td>
                        <div class="table-avatar">
                          <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p)">{{ initials(r.n) }}</div>
                          <span style="font-weight: 600">{{ r.n }}</span>
                        </div>
                      </td>
                      <td><span class="badge badge-primary">{{ r.t }}</span></td>
                      <td style="color: var(--muted)">{{ r.d }}</td>
                      <td style="color: var(--muted)">{{ r.sub }}</td>
                      <td><span class="badge" [class]="priorityClass(r.p)">{{ r.p }}</span></td>
                      <td>
                        <div style="display: flex; gap: 6px">
                          <button class="btn btn-success btn-sm" data-tooltip="Approve" (click)="decide(r, true)"><span [appIcon]="'check'"></span></button>
                          <button class="btn btn-danger btn-sm" data-tooltip="Reject" (click)="decide(r, false)"><span [appIcon]="'x'"></span></button>
                          <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="view(r)"><span [appIcon]="'eye'"></span></button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Approval Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('approvalModal')" (click)="ui.onOverlayClick($event, 'approvalModal')">
      <div class="modal" style="max-width: 600px">
        <div class="modal-header">
          <div>
            <div class="card-title" style="font-size: 14px">{{ viewTarget()?.n }} — Approval Request</div>
            <div class="card-subtitle">{{ viewTarget()?.t }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('approvalModal')"><span [appIcon]="'x'"></span></button>
        </div>
        @if (viewTarget(); as r) {
          <div class="modal-body">
            <div style="padding: 12px; background: var(--p-soft); border-radius: 10px; margin-bottom: 14px">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px">{{ r.n }}</div>
              <div style="font-size: 12px; color: var(--muted)">
                {{ r.t }} &middot; <span class="badge" [class]="priorityClass(r.p)">{{ r.p }}</span>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
              @for (f of viewFields(r); track f[0]) {
                <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                  <div style="font-size: 13px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px">
                    {{ f[0] }}
                  </div>
                  <div style="font-size: 13px; font-weight: 400; color: var(--text)">{{ f[1] }}</div>
                </div>
              }
            </div>
          </div>
        }
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('approvalModal')">Close</button>
          <button class="btn btn-danger" (click)="decideFromModal(false)"><span [appIcon]="'x'"></span> Reject</button>
          <button class="btn btn-success" (click)="decideFromModal(true)"><span [appIcon]="'check'"></span> Approve</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      thead th,
      .approvals-table .table-avatar span,
      .approvals-table .badge,
      .approvals-table td {
        white-space: nowrap;
      }
      @media (max-width: 768px) {
        .approvals-table th:nth-child(3),
        .approvals-table td:nth-child(3),
        .approvals-table th:nth-child(4),
        .approvals-table td:nth-child(4),
        .approvals-table th:nth-child(5),
        .approvals-table td:nth-child(5) {
          display: none;
        }
      }
    `,
  ],
})
export class ApprovalsComponent implements OnInit {
  protected readonly ui = inject(UiService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  private readonly role = this.session.activeRole();
  protected readonly canReg = signal(this.role === 'Super Admin' || this.role === 'Company Admin' || this.role === 'HR Manager');

  protected readonly tab = signal<'all' | 'leave' | 'ot' | 'reg'>('all');
  protected readonly decided = signal<Set<string>>(new Set());
  protected readonly viewTarget = signal<Approval | null>(null);

  protected readonly allData = signal<Approval[]>([]);

  protected readonly regData = signal<Approval[]>([]);

  protected readonly leaveData = computed(() => this.allData().filter((r) => r.type === 'leave'));

  protected readonly overtimeData = computed(() => this.allData().filter((r) => r.type === 'overtime'));

  ngOnInit(): void {
    this.loadApprovals();
    this.loadRegularizations();
  }

  private loadApprovals(): void {
    this.api.approvals({ status: 'Pending' }).subscribe({
      next: (rows) =>
        this.allData.set(
          rows.map((a) => ({
            apiId: a.id,
            n: a.employeeName,
            t: a.title,
            type: (a.type === 'Overtime' ? 'overtime' : a.type === 'Regularization' ? 'reg' : 'leave') as Approval['type'],
            d: a.details,
            sub: a.submittedLabel,
            p: a.priority as Approval['p'],
          })),
        ),
      error: () => {
        /* API offline — keep the demo approvals. */
      },
    });
  }

  private loadRegularizations(): void {
    this.api.regularizations().subscribe({
      next: (rows) =>
        this.regData.set(
          rows
            .filter((r) => r.status === 'Pending')
            .map((r) => ({
              apiId: r.id,
              n: r.employeeName,
              t: 'Regularization',
              type: 'reg' as const,
              d: '',
              sub: r.submittedLabel,
              p: 'Medium' as const,
              date: r.date,
              inTime: r.inTime,
              outTime: r.outTime,
              reason: r.reason,
            })),
        ),
      error: () => {
        /* API offline — keep the demo regularizations. */
      },
    });
  }

  protected readonly kpis = computed(() => {
    const base = [
      { l: 'Total Pending', v: `${this.allData().length + (this.canReg() ? this.regData().length : 0)}`, c: '#F59E0B' },
      { l: 'Leave Requests', v: `${this.leaveData().length}`, c: '#2563eb' },
      { l: 'Overtime', v: `${this.overtimeData().length}`, c: '#0D9488' },
    ];
    if (this.canReg()) base.push({ l: 'Regularization', v: `${this.regData().length}`, c: '#7c3aed' });
    return base;
  });

  protected readonly currentRows = computed(() => {
    switch (this.tab()) {
      case 'leave':
        return this.leaveData();
      case 'ot':
        return this.overtimeData();
      default:
        return this.allData();
    }
  });

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected priorityClass(p: Approval['p']): string {
    return `badge-${p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'info'}`;
  }

  protected viewFields(r: Approval): [string, string][] {
    return [
      ['Request Type', r.t],
      ['Details', r.d],
      ['Submitted', r.sub],
      ['Priority', r.p],
    ];
  }

  private key(r: Approval): string {
    return r.n + r.t;
  }

  protected decide(r: Approval, approved: boolean): void {
    const finish = () => {
      this.decided.update((set) => new Set(set).add(this.key(r)));
      this.toast.show(approved ? 'Approved!' : 'Rejected', approved ? 'success' : 'danger');
    };

    if (!r.apiId) {
      finish();
      return;
    }

    if (r.type === 'reg') {
      const request = approved ? this.api.approveRegularization(r.apiId) : this.api.rejectRegularization(r.apiId);
      request.subscribe({
        next: finish,
        error: (error) => this.toast.show(error?.error?.title ?? 'Could not update the request.', 'danger'),
      });
      return;
    }

    const request = approved ? this.api.approveApproval(r.apiId) : this.api.rejectApproval(r.apiId);
    request.subscribe({
      next: finish,
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not update the request.', 'danger'),
    });
  }

  protected view(r: Approval): void {
    this.viewTarget.set(r);
    this.ui.open('approvalModal');
  }

  protected decideFromModal(approved: boolean): void {
    const r = this.viewTarget();
    this.ui.close('approvalModal');
    if (r) this.decide(r, approved);
  }

  protected approveAll(): void {
    this.api.approveAllApprovals().subscribe({
      next: () => {
        this.decided.update((set) => {
          const next = new Set(set);
          [...this.allData(), ...this.regData()].forEach((r) => next.add(this.key(r)));
          return next;
        });
        this.toast.show('All approved!');
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not approve all requests.', 'danger'),
    });
  }
}
