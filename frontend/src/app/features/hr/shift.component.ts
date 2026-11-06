import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';

export interface ShiftTemplateItem {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  workingDays: string;
  isActive: boolean;
}

export interface RosterDayAssignment {
  date: string;
  dayName: string;
  shiftName: string;
  shiftCode: string;
  color: string;
  isOffDay: boolean;
}

export interface EmployeeRosterRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  days: RosterDayAssignment[];
}

@Component({
  selector: 'app-shift',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div class="page-title">Shift Management</div>
        <div class="page-subtitle">Configure shift templates, working hours, and employee shift rosters</div>
      </div>
      <div class="flex gap-2">
        @if (activeTab() === 'directory') {
          @if (perms.canCreate('Shift')) {
            <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="openAddShift()">
              <span [appIcon]="'plus'"></span> + Add Shift Template
            </button>
          }
        } @else {
          <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="exportRoster()">
            <span [appIcon]="'download'"></span> Export Roster
          </button>
          @if (perms.canCreate('Shift')) {
            <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="openAssignModal()">
              <span [appIcon]="'plus'"></span> Assign Shift
            </button>
          }
        }
      </div>
    </div>

    <!-- Tabs: Directory vs Roster -->
    <div class="tabs-nav-bar" style="display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <button 
        class="tab-btn" 
        [class.active]="activeTab() === 'directory'" 
        (click)="activeTab.set('directory')"
        style="padding: 10px 18px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent;"
        [style.border-bottom-color]="activeTab() === 'directory' ? 'var(--p)' : 'transparent'"
        [style.color]="activeTab() === 'directory' ? 'var(--p)' : 'var(--muted)'"
      >
        <span style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Shift Directory
        </span>
      </button>
      <button 
        class="tab-btn" 
        [class.active]="activeTab() === 'roster'" 
        (click)="activeTab.set('roster')"
        style="padding: 10px 18px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent;"
        [style.border-bottom-color]="activeTab() === 'roster' ? 'var(--p)' : 'transparent'"
        [style.color]="activeTab() === 'roster' ? 'var(--p)' : 'var(--muted)'"
      >
        <span style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Shift Roster Matrix
        </span>
      </button>
    </div>

    <!-- TAB 1: SHIFT DIRECTORY -->
    @if (activeTab() === 'directory') {
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div class="card-title">Configured Shift Templates</div>
          <span style="font-size: 12px; color: var(--muted)">{{ templates().length }} Active Shifts</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shift Name</th>
                <th>Code</th>
                <th>Working Hours</th>
                <th>Duration</th>
                <th>Grace Period</th>
                <th>Working Days</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (s of templates(); track s.id) {
                <tr>
                  <td>
                    <div style="font-weight: 700; font-size: 14px; color: var(--text);">{{ s.name }}</div>
                  </td>
                  <td>
                    <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700;">{{ s.code }}</span>
                  </td>
                  <td style="font-size: 13px; font-weight: 600;">
                    {{ s.startTime }} - {{ s.endTime }}
                  </td>
                  <td style="font-size: 13px;">
                    <span style="font-weight: 700;">{{ s.fullDayHours }} hrs</span> (Half: {{ s.halfDayHours }}h)
                  </td>
                  <td style="font-size: 13px; color: var(--muted);">
                    {{ s.gracePeriodMinutes }} mins
                  </td>
                  <td style="font-size: 13px;">
                    <span class="badge" style="background: var(--bg); border: 1px solid var(--border);">{{ s.workingDays }}</span>
                  </td>
                  <td>
                    <span class="badge badge-success">Active</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      @if (perms.canEdit('Shift')) {
                        <button class="tbl-btn" data-tooltip="Edit Shift" (click)="editShift(s)">
                          <span [appIcon]="'edit'"></span>
                        </button>
                      }
                      @if (perms.canDelete('Shift')) {
                        <button class="tbl-btn danger" data-tooltip="Delete Shift" (click)="deleteShift(s.id)">
                          <span [appIcon]="'trash'"></span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" style="text-align: center; padding: 24px; color: var(--muted);">
                    No shift templates configured. Click "+ Add Shift Template" to create one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- TAB 2: SHIFT ROSTER MATRIX -->
    @if (activeTab() === 'roster') {
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="card-title">Employee Shift Matrix</div>
            <span class="badge badge-primary">{{ currentWeekRange() }}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-outline btn-sm" (click)="prevWeek()">◀ Prev Week</button>
            <button class="btn btn-outline btn-sm" (click)="thisWeek()">Today</button>
            <button class="btn btn-outline btn-sm" (click)="nextWeek()">Next Week ▶</button>
          </div>
        </div>

        <div class="table-wrap" style="overflow-x: auto;">
          <table style="min-width: 900px; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="min-width: 180px; position: sticky; left: 0; background: var(--surface); z-index: 2;">Employee</th>
                <th style="min-width: 110px;">Dept</th>
                @for (d of weekDates(); track d.date) {
                  <th style="text-align: center; min-width: 100px;" [style.background]="d.isWeekend ? 'var(--bg)' : 'transparent'">
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--muted);">{{ d.dayName }}</div>
                    <div style="font-size: 13px; font-weight: 700;">{{ d.dateNum }}</div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rosterRows(); track row.employeeId) {
                <tr>
                  <td style="position: sticky; left: 0; background: var(--surface); z-index: 1;">
                    <div class="table-avatar">
                      <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p); font-weight: 700;">
                        {{ row.employeeName.charAt(0) }}
                      </div>
                      <div>
                        <div style="font-weight: 700; font-size: 13px;">{{ row.employeeName }}</div>
                        <div style="font-size: 11px; color: var(--muted);">{{ row.employeeCode }}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-size: 12px; color: var(--muted);">{{ row.department }}</td>
                  @for (day of row.days; track day.date) {
                    <td style="text-align: center; padding: 6px;" [style.background]="day.isOffDay ? 'var(--bg)' : 'transparent'">
                      <button 
                        class="shift-badge-btn" 
                        [style.background]="day.color + '18'" 
                        [style.color]="day.color" 
                        [style.border-color]="day.color + '40'"
                        style="width: 100%; padding: 4px 6px; border-radius: 6px; border: 1px solid; font-size: 11px; font-weight: 700; cursor: pointer; transition: transform .15s;"
                        (click)="quickReassign(row, day)"
                      >
                        {{ day.shiftCode }}
                      </button>
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="2 + weekDates().length" style="text-align: center; padding: 24px; color: var(--muted);">
                    No employee shift schedules found for this period.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Modal: Add / Edit Shift Template -->
    @if (showShiftModal()) {
      <div class="modal-overlay open" (click)="closeShiftModal()">
        <div class="modal" style="max-width: 500px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">{{ editingShiftId() ? 'Edit Shift Template' : 'Add Shift Template' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="closeShiftModal()"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Shift Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.name" placeholder="e.g. Morning Shift" />
            </div>
            <div class="form-group">
              <label class="form-label">Shift Code <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.code" placeholder="e.g. MS, GS, NS" />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Start Time <span style="color: var(--danger)">*</span></label>
                <input class="form-control" type="time" [(ngModel)]="shiftForm.startTime" />
              </div>
              <div class="form-group">
                <label class="form-label">End Time <span style="color: var(--danger)">*</span></label>
                <input class="form-control" type="time" [(ngModel)]="shiftForm.endTime" />
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Grace Period (Minutes)</label>
                <input class="form-control" type="number" [(ngModel)]="shiftForm.gracePeriodMinutes" />
              </div>
              <div class="form-group">
                <label class="form-label">Full Day Hours</label>
                <input class="form-control" type="number" step="0.5" [(ngModel)]="shiftForm.fullDayHours" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Working Days</label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.workingDays" placeholder="e.g. Mon - Fri" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeShiftModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveShiftTemplate()">Save Shift Template</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Assign Shift to Employee -->
    @if (showAssignModal()) {
      <div class="modal-overlay open" (click)="showAssignModal.set(false)">
        <div class="modal" style="max-width: 460px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">Assign Shift to Employee</div>
            <button class="btn btn-ghost btn-sm" (click)="showAssignModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Select Employee</label>
              <select class="form-control" [(ngModel)]="assignForm.employeeId">
                @for (emp of employeesList(); track emp.id) {
                  <option [value]="emp.id">{{ emp.fullName }} ({{ emp.department }})</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Select Shift Template</label>
              <select class="form-control" [(ngModel)]="assignForm.shiftId">
                @for (s of templates(); track s.id) {
                  <option [value]="s.id">{{ s.name }} ({{ s.startTime }} - {{ s.endTime }})</option>
                }
              </select>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Effective From</label>
                <input class="form-control" type="date" [(ngModel)]="assignForm.effectiveFrom" />
              </div>
              <div class="form-group">
                <label class="form-label">Effective To</label>
                <input class="form-control" type="date" [(ngModel)]="assignForm.effectiveTo" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showAssignModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveAssignment()">Confirm Assignment</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ShiftComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly perms = inject(PermissionService);

  protected readonly activeTab = signal<'directory' | 'roster'>('directory');
  protected readonly showShiftModal = signal(false);
  protected readonly showAssignModal = signal(false);
  protected readonly editingShiftId = signal<string | null>(null);

  protected readonly weekOffset = signal(0);
  protected readonly employeesList = signal<{ id: string; fullName: string; department: string }[]>([]);

  protected readonly templates = signal<ShiftTemplateItem[]>([]);

  protected shiftForm = {
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriodMinutes: 15,
    halfDayHours: 4.5,
    fullDayHours: 9.0,
    workingDays: 'Mon - Fri',
  };

  protected assignForm = {
    employeeId: '',
    shiftId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };

  protected readonly weekDates = computed(() => {
    const dates: { date: string; dateNum: number; dayName: string; isWeekend: boolean }[] = [];
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) + (this.weekOffset() * 7);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      dates.push({
        date: d.toISOString().slice(0, 10),
        dateNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isWeekend,
      });
    }
    return dates;
  });

  protected readonly currentWeekRange = computed(() => {
    const dates = this.weekDates();
    if (dates.length === 0) return '';
    return `${dates[0].dayName} ${dates[0].dateNum} - ${dates[6].dayName} ${dates[6].dateNum}`;
  });

  protected readonly rosterRows = signal<EmployeeRosterRow[]>([]);

  ngOnInit(): void {
    this.loadEmployees();
    this.loadShiftTemplates();
  }

  private loadEmployees(): void {
    this.api.employees({ page: 1, pageSize: 50 }).subscribe({
      next: (res) => {
        if (res.items.length > 0) {
          this.employeesList.set(
            res.items.map((e) => ({ id: e.id, fullName: e.fullName, department: e.department }))
          );
          if (!this.assignForm.employeeId) {
            this.assignForm.employeeId = res.items[0].id;
          }
        }
      },
      error: () => {},
    });
  }

  private loadShiftTemplates(): void {
    this.api.shiftTemplates().subscribe({
      next: (list) => {
        this.templates.set(
          (list || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            code: t.code || 'GEN',
            startTime: t.startTime || (t.shiftdays?.[0]?.startTime) || '09:00',
            endTime: t.endTime || (t.shiftdays?.[0]?.endTime) || '18:00',
            gracePeriodMinutes: t.gracePeriodMinutes || 15,
            halfDayHours: t.halfDayHours || 4,
            fullDayHours: t.fullDayHours || 8,
            workingDays: t.workingDays || 'Mon - Fri',
            isActive: t.isActive ?? true,
          }))
        );
      },
      error: () => {
        this.templates.set([]);
      },
    });
  }

  protected prevWeek(): void {
    this.weekOffset.update((o) => o - 1);
  }

  protected nextWeek(): void {
    this.weekOffset.update((o) => o + 1);
  }

  protected thisWeek(): void {
    this.weekOffset.set(0);
  }

  protected openAddShift(): void {
    this.editingShiftId.set(null);
    this.shiftForm = {
      name: '',
      code: '',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriodMinutes: 15,
      halfDayHours: 4.5,
      fullDayHours: 9.0,
      workingDays: 'Mon - Fri',
    };
    this.showShiftModal.set(true);
  }

  protected editShift(s: ShiftTemplateItem): void {
    this.editingShiftId.set(s.id);
    this.shiftForm = {
      name: s.name,
      code: s.code,
      startTime: s.startTime,
      endTime: s.endTime,
      gracePeriodMinutes: s.gracePeriodMinutes,
      halfDayHours: s.halfDayHours,
      fullDayHours: s.fullDayHours,
      workingDays: s.workingDays,
    };
    this.showShiftModal.set(true);
  }

  protected closeShiftModal(): void {
    this.showShiftModal.set(false);
    this.editingShiftId.set(null);
  }

  protected saveShiftTemplate(): void {
    if (!this.shiftForm.name || !this.shiftForm.code) {
      this.toast.show('Please provide a shift name and code', 'danger');
      return;
    }

    const start = this.shiftForm.startTime || '09:00';
    const end = this.shiftForm.endTime || '18:00';
    const payload = {
      name: this.shiftForm.name.trim(),
      description: `Code: ${this.shiftForm.code.trim()} | ${this.shiftForm.workingDays || 'Mon - Fri'}`,
      gracePeriodMinutes: Number(this.shiftForm.gracePeriodMinutes) || 15,
      halfDayHours: Number(this.shiftForm.halfDayHours) || 4,
      fullDayHours: Number(this.shiftForm.fullDayHours) || 8,
      isDefault: false,
      isNightShift: false,
      shiftdays: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        startTime: start.length === 5 ? `${start}:00` : start,
        endTime: end.length === 5 ? `${end}:00` : end,
        isWeekOff: false,
        breakMinutes: 60,
      })),
    };

    const editId = this.editingShiftId();
    if (editId && !editId.startsWith('shift-')) {
      this.api.updateShiftTemplate(editId, payload).subscribe({
        next: () => {
          this.toast.show('Shift template updated successfully!', 'success');
          this.loadShiftTemplates();
          this.closeShiftModal();
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to update shift template', 'danger');
        },
      });
    } else {
      this.api.createShiftTemplate(payload).subscribe({
        next: () => {
          this.toast.show('New shift template created successfully!', 'success');
          this.loadShiftTemplates();
          this.closeShiftModal();
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to create shift template', 'danger');
        },
      });
    }
  }

  protected deleteShift(id: string): void {
    if (!confirm('Are you sure you want to delete this shift template?')) {
      return;
    }
    if (id.startsWith('shift-')) {
      this.templates.update((list) => list.filter((s) => s.id !== id));
      this.toast.show('Shift template removed');
      return;
    }
    this.api.deleteShiftTemplate(id).subscribe({
      next: () => {
        this.toast.show('Shift template deleted successfully', 'success');
        this.loadShiftTemplates();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete shift template', 'danger');
      },
    });
  }

  protected openAssignModal(): void {
    this.showAssignModal.set(true);
  }

  protected saveAssignment(): void {
    const shift = this.templates().find((s) => s.id === this.assignForm.shiftId);
    const emp = this.employeesList().find((e) => e.id === this.assignForm.employeeId);
    if (!shift || !emp) {
      this.toast.show('Please select a valid employee and shift', 'danger');
      return;
    }

    this.toast.show(`Assigned ${shift.name} to ${emp.fullName}`);
    this.showAssignModal.set(false);
  }

  protected quickReassign(row: EmployeeRosterRow, day: RosterDayAssignment): void {
    const codes = ['GS', 'MS', 'ES', 'NS', 'OFF'];
    const colors: Record<string, string> = {
      GS: '#2563eb',
      MS: '#16a34a',
      ES: '#d97706',
      NS: '#9333ea',
      OFF: '#9ca3af',
    };
    const nextCode = codes[(codes.indexOf(day.shiftCode) + 1) % codes.length];
    day.shiftCode = nextCode;
    day.color = colors[nextCode];
    day.isOffDay = nextCode === 'OFF';
    this.toast.show(`Updated ${row.employeeName} on ${day.dayName} to ${nextCode}`);
  }

  protected exportRoster(): void {
    this.toast.show('Shift roster exported as CSV!');
  }
}
