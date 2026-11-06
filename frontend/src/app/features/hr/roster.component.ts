import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import {
  DepartmentDto,
  RosterMatrix,
  ShiftAssignmentDto,
  ShiftTemplateDto,
} from '../../core/api/api.models';

@Component({
  selector: 'app-roster',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roster-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Shift Roster Management</h2>
          <p class="text-muted">Schedule employee shifts, view monthly roster matrices, and manage shift templates.</p>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" (click)="openTemplateModal.set(true)">
            ⚙️ Shift Templates
          </button>
          <button class="btn btn-primary" (click)="openAssignModal.set(true)">
            + Assign Shift
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-card">
        <div class="filter-group">
          <label>Department</label>
          <select [(ngModel)]="selectedDepartment" (change)="loadRoster()">
            <option value="">All Departments</option>
            @for (d of departments(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </div>

        <div class="filter-group">
          <label>From Date</label>
          <input type="date" [(ngModel)]="startDate" (change)="loadRoster()" />
        </div>

        <div class="filter-group">
          <label>To Date</label>
          <input type="date" [(ngModel)]="endDate" (change)="loadRoster()" />
        </div>

        <button class="btn btn-outline" (click)="loadRoster()">Refresh Roster</button>
      </div>

      <!-- Matrix Table -->
      <div class="table-container">
        @if (loading()) {
          <div class="loading-state">Generating Shift Roster...</div>
        } @else if (roster(); as matrix) {
          <table class="roster-table">
            <thead>
              <tr>
                <th class="sticky-col">Employee</th>
                @for (d of matrix.dates; track d) {
                  <th class="date-header">
                    <div class="header-day">{{ getDayName(d) }}</div>
                    <div class="header-date">{{ d | date:'d MMM' }}</div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of matrix.rows; track row.employeeId) {
                <tr>
                  <td class="sticky-col emp-cell">
                    <div class="emp-avatar">{{ getInitials(row.employeeName) }}</div>
                    <div>
                      <div class="emp-name">{{ row.employeeName }}</div>
                      <div class="emp-sub">{{ row.employeeCode }} · {{ row.department }}</div>
                    </div>
                  </td>
                  @for (cell of row.days; track cell.date) {
                    <td class="cell" [class.cell-off]="cell.isWeekOff" [class.cell-holiday]="cell.isHoliday" [class.cell-leave]="cell.status === 'Leave'">
                      <div class="cell-status">{{ cell.status }}</div>
                      @if (cell.status === 'Working') {
                        <div class="cell-timing">{{ cell.startTime }} - {{ cell.endTime }}</div>
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="matrix.dates.length + 1" class="text-center py-8 text-muted">
                    No roster entries found for the selected department and dates.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <!-- Shift Template Modal -->
      @if (openTemplateModal()) {
        <div class="modal-backdrop" (click)="openTemplateModal.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Shift Templates</h3>
              <button class="close-btn" (click)="openTemplateModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <div class="template-list">
                @for (t of templates(); track t.id) {
                  <div class="template-item">
                    <div>
                      <div class="font-bold">{{ t.name }} @if (t.isDefault) { <span class="badge badge-primary">Default</span> }</div>
                      <div class="text-xs text-muted">Full: {{ t.fullDayHours }}h · Half: {{ t.halfDayHours }}h · Grace: {{ t.gracePeriodMinutes }}m</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Assign Shift Modal -->
      @if (openAssignModal()) {
        <div class="modal-backdrop" (click)="openAssignModal.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Assign Shift Template</h3>
              <button class="close-btn" (click)="openAssignModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group mb-4">
                <label>Select Template</label>
                <select [(ngModel)]="newAssignment.shiftTemplateId">
                  @for (t of templates(); track t.id) {
                    <option [value]="t.id">{{ t.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group mb-4">
                <label>Start Date</label>
                <input type="date" [(ngModel)]="newAssignment.startDate" />
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" (click)="openAssignModal.set(false)">Cancel</button>
                <button class="btn btn-primary" (click)="saveAssignment()">Save Assignment</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .roster-page {
        padding: 6px 0 24px;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 18px;
        h2 { font-size: 1.3rem; font-weight: 800; margin: 0; }
        .text-muted { font-size: 13px; color: var(--muted, #6b7280); margin-top: 2px; }
      }
      .actions { display: flex; gap: 8px; }
      .btn {
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }
      .btn-primary { background: var(--p, #2563eb); color: #fff; }
      .btn-secondary { background: var(--surface, #ffffff); border-color: var(--border, #e5e7eb); color: var(--text, #374151); }
      .btn-outline { background: transparent; border-color: var(--border, #e5e7eb); color: var(--p, #2563eb); }
      .filters-card {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 12px;
        padding: 14px 18px;
        display: flex;
        gap: 16px;
        align-items: flex-end;
        margin-bottom: 18px;
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        label { font-size: 11px; font-weight: 700; color: var(--muted, #6b7280); text-transform: uppercase; }
        select, input {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--bg, #f9fafb);
          font-size: 13px;
          color: var(--text, #111827);
        }
      }
      .table-container {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 12px;
        overflow-x: auto;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .roster-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        padding: 10px 12px;
        border: 1px solid var(--border, #e5e7eb);
        text-align: center;
      }
      th {
        background: var(--bg, #f8fafc);
        font-weight: 700;
      }
      .sticky-col {
        position: sticky;
        left: 0;
        background: var(--surface, #ffffff);
        z-index: 2;
        text-align: left;
        min-width: 220px;
      }
      .emp-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .emp-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #4338ca;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
      }
      .emp-name { font-weight: 700; color: var(--text, #111827); }
      .emp-sub { font-size: 11px; color: var(--muted, #6b7280); }
      .cell {
        min-width: 110px;
        &.cell-off { background: #f9fafb; color: #9ca3af; }
        &.cell-holiday { background: #fff7ed; color: #c2410c; }
        &.cell-leave { background: #eff6ff; color: #1d4ed8; }
      }
      .cell-status { font-weight: 700; font-size: 11px; }
      .cell-timing { font-size: 10px; color: var(--muted, #6b7280); margin-top: 2px; }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }
      .modal-card {
        background: var(--surface, #ffffff);
        border-radius: 14px;
        width: 440px;
        max-width: 90vw;
        overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      .modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        display: flex;
        justify-content: space-between;
        align-items: center;
        h3 { font-size: 15px; font-weight: 700; margin: 0; }
        .close-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: var(--muted, #6b7280); }
      }
      .modal-body { padding: 20px; }
      .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
      .template-item {
        padding: 10px;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .loading-state { padding: 40px; text-align: center; color: var(--muted, #6b7280); }
    `,
  ],
})
export class RosterComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(false);
  protected readonly roster = signal<RosterMatrix | null>(null);
  protected readonly templates = signal<ShiftTemplateDto[]>([]);
  protected readonly departments = signal<DepartmentDto[]>([]);

  protected selectedDepartment = '';
  protected startDate = new Date().toISOString().substring(0, 10);
  protected endDate = new Date(Date.now() + 13 * 86400000).toISOString().substring(0, 10);

  protected readonly openTemplateModal = signal(false);
  protected readonly openAssignModal = signal(false);
  protected newAssignment = {
    shiftTemplateId: '',
    startDate: new Date().toISOString().substring(0, 10),
  };

  ngOnInit(): void {
    this.api.departments().subscribe({
      next: (depts) => this.departments.set(depts),
      error: () => {},
    });

    this.api.shiftTemplates().subscribe({
      next: (tmpls) => {
        this.templates.set(tmpls);
        if (tmpls.length > 0) this.newAssignment.shiftTemplateId = tmpls[0].id;
      },
      error: () => {},
    });

    this.loadRoster();
  }

  loadRoster(): void {
    this.loading.set(true);
    this.api
      .generateRoster({
        startDate: this.startDate,
        endDate: this.endDate,
        departmentId: this.selectedDepartment || undefined,
      })
      .subscribe({
        next: (matrix) => {
          this.roster.set(matrix);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  saveAssignment(): void {
    this.openAssignModal.set(false);
    this.loadRoster();
  }

  getDayName(dateStr: string): string {
    const d = new Date(dateStr);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
