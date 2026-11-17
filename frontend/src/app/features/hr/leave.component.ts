import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { EmployeeListItem } from '../../core/api/api.models';
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
  imports: [CommonModule, FormsModule, IconDirective, SelectComponent],
  template: `
    @if (!isSuperAdmin() && perms.canCreate('Leave')) {
      <div class="flex justify-end items-center" style="margin-bottom: 15px">
        <button class="btn btn-primary btn-sm" (click)="ui.open('applyModal')">+ Apply Leave</button>
      </div>
    }

    @if (isAdmin()) {
      <div class="card" style="margin-bottom: 16px; overflow: visible;">
        <div class="card-header" style="overflow: visible;">
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

    <div class="card" style="overflow: visible;">
      <div class="card-header" style="margin-bottom: 12px; flex-wrap: wrap; gap: 8px; overflow: visible; position: relative; z-index: 30;">
        <div class="card-title">All Leave Requests</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; overflow: visible; position: relative; z-index: 30;">
          <!-- Instant Search Box with Icon, Clear Button, and Anti-Autofill -->
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 10px; color: var(--muted); pointer-events: none; display: flex;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input 
              #searchInput
              type="search" 
              id="leave_search_filter_query"
              name="leave_search_filter_query"
              class="form-control" 
              placeholder="Search employee, type, reason..." 
              style="width: 230px; font-size: 12px; padding: 6px 28px 6px 30px;"
              [value]="search()"
              (input)="onSearchInput($any($event.target).value)"
              (change)="onSearchInput($any($event.target).value)"
              (search)="onSearchInput($any($event.target).value)"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              role="searchbox"
            />
            @if (search()) {
              <button 
                type="button" 
                (click)="clearSearch()"
                style="position: absolute; right: 8px; background: none; border: none; font-size: 13px; cursor: pointer; color: var(--muted); padding: 2px 4px; display: flex; align-items: center;"
                title="Clear search"
              >
                ✕
              </button>
            }
          </div>

          <app-select [options]="typeOptions()" [value]="typeFilter()" (valueChange)="typeFilter.set($event)" width="150px" />
          <app-select [options]="statusFilterOptions" [value]="statusFilter()" (valueChange)="statusFilter.set($event)" width="125px" />

          @if (search() || typeFilter() || statusFilter()) {
            <button class="btn btn-ghost btn-sm" (click)="clearAllFilters()" style="font-size: 12px; color: var(--muted); text-decoration: underline;">
              Clear Filters
            </button>
          }
        </div>
      </div>
      <div class="table-wrap" style="position: relative; z-index: 1; min-height: 180px;">
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
                <td colspan="8" style="text-align: center; padding: 36px 20px; color: var(--muted);">
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    <div style="font-size: 13px; font-weight: 500;">
                      @if (search() || typeFilter() || statusFilter()) {
                        No leave requests found matching filters.
                      } @else {
                        No leave requests found.
                      }
                    </div>
                    @if (search() || typeFilter() || statusFilter()) {
                      <button 
                        type="button" 
                        class="btn btn-outline btn-sm btn-auto" 
                        style="width: auto !important; height: auto !important; padding: 6px 14px !important; font-size: 12px; margin-top: 4px; display: inline-flex; align-items: center; gap: 6px;"
                        (click)="clearAllFilters()"
                      >
                        <span [appIcon]="'x'"></span> Clear Filters
                      </button>
                    }
                  </div>
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
          @if (isAdmin()) {
            <div class="form-group">
              <label class="form-label">Employee <span style="color: var(--danger)">*</span></label>
              <select 
                class="form-control" 
                [ngModel]="applyEmployeeId()" 
                (ngModelChange)="applyEmployeeId.set($event)"
              >
                <option value="">Select Employee...</option>
                @for (emp of employees(); track emp.id) {
                  <option [value]="emp.id">{{ emp.fullName }} ({{ emp.department }})</option>
                }
              </select>
            </div>
          }
          <div class="form-group">
            <label class="form-label">Leave Type <span style="color: var(--danger)">*</span></label>
            <app-select [options]="applyTypeOptions()" [value]="applyType()" (valueChange)="applyType.set($event)" width="100%" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">From Date <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="date" [value]="applyFrom()" (input)="applyFrom.set($any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">To Date <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="date" [value]="applyTo()" (input)="applyTo.set($any($event.target).value)" />
            </div>
          </div>
          @if (calculatedDays() > 0) {
            <div style="font-size: 12px; color: var(--p); font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
              <span [appIcon]="'clock'"></span> Duration: {{ calculatedDays() }} day(s)
            </div>
          }
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
      input[type="search"]::-webkit-search-decoration,
      input[type="search"]::-webkit-search-cancel-button,
      input[type="search"]::-webkit-search-results-button,
      input[type="search"]::-webkit-search-results-decoration {
        -webkit-appearance: none;
        appearance: none;
        display: none !important;
      }
      input[type="search"]::-ms-clear,
      input[type="search"]::-ms-reveal {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `,
  ],
})
export class LeaveComponent implements OnInit, AfterViewInit {
  @ViewChild('searchInput') set searchInputSetter(ref: ElementRef<HTMLInputElement> | undefined) {
    this.searchInputRef = ref;
    if (ref?.nativeElement && !this.search()) {
      ref.nativeElement.value = '';
      setTimeout(() => {
        if (ref?.nativeElement && !this.search()) {
          ref.nativeElement.value = '';
        }
      }, 50);
      setTimeout(() => {
        if (ref?.nativeElement && !this.search()) {
          ref.nativeElement.value = '';
        }
      }, 250);
    }
  }
  searchInputRef?: ElementRef<HTMLInputElement>;

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

