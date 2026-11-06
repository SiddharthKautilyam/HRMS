import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface LeaveRequest {
  apiId?: string;
  n: string;
  t: string;
  f: string;
  to: string;
  d: number;
  r: string;
  s: 'Pending' | 'Approved' | 'Rejected';
}

interface LeaveType {
  id: string;
  name: string;
  days: number;
  paid: boolean;
  color: string;
  desc: string;
}

/** Leave Management — ported from pages/leave.html. */
@Component({
  selector: 'app-leave',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">Leave Management</div>
        <div class="page-subtitle">Apply, track and approve leave requests</div>
      </div>
      @if (!isSuperAdmin() && perms.canCreate('Leave')) {
        <button class="btn btn-primary btn-sm" (click)="ui.open('applyModal')">+ Apply Leave</button>
      }
    </div>

    @if (isAdmin()) {
      <div class="card" style="margin-bottom: 16px">
        <div class="card-header">
          <div class="card-title">Leave Types</div>
          @if (perms.canCreate('Leave')) {
            <button class="btn btn-primary btn-sm" (click)="openType(null)">+ Add Leave Type</button>
          }
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Max Days/Year</th>
                <th>Paid</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (lt of leaveTypes(); track lt.id) {
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px">
                      <span [style.background]="lt.color" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0"></span>
                      <span style="font-weight: 600; font-size: 13px">{{ lt.name }}</span>
                    </div>
                  </td>
                  <td><span style="font-weight: 600">{{ lt.days }}</span> days</td>
                  <td><span class="badge" [class]="lt.paid ? 'badge-success' : 'badge-warning'">{{ lt.paid ? 'Paid' : 'Unpaid' }}</span></td>
                  <td style="font-size: 13px; color: var(--muted)">{{ lt.desc }}</td>
                  <td>
                    <div style="display: flex; gap: 4px">
                      @if (perms.canEdit('Leave')) {
                        <button class="btn btn-ghost btn-sm" data-tooltip="Edit" (click)="openType(lt.id)"><span [appIcon]="'edit'"></span></button>
                      }
                      @if (perms.canDelete('Leave')) {
                        <button class="btn btn-ghost btn-sm" data-tooltip="Delete" style="color: var(--danger)" (click)="deleteType(lt.id)">
                          <span [appIcon]="'trash'"></span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" style="text-align: center; padding: 24px; color: var(--muted);">
                    No leave types configured. Click "+ Add Leave Type" to create one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px; flex-wrap: wrap; gap: 8px">
        <div class="card-title">All Leave Requests</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
          <input class="form-control" placeholder="Search employee..." style="width: 180px" [value]="search()" (input)="search.set($any($event.target).value)" />
          <app-select [options]="typeOptions" [value]="typeFilter()" (valueChange)="typeFilter.set($event)" width="140px" />
          <app-select [options]="statusFilterOptions" [value]="statusFilter()" (valueChange)="statusFilter.set($event)" width="125px" />
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th class="leave-col-from">From</th>
              <th class="leave-col-to">To</th>
              <th>Days</th>
              <th class="leave-col-reason">Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.apiId || ($index + '-' + r.n + '-' + r.f)) {
              <tr>
                <td>
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar">{{ initials(r.n) }}</div>
                    <span style="font-weight: 600; font-size: 13px">{{ r.n }}</span>
                  </div>
                </td>
                <td><span class="badge badge-primary">{{ r.t }}</span></td>
                <td class="leave-col-from">{{ r.f }}</td>
                <td class="leave-col-to">{{ r.to }}</td>
                <td>{{ r.d }}</td>
                <td class="leave-col-reason" style="font-size: 13px; color: var(--muted)">{{ r.r }}</td>
                <td><span class="badge" [class]="leaveClass(r.s)">{{ r.s }}</span></td>
                <td>
                  <div style="display: flex; gap: 6px">
                    <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="view(r)"><span [appIcon]="'eye'"></span></button>
                    @if (r.s === 'Pending') {
                      <button class="tbl-btn success" data-tooltip="Approve" (click)="action(r, 'Approved')"><span [appIcon]="'check'"></span></button>
                      <button class="tbl-btn danger" data-tooltip="Reject" (click)="action(r, 'Rejected')"><span [appIcon]="'x'"></span></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" style="text-align: center; padding: 24px; color: var(--muted);">
                  No leave requests found.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- View Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('leaveViewModal')" (click)="ui.onOverlayClick($event, 'leaveViewModal')">
      <div class="modal" style="max-width: 600px; width: 100%">
        <div class="modal-header">
          <div>
            <div class="card-title" style="font-size: 14px">{{ viewTarget()?.n }} — Leave Request</div>
            <div class="card-subtitle">{{ viewTarget()?.t }} Leave - {{ viewTarget()?.d }} day(s)</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('leaveViewModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          @if (viewTarget(); as r) {
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
            <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg); border-radius: 8px">
              <span style="font-size: 12px; font-weight: 600">Status</span>
              <span class="badge" [class]="leaveClass(r.s)" style="font-size: 12px">{{ r.s }}</span>
            </div>
            @if (r.s === 'Pending' && (perms.canEdit('Leave') || perms.canEdit('Approvals'))) {
              <div class="modal-footer" style="padding: 12px 0 0; border-top: 1px solid var(--border); margin-top: 12px">
                <button class="btn btn-success" (click)="action(r, 'Approved'); ui.close('leaveViewModal')">
                  <span [appIcon]="'check'"></span> Approve
                </button>
                <button class="btn btn-danger" (click)="action(r, 'Rejected'); ui.close('leaveViewModal')">
                  <span [appIcon]="'x'"></span> Reject
                </button>
              </div>
            }
          }
        </div>
      </div>
    </div>

    <!-- Leave Type Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('ltModal')" (click)="ui.onOverlayClick($event, 'ltModal')">
      <div class="modal" style="max-width: 460px">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">{{ typeForm().id ? 'Edit Leave Type' : 'Add Leave Type' }}</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('ltModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body" style="overflow: visible">
          <div class="grid-2">
            <div class="form-group" style="grid-column: 1/-1">
              <label class="form-label">Leave Type Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" placeholder="e.g. Casual Leave" [value]="typeForm().name" (input)="patchType('name', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Max Days / Year <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="number" min="1" placeholder="e.g. 15" [value]="typeForm().days" (input)="patchTypeDays($any($event.target).value)" />
            </div>
            <div class="form-group" style="overflow: visible">
              <label class="form-label">Paid Leave</label>
              <app-select [options]="paidOptions" [value]="typeForm().paid ? 'yes' : 'no'" (valueChange)="patchTypePaid($event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Color</label>
              <input class="form-control" type="color" style="height: 38px; padding: 2px 6px; cursor: pointer" [value]="typeForm().color" (input)="patchType('color', $any($event.target).value)" />
            </div>
            <div class="form-group" style="grid-column: 1/-1">
              <label class="form-label">Description</label>
              <textarea class="form-control" rows="2" placeholder="Brief description..." [value]="typeForm().desc" (input)="patchType('desc', $any($event.target).value)"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('ltModal')">Cancel</button>
          <button class="btn btn-primary" (click)="saveType()"><span [appIcon]="'check'"></span> Save</button>
        </div>
      </div>
    </div>

    <!-- Apply Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('applyModal')" (click)="ui.onOverlayClick($event, 'applyModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">Apply for Leave</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('applyModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Leave Type</label>
            <app-select [options]="applyTypeOptions" [value]="applyType()" (valueChange)="applyType.set($event)" width="100%" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">From Date</label>
              <input class="form-control" type="date" [value]="applyFrom()" (input)="applyFrom.set($any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">To Date</label>
              <input class="form-control" type="date" [value]="applyTo()" (input)="applyTo.set($any($event.target).value)" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Reason</label>
            <textarea class="form-control" rows="3" placeholder="Reason for leave..." [value]="applyReason()" (input)="applyReason.set($any($event.target).value)"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Attach Document (optional)</label>
            <input class="form-control" type="file" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('applyModal')">Cancel</button>
          <button class="btn btn-primary" (click)="submitApply()">Submit Request</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      thead th,
      tbody td {
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        .leave-col-from,
        .leave-col-to,
        .leave-col-reason {
          display: none;
        }
      }
    `,
  ],
})
export class LeaveComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  private readonly role = this.session.activeRole();
  protected readonly isAdmin = signal(this.role === 'Super Admin' || this.role === 'Company Admin' || this.role === 'HR Manager');
  protected readonly isSuperAdmin = signal(this.role === 'Super Admin');

  protected readonly search = signal('');
  protected readonly typeFilter = signal('');
  protected readonly statusFilter = signal('');

  protected readonly typeOptions: SelectOption[] = [
    { v: '', l: 'All Types' },
    { v: 'Annual', l: 'Annual' },
    { v: 'Sick', l: 'Sick' },
    { v: 'Emergency', l: 'Emergency' },
  ];

  protected readonly statusFilterOptions: SelectOption[] = [
    { v: '', l: 'All Status' },
    { v: 'Pending', l: 'Pending' },
    { v: 'Approved', l: 'Approved' },
    { v: 'Rejected', l: 'Rejected' },
  ];

  protected readonly paidOptions: SelectOption[] = [
    { v: 'yes', l: 'Yes - Paid' },
    { v: 'no', l: 'No - Unpaid' },
  ];

  protected readonly applyTypeOptions: SelectOption[] = [
    { v: 'Annual Leave', l: 'Annual Leave' },
    { v: 'Sick Leave', l: 'Sick Leave' },
    { v: 'Emergency Leave', l: 'Emergency Leave' },
    { v: 'Unpaid Leave', l: 'Unpaid Leave' },
  ];

  protected readonly requests = signal<LeaveRequest[]>([]);

  protected readonly leaveTypes = signal<LeaveType[]>([]);

  protected readonly typeForm = signal<LeaveType>({ id: '', name: '', days: 0, paid: true, color: '#2563eb', desc: '' });
  protected readonly viewTarget = signal<LeaveRequest | null>(null);

  protected readonly applyType = signal('Annual Leave');
  protected readonly applyFrom = signal('');
  protected readonly applyTo = signal('');
  protected readonly applyReason = signal('');

  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const t = this.typeFilter();
    const s = this.statusFilter();
    return this.requests().filter(
      (r) => (!q || r.n.toLowerCase().includes(q)) && (!t || r.t === t) && (!s || r.s === s),
    );
  });

  ngOnInit(): void {
    this.loadTypes();
    this.loadRequests();
  }

  private loadTypes(): void {
    this.api.leaveTypes().subscribe({
      next: (types) =>
        this.leaveTypes.set(
          types.map((t) => ({
            id: t.id,
            name: t.name,
            days: t.maxDaysPerYear,
            paid: t.isPaid,
            color: t.color,
            desc: t.description ?? '',
          })),
        ),
      error: () => {
        /* API offline — keep the demo leave types. */
      },
    });
  }

  private loadRequests(): void {
    this.api.leaveRequests({ page: 1, pageSize: 100 }).subscribe({
      next: (page) =>
        this.requests.set(
          page.items.map((r) => ({
            apiId: r.id,
            n: r.employeeName,
            t: r.leaveType,
            f: this.shortDate(r.fromDate),
            to: this.shortDate(r.toDate),
            d: r.days,
            r: r.reason,
            s: r.status as LeaveRequest['s'],
          })),
        ),
      error: () => {
        /* API offline — keep the demo requests. */
      },
    });
  }

  private shortDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected leaveClass(s: LeaveRequest['s']): string {
    return `badge-${s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'warning'}`;
  }

  protected viewFields(r: LeaveRequest): [string, string][] {
    return [
      ['Employee', r.n],
      ['Leave Type', r.t],
      ['From', r.f],
      ['To', r.to],
      ['Days', `${r.d} day(s)`],
      ['Reason', r.r],
    ];
  }

  protected view(r: LeaveRequest): void {
    this.viewTarget.set(r);
    this.ui.open('leaveViewModal');
  }

  protected action(r: LeaveRequest, status: 'Approved' | 'Rejected'): void {
    const applyLocal = () => {
      this.requests.update((list) => list.map((x) => (x === r ? { ...x, s: status } : x)));
      this.toast.show(status === 'Approved' ? 'Leave approved!' : 'Leave rejected', status === 'Approved' ? 'success' : 'danger');
    };

    if (!r.apiId) {
      applyLocal();
      return;
    }

    const request = status === 'Approved' ? this.api.approveLeave(r.apiId) : this.api.rejectLeave(r.apiId);
    request.subscribe({
      next: (updated) => {
        this.requests.update((list) =>
          list.map((x) => (x === r ? { ...x, s: updated.status as LeaveRequest['s'] } : x)),
        );
        this.toast.show(status === 'Approved' ? 'Leave approved!' : 'Leave rejected', status === 'Approved' ? 'success' : 'danger');
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not update the leave request.', 'danger'),
    });
  }

  protected openType(id: string | null): void {
    if (id) {
      const lt = this.leaveTypes().find((x) => x.id === id);
      if (lt) this.typeForm.set({ ...lt });
    } else {
      this.typeForm.set({ id: '', name: '', days: 0, paid: true, color: '#2563eb', desc: '' });
    }
    this.ui.open('ltModal');
  }

  protected patchType(key: 'name' | 'color' | 'desc', value: string): void {
    this.typeForm.update((f) => ({ ...f, [key]: value }));
  }

  protected patchTypeDays(value: string): void {
    this.typeForm.update((f) => ({ ...f, days: parseInt(value, 10) || 0 }));
  }

  protected patchTypePaid(value: string): void {
    this.typeForm.update((f) => ({ ...f, paid: value === 'yes' }));
  }

  protected saveType(): void {
    const f = this.typeForm();
    if (!f.name.trim() || !f.days) {
      this.toast.show('Please fill required fields', 'danger');
      return;
    }

    const body = {
      name: f.name.trim(),
      maxDaysPerYear: f.days,
      isPaid: f.paid,
      color: f.color,
      description: f.desc,
    };

    const request = f.id ? this.api.updateLeaveType(f.id, body) : this.api.createLeaveType(body);
    request.subscribe({
      next: () => {
        this.ui.close('ltModal');
        this.toast.show(f.id ? 'Leave type updated!' : 'Leave type added!');
        this.loadTypes();
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not save the leave type.', 'danger'),
    });
  }

  protected deleteType(id: string): void {
    if (!id || /^\d+$/.test(id)) {
      this.leaveTypes.update((list) => list.filter((x) => x.id !== id));
      this.toast.show('Leave type deleted', 'danger');
      return;
    }

    this.api.deleteLeaveType(id).subscribe({
      next: () => {
        this.toast.show('Leave type deleted', 'danger');
        this.loadTypes();
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not delete the leave type.', 'danger'),
    });
  }

  protected submitApply(): void {
    const type = this.leaveTypes().find((t) => t.name === this.applyType());
    const from = this.applyFrom();
    const to = this.applyTo();

    if (!type || !from || !to) {
      this.toast.show('Choose a leave type and both dates.', 'danger');
      return;
    }

    this.api
      .createLeaveRequest({
        employeeId: null,
        leaveTypeId: type.id,
        fromDate: from,
        toDate: to,
        reason: this.applyReason() || 'Personal',
      })
      .subscribe({
        next: () => {
          this.ui.close('applyModal');
          this.toast.show('Leave request submitted!');
          this.loadRequests();
        },
        error: (error) => this.toast.show(error?.error?.title ?? 'Could not submit the leave request.', 'danger'),
      });
  }
}
