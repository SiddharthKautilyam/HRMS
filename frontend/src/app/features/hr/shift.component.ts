import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';

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

@Component({
  selector: 'app-shift',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <!-- Top Action Bar (Right aligned) -->
    <div class="flex justify-end items-center" style="margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div class="flex gap-2">
        @if (perms.canCreate('Shift')) {
          <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="openAddShift()">
            <span [appIcon]="'plus'"></span> Add Shift
          </button>
        }
      </div>
    </div>

    <!-- SHIFT TEMPLATES CARD -->
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="card-title">Configured Shifts</div>
        <span style="font-size: 12px; color: var(--muted)">{{ templates().length }} Active Shift{{ templates().length === 1 ? '' : 's' }}</span>
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
                  No shifts configured. Click "+ Add Shift" to create one.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Add / Edit Shift Template -->
    @if (showShiftModal()) {
      <div class="modal-overlay open" (click)="closeShiftModal()">
        <div class="modal" style="max-width: 500px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">{{ editingShiftId() ? 'Edit Shift' : 'Add Shift' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="closeShiftModal()"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Shift Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.name" placeholder="e.g. Morning Shift" />
            </div>
            <div class="form-group">
              <label class="form-label">Shift Code <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.code" placeholder="e.g. MS, GS, NS, ES" />
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
              <label class="form-label">Half Day Hours</label>
              <input class="form-control" type="number" step="0.5" [(ngModel)]="shiftForm.halfDayHours" />
            </div>
            <div class="form-group">
              <label class="form-label">Working Days</label>
              <input class="form-control" type="text" [(ngModel)]="shiftForm.workingDays" placeholder="e.g. Mon - Fri" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeShiftModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveShiftTemplate()">Save Shift</button>
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

  protected readonly showShiftModal = signal(false);
  protected readonly editingShiftId = signal<string | null>(null);
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

  ngOnInit(): void {
    this.loadShiftTemplates();
  }

  protected loadShiftTemplates(): void {
    this.api.shiftTemplates().subscribe({
      next: (list) => {
        this.templates.set(
          (list || []).map((t: any) => {
            let code = t.code || '';
            let workingDays = t.workingDays || '';
            if (t.description) {
              const match = t.description.match(/Code:\s*([^|]+)(?:\s*\|\s*(.*))?/i);
              if (match) {
                if (!code) code = match[1].trim();
                if (!workingDays && match[2]) workingDays = match[2].trim();
              }
            }
            if (!code) {
              code = t.name ? t.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : 'GEN';
            }
            if (!workingDays) workingDays = 'Mon - Fri';

            let rawStart = t.startTime || t.shiftdays?.[0]?.startTime || '09:00';
            let rawEnd = t.endTime || t.shiftdays?.[0]?.endTime || '18:00';
            if (typeof rawStart === 'string' && rawStart.length > 5) rawStart = rawStart.slice(0, 5);
            if (typeof rawEnd === 'string' && rawEnd.length > 5) rawEnd = rawEnd.slice(0, 5);

            return {
              id: t.id,
              name: t.name,
              code,
              startTime: rawStart,
              endTime: rawEnd,
              gracePeriodMinutes: t.gracePeriodMinutes ?? 15,
              halfDayHours: t.halfDayHours ?? 4.5,
              fullDayHours: t.fullDayHours ?? 9.0,
              workingDays,
              isActive: t.isActive ?? true,
            };
          })
        );
      },
      error: () => {
        this.templates.set([]);
      },
    });
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
    if (!this.shiftForm.name?.trim() || !this.shiftForm.code?.trim()) {
      this.toast.show('Please provide a shift name and code', 'danger');
      return;
    }

    const start = this.shiftForm.startTime || '09:00';
    const end = this.shiftForm.endTime || '18:00';
    const payload = {
      name: this.shiftForm.name.trim(),
      description: `Code: ${this.shiftForm.code.trim()} | ${this.shiftForm.workingDays || 'Mon - Fri'}`,
      gracePeriodMinutes: Number(this.shiftForm.gracePeriodMinutes) || 15,
      halfDayHours: Number(this.shiftForm.halfDayHours) || 4.5,
      fullDayHours: Number(this.shiftForm.fullDayHours) || 9.0,
      isDefault: false,
      isNightShift: this.shiftForm.name.toLowerCase().includes('night'),
      shiftdays: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        startTime: start.length === 5 ? `${start}:00` : start,
        endTime: end.length === 5 ? `${end}:00` : end,
        isWeekOff: false,
        breakMinutes: 60,
      })),
    };

    const editId = this.editingShiftId();
    if (editId) {
      this.api.updateShiftTemplate(editId, payload).subscribe({
        next: () => {
          this.toast.show('Shift updated successfully!', 'success');
          this.loadShiftTemplates();
          this.closeShiftModal();
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to update shift', 'danger');
        },
      });
    } else {
      this.api.createShiftTemplate(payload).subscribe({
        next: () => {
          this.toast.show('New shift created successfully!', 'success');
          this.loadShiftTemplates();
          this.closeShiftModal();
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to create shift', 'danger');
        },
      });
    }
  }

  protected deleteShift(id: string): void {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return;
    }
    this.api.deleteShiftTemplate(id).subscribe({
      next: () => {
        this.toast.show('Shift deleted successfully', 'success');
        this.loadShiftTemplates();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete shift', 'danger');
      },
    });
  }
}