  protected readonly requests = signal<LeaveRequest[]>([]);
  protected readonly leaveTypes = signal<LeaveType[]>([]);
  protected readonly employees = signal<EmployeeListItem[]>([]);

  // Dynamically populated options from live leave types
  protected readonly typeOptions = computed<SelectOption[]>(() => [
    { v: '', l: 'All Types' },
    ...this.leaveTypes().map((t) => ({ v: t.name, l: t.name })),
  ]);

  protected readonly applyTypeOptions = computed<SelectOption[]>(() =>
    this.leaveTypes().map((t) => ({ v: t.name, l: `${t.name} (${t.days}d/yr - ${t.paid ? 'Paid' : 'Unpaid'})` })),
  );

  protected readonly typeForm = signal<LeaveType>({ id: '', name: '', days: 0, paid: true, color: '#2563eb', desc: '' });
  protected readonly viewTarget = signal<LeaveRequest | null>(null);

  protected readonly applyType = signal('Annual Leave');
  protected readonly applyEmployeeId = signal('');
  protected readonly applyFrom = signal('');
  protected readonly applyTo = signal('');
  protected readonly applyReason = signal('');

  // Duration calculation for leave application
  protected readonly calculatedDays = computed(() => {
    const from = this.applyFrom();
    const to = this.applyTo();
    if (!from || !to) return 0;
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 0;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  });

  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const t = this.typeFilter().toLowerCase().trim();
    const s = this.statusFilter().toLowerCase().trim();

    return this.requests().filter((r) => {
      const matchSearch =
        !q ||
        r.n.toLowerCase().includes(q) ||
        r.t.toLowerCase().includes(q) ||
        r.r.toLowerCase().includes(q);

      const matchType = !t || r.t.toLowerCase() === t || r.t.toLowerCase().includes(t);
      const matchStatus = !s || r.s.toLowerCase() === s;

      return matchSearch && matchType && matchStatus;
    });
  });

  ngOnInit(): void {
    this.loadTypes();
    this.loadRequests();
    this.loadEmployees();
  }

  ngAfterViewInit(): void {
    // Prevent browser password/contact managers from autofilling into search box
    const wipeAutofill = () => {
      if (this.searchInputRef?.nativeElement && !this.search()) {
        this.searchInputRef.nativeElement.value = '';
      }
    };
    setTimeout(wipeAutofill, 50);
    setTimeout(wipeAutofill, 150);
    setTimeout(wipeAutofill, 300);
    setTimeout(wipeAutofill, 600);
    setTimeout(wipeAutofill, 1200);
  }

  protected onSearchInput(val: string): void {
    this.search.set(val || '');
  }

  protected clearSearch(): void {
    this.search.set('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
  }

  protected clearAllFilters(): void {
    this.search.set('');
    this.typeFilter.set('');
    this.statusFilter.set('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
  }

  private loadEmployees(): void {
    this.api.employees({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => {
        this.employees.set(res.items);
        if (res.items.length > 0 && !this.applyEmployeeId()) {
          this.applyEmployeeId.set(res.items[0].id);
        }
      },
      error: () => {},
    });
  }

  private loadTypes(): void {
    this.api.leaveTypes().subscribe({
      next: (types) => {
        this.leaveTypes.set(
          types.map((t) => ({
            id: t.id,
            name: t.name,
            days: t.maxDaysPerYear,
            paid: t.isPaid,
            color: t.color,
            desc: t.description ?? '',
          })),
        );
        if (types.length > 0 && !this.applyType()) {
          this.applyType.set(types[0].name);
        }
      },
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
    if (!value) return '';
    // Prevent UTC timezone shifts on DateOnly YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parts = value.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
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
      error: (error) => this.toast.show(error?.error?.detail || error?.error?.message || error?.error?.title || 'Could not update the leave request.', 'danger'),
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
      error: (error) => this.toast.show(error?.error?.detail || error?.error?.message || error?.error?.title || 'Could not save the leave type.', 'danger'),
    });
  }

  protected deleteType(id: string): void {
    if (!confirm('Are you sure you want to delete this leave type?')) {
      return;
    }

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
      error: (error) => this.toast.show(error?.error?.detail || error?.error?.message || error?.error?.title || 'Could not delete the leave type.', 'danger'),
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

    if (to < from) {
      this.toast.show('End date must be on or after start date.', 'danger');
      return;
    }

    const employeeId = this.isAdmin() && this.applyEmployeeId() ? this.applyEmployeeId() : null;

    this.api
      .createLeaveRequest({
        employeeId: employeeId,
        leaveTypeId: type.id,
        fromDate: from,
        toDate: to,
        reason: this.applyReason().trim() || 'Personal',
      })
      .subscribe({
        next: () => {
          this.ui.close('applyModal');
          this.toast.show('Leave request submitted!');
          this.applyReason.set('');
          this.applyFrom.set('');
          this.applyTo.set('');
          this.loadRequests();
        },
        error: (error) => this.toast.show(error?.error?.detail || error?.error?.message || error?.error?.title || 'Could not submit the leave request.', 'danger'),
      });
  }
}
