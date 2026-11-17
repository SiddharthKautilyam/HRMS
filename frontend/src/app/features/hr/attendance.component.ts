import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { AttendanceRecord, EmployeeListItem, MonthlyMusterDay, TodayAttendanceOverview } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';

interface Regularization {
  id: string;
  employeeId?: string;
  employeeName: string;
  n?: string;
  date: string;
  inTime: string;
  outTime: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
}

interface DynamicAttendanceRow {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workHours: number;
  status: string;
  device?: string;
}

interface MusterDay {
  day: number;
  dateStr: string;
  dayOfWeek: string;
  isWeekend: boolean;
  inTime: string;
  outTime: string;
  hours: string;
  status: string;
  color: string;
}

@Component({
  selector: 'app-attendance',
  imports: [CommonModule, FormsModule, IconDirective, RouterModule],
  template: `
    <div class="flex justify-end items-center" style="margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="exportCsv()">
          <span [appIcon]="'download'"></span> Export CSV
        </button>
        @if (perms.canCreate('Attendance')) {
          <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="openQuickPunchModal()">
            <span [appIcon]="'clock'"></span> + Record Punch
          </button>
          <a class="btn btn-outline btn-sm" routerLink="/kiosk" target="_blank" style="display: flex; align-items: center; gap: 6px; border-color: #38bdf8; color: #0284c7; font-weight: 700;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            Face Kiosk ⛶
          </a>
        }
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid-4" style="margin-bottom: 20px;">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.c + '18'" [style.color]="k.c">
            <span [appIcon]="'clock'"></span>
          </div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <!-- Main Navigation Tabs -->
    <div class="tabs-nav-bar" style="display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <button 
        class="tab-btn" 
        [class.active]="tab() === 'daily'" 
        (click)="tab.set('daily')"
        style="padding: 10px 18px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent;"
        [style.border-bottom-color]="tab() === 'daily' ? 'var(--p)' : 'transparent'"
        [style.color]="tab() === 'daily' ? 'var(--p)' : 'var(--muted)'"
      >
        Daily Punch Log
      </button>
      <button 
        class="tab-btn" 
        [class.active]="tab() === 'muster'" 
        (click)="tab.set('muster')"
        style="padding: 10px 18px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent;"
        [style.border-bottom-color]="tab() === 'muster' ? 'var(--p)' : 'transparent'"
        [style.color]="tab() === 'muster' ? 'var(--p)' : 'var(--muted)'"
      >
        Monthly Muster Register
      </button>
      @if (canReg()) {
        <button 
          class="tab-btn" 
          [class.active]="tab() === 'reg'" 
          (click)="tab.set('reg')"
          style="padding: 10px 18px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent;"
          [style.border-bottom-color]="tab() === 'reg' ? 'var(--p)' : 'transparent'"
          [style.color]="tab() === 'reg' ? 'var(--p)' : 'var(--muted)'"
        >
          Regularization Requests
          <span style="background: var(--p); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 20px; margin-left: 6px;">
            {{ pendingCount() }}
          </span>
        </button>
      }
    </div>

    <!-- TAB 1: DAILY PUNCH LOG -->
    @if (tab() === 'daily') {
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="card-title">Daily Punch Records</div>
            <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;">
              <span class="pulse-indicator"></span>
              Live Records
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Instant Search Input with Icon and Clear Button -->
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 10px; color: var(--muted); pointer-events: none; display: flex;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input 
                #searchInput
                type="search" 
                id="attendance_search_filter_query"
                name="attendance_search_filter_query"
                class="form-control" 
                placeholder="Search employee, ID, dept..." 
                style="width: 220px; font-size: 12px; padding: 6px 28px 6px 30px;"
                [value]="searchKeyword()"
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
              @if (searchKeyword()) {
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

            <!-- Date Picker Filter -->
            <input 
              type="date" 
              class="form-control" 
              style="width: 140px; font-size: 12px; padding: 6px 10px;"
              [(ngModel)]="filterDate"
              (change)="onFilterDateChange()"
            />

            <!-- Status Dropdown Filter -->
            <select 
              class="form-control" 
              style="width: 130px; font-size: 12px; padding: 6px 10px;"
              [ngModel]="filterStatus()"
              (ngModelChange)="filterStatus.set($event)"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="HalfDay">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="OnLeave">On Leave</option>
            </select>

            <!-- Refresh Button -->
            <button 
              class="btn btn-outline btn-sm" 
              style="display: flex; align-items: center; gap: 5px; padding: 6px 12px;"
              (click)="refreshDailyAttendance()"
              title="Refresh live attendance"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Work Hours</th>
                <th>Status</th>
                <th>Device/Method</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredDailyRows(); track row.id) {
                <tr>
                  <td>
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
                  <td style="font-size: 13px; color: var(--muted);">{{ row.department }}</td>
                  <td style="font-size: 13px; font-weight: 600;">{{ row.date }}</td>
                  <td style="font-size: 13px; font-weight: 700; color: var(--text);">
                    {{ row.checkIn || '—' }}
                  </td>
                  <td style="font-size: 13px; font-weight: 700; color: var(--text);">
                    {{ row.checkOut || '—' }}
                  </td>
                  <td style="font-size: 13px; font-weight: 600;">
                    {{ row.workHours ? (row.workHours + ' hrs') : '—' }}
                  </td>
                  <td>
                    <span class="badge" [class]="statusClass(row.status)">
                      {{ row.status }}
                    </span>
                  </td>
                  <td>
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); background: var(--bg); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border);">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p)" stroke-width="2"><path d="M12 12c0-3 2.5-5.5 5.5-5.5.7 0 1.4.1 2 .4"/><path d="M12 12c0 3-2.5 5.5-5.5 5.5-.7 0-1.4-.1-2-.4"/><path d="M12 7c-2.8 0-5 2.2-5 5 0 3.9 3.1 7 7 7 1.9 0 3.7-.8 5-2.1"/><path d="M12 2C6.5 2 2 6.5 2 12c0 3.3 1.6 6.2 4.1 8"/><path d="M22 12c0-5.5-4.5-10-10-10"/></svg>
                      {{ row.device || 'Face Terminal' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" style="text-align: center; padding: 36px 20px; color: var(--muted);">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                      <div style="font-size: 13px; font-weight: 500;">
                        @if (searchKeyword() || filterStatus()) {
                          No attendance records found matching filters: "{{ searchKeyword() || filterStatus() }}".
                        } @else {
                          No attendance records found for {{ filterDate }}.
                        }
                      </div>
                      @if (searchKeyword() || filterStatus()) {
                        <button 
                          type="button" 
                          class="btn btn-outline btn-sm btn-auto" 
                          style="width: auto !important; height: auto !important; padding: 6px 14px !important; font-size: 12px; margin-top: 4px; display: inline-flex; align-items: center; gap: 6px;"
                          (click)="clearFilters()"
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
    }

    <!-- TAB 2: MONTHLY MUSTER -->
    @if (tab() === 'muster') {
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div class="card-title">Employee Monthly Muster</div>
            <div style="font-size: 12px; color: var(--muted);">Comprehensive month-long attendance calendar breakdown</div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <select class="form-control" style="width: 200px; font-size: 12px;" [(ngModel)]="selectedMusterEmpId" (change)="generateMuster()">
              @for (emp of employees(); track emp.id) {
                <option [value]="emp.id">{{ emp.fullName }} ({{ emp.department }})</option>
              }
            </select>
            <input 
              type="month" 
              class="form-control" 
              style="width: 140px; font-size: 12px;" 
              [(ngModel)]="selectedMusterMonth" 
              (change)="generateMuster()"
            />
          </div>
        </div>

        <div class="table-wrap" style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr>
                <th style="padding: 8px 12px;">Day &amp; Date</th>
                <th style="padding: 8px 12px;">Weekday</th>
                <th style="padding: 8px 12px;">In Time</th>
                <th style="padding: 8px 12px;">Out Time</th>
                <th style="padding: 8px 12px;">Work Hours</th>
                <th style="padding: 8px 12px;">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (day of musterDays(); track day.day) {
                <tr [style.background]="day.isWeekend ? 'var(--bg)' : 'transparent'">
                  <td style="padding: 8px 12px; font-weight: 700;">
                    Day {{ day.day }} ({{ day.dateStr }})
                  </td>
                  <td style="padding: 8px 12px; color: var(--muted);">
                    {{ day.dayOfWeek }}
                  </td>
                  <td style="padding: 8px 12px; font-weight: 600;">
                    {{ day.inTime }}
                  </td>
                  <td style="padding: 8px 12px; font-weight: 600;">
                    {{ day.outTime }}
                  </td>
                  <td style="padding: 8px 12px; font-weight: 700;">
                    {{ day.hours }}
                  </td>
                  <td style="padding: 8px 12px;">
                    <span [style.color]="day.color" style="font-weight: 700; font-size: 12px;">
                      {{ day.status }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" style="text-align: center; padding: 24px; color: var(--muted);">
                    No muster data available for this employee and month.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- TAB 3: REGULARIZATION REQUESTS -->
    @if (canReg() && tab() === 'reg') {
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div class="card-title">Regularization Requests</div>
          <button class="btn btn-primary btn-sm" (click)="openRegModal()">+ New Request</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of regData(); track r.id) {
                <tr>
                  <td>
                    <div class="table-avatar">
                      <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p); font-weight: 700;">
                        {{ (r.employeeName || r.n || 'E').charAt(0) }}
                      </div>
                      <span style="font-weight: 700; font-size: 13px;">{{ r.employeeName || r.n }}</span>
                    </div>
                  </td>
                  <td style="font-size: 13px; font-weight: 600;">{{ r.date }}</td>
                  <td style="font-size: 13px; font-weight: 700;">{{ r.inTime }}</td>
                  <td style="font-size: 13px; font-weight: 700;">{{ r.outTime }}</td>
                  <td style="font-size: 13px; color: var(--muted); max-width: 220px;">{{ r.reason }}</td>
                  <td>
                    <span class="badge" [class]="regClass(r.status)">{{ r.status }}</span>
                  </td>
                  <td>
                    @if (r.status === 'Pending') {
                      @if (perms.canEdit('Attendance')) {
                        <div style="display: flex; gap: 6px;">
                          <button class="tbl-btn success" (click)="regAction(r, 'Approved')" data-tooltip="Approve">
                            <span [appIcon]="'check'"></span>
                          </button>
                          <button class="tbl-btn danger" (click)="regAction(r, 'Rejected')" data-tooltip="Reject">
                            <span [appIcon]="'x'"></span>
                          </button>
                        </div>
                      } @else {
                        <span style="font-size: 12px; color: var(--muted);">Pending</span>
                      }
                    } @else {
                      <span style="font-size: 12px; color: var(--muted); font-weight: 600;">Resolved</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" style="text-align: center; padding: 24px; color: var(--muted);">
                    No regularization requests found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Modal: Request Regularization -->
    @if (showRegModal()) {
      <div class="modal-overlay open" (click)="showRegModal.set(false)">
        <div class="modal" style="max-width: 480px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">Submit Regularization Request</div>
            <button class="btn btn-ghost btn-sm" (click)="showRegModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Employee <span style="color: var(--danger)">*</span></label>
              <select class="form-control" [(ngModel)]="newReg.employeeId">
                @for (e of employees(); track e.id) {
                  <option [value]="e.id">{{ e.fullName }} ({{ e.department }})</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="date" [(ngModel)]="newReg.date" />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">In Time</label>
                <input class="form-control" type="time" [(ngModel)]="newReg.inTime" />
              </div>
              <div class="form-group">
                <label class="form-label">Out Time</label>
                <input class="form-control" type="time" [(ngModel)]="newReg.outTime" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reason <span style="color: var(--danger)">*</span></label>
              <textarea class="form-control" rows="3" [(ngModel)]="newReg.reason" placeholder="Reason for missed punch..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showRegModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="submitNewReg()">Submit Request</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Quick Live Punch -->
    @if (showPunchModal()) {
      <div class="modal-overlay open" (click)="showPunchModal.set(false)">
        <div class="modal" style="max-width: 450px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">Record Live Punch</div>
            <button class="btn btn-ghost btn-sm" (click)="showPunchModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Employee <span style="color: var(--danger)">*</span></label>
              <select class="form-control" [(ngModel)]="punchForm.employeeId">
                @for (e of employees(); track e.id) {
                  <option [value]="e.id">{{ e.fullName }} ({{ e.department }})</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Punch Type <span style="color: var(--danger)">*</span></label>
              <div style="display: flex; gap: 12px; margin-top: 4px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600;">
                  <input type="radio" [(ngModel)]="punchForm.punchType" value="ClockIn" name="punchType" />
                  Clock In
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600;">
                  <input type="radio" [(ngModel)]="punchForm.punchType" value="ClockOut" name="punchType" />
                  Clock Out
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Note / Reason</label>
              <input class="form-control" type="text" [(ngModel)]="punchForm.note" placeholder="Optional punch note..." />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showPunchModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="submitQuickPunch()">Record Punch</button>
          </div>
        </div>
      </div>
    }

    <style>
      .pulse-indicator {
        width: 8px;
        height: 8px;
        background: #16a34a;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
        animation: pulseLive 2s infinite;
      }
      @keyframes pulseLive {
        0% {
          box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
        }
        70% {
          box-shadow: 0 0 0 6px rgba(22, 163, 74, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
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
    </style>
  `
})
export class AttendanceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchInput') set searchInputSetter(ref: ElementRef<HTMLInputElement> | undefined) {
    this.searchInputRef = ref;
    if (ref?.nativeElement && !this.searchKeyword()) {
      ref.nativeElement.value = '';
      setTimeout(() => {
        if (ref?.nativeElement && !this.searchKeyword()) {
          ref.nativeElement.value = '';
        }
      }, 50);
      setTimeout(() => {
        if (ref?.nativeElement && !this.searchKeyword()) {
          ref.nativeElement.value = '';
        }
      }, 250);
    }
  }
  searchInputRef?: ElementRef<HTMLInputElement>;

  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  protected readonly perms = inject(PermissionService);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  protected readonly tab = signal<'daily' | 'muster' | 'reg'>('daily');
  protected readonly canReg = signal(this.session.activeRole() !== 'Employee');

  // Reactive signals for instant search & filtering
  protected readonly searchKeyword = signal('');
  protected readonly filterStatus = signal('');
  protected filterDate = new Date().toISOString().slice(0, 10);

  protected selectedMusterEmpId = '';
  protected selectedMusterMonth = new Date().toISOString().slice(0, 7);

  protected readonly employees = signal<EmployeeListItem[]>([]);
  protected readonly dailyRows = signal<DynamicAttendanceRow[]>([]);
  protected readonly musterDays = signal<MusterDay[]>([]);
  protected readonly showRegModal = signal(false);
  protected readonly showPunchModal = signal(false);

  private pollInterval: any = null;

  protected newReg = {
    employeeId: '',
    employeeName: '',
    date: new Date().toISOString().slice(0, 10),
    inTime: '09:00',
    outTime: '18:00',
    reason: '',
  };

  protected punchForm = {
    employeeId: '',
    punchType: 'ClockIn',
    note: '',
  };

  protected readonly kpis = signal([
    { l: 'Present Today', v: '0', c: 'var(--success)' },
    { l: 'Absent', v: '0', c: 'var(--danger)' },
    { l: 'Late Arrivals', v: '0', c: 'var(--warning)' },
    { l: 'On Leave', v: '0', c: 'var(--p)' },
  ]);

  protected readonly regData = signal<Regularization[]>([]);

  protected readonly pendingCount = computed(() => this.regData().filter((r) => r.status === 'Pending').length);

  // Reactive computed for instant filter & search matching
  protected readonly filteredDailyRows = computed(() => {
    const q = this.searchKeyword().toLowerCase().trim();
    const st = this.filterStatus().toLowerCase().replace(/\s+/g, '');

    return this.dailyRows().filter((r) => {
      const matchQ =
        !q ||
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);

      const rowSt = r.status.toLowerCase().replace(/\s+/g, '');
      const matchSt = !st || rowSt === st;

      return matchQ && matchSt;
    });
  });

  ngOnInit(): void {
    this.loadEmployees();
    this.loadDailyAttendance();
    this.loadRegularizations();
    this.startLivePolling();
  }

  ngAfterViewInit(): void {
    // Prevent browser password/contact managers from autofilling user's email into search box
    const wipeAutofill = () => {
      if (this.searchInputRef?.nativeElement && !this.searchKeyword()) {
        this.searchInputRef.nativeElement.value = '';
      }
    };
    setTimeout(wipeAutofill, 50);
    setTimeout(wipeAutofill, 150);
    setTimeout(wipeAutofill, 300);
    setTimeout(wipeAutofill, 600);
    setTimeout(wipeAutofill, 1200);
  }

  ngOnDestroy(): void {
    this.stopLivePolling();
  }

  private startLivePolling(): void {
    // Automatically poll every 10 seconds to keep Live Records updated in real-time
    this.pollInterval = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (this.tab() === 'daily' && this.filterDate === todayStr) {
        this.loadDailyAttendance(true);
      }
    }, 10000);
  }

  private stopLivePolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  protected onSearchInput(val: string): void {
    this.searchKeyword.set(val || '');
  }

  protected onSearchChange(val: string): void {
    this.searchKeyword.set(val || '');
  }

  protected clearSearch(): void {
    this.searchKeyword.set('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
  }

  protected clearFilters(): void {
    this.searchKeyword.set('');
    this.filterStatus.set('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
  }

  protected refreshDailyAttendance(): void {
    this.loadDailyAttendance(false);
    this.toast.show('Attendance records refreshed');
  }

  private loadEmployees(): void {
    this.api.employees({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => {
        this.employees.set(res.items);
        if (res.items.length > 0 && !this.selectedMusterEmpId) {
          this.selectedMusterEmpId = res.items[0].id;
          this.newReg.employeeId = res.items[0].id;
          this.newReg.employeeName = res.items[0].fullName;
          this.punchForm.employeeId = res.items[0].id;
          this.generateMuster();
        }
      },
      error: () => {},
    });
  }

  protected loadDailyAttendance(silent: boolean = false): void {
    this.api.todayAttendanceOverview(this.filterDate).subscribe({
      next: (res: TodayAttendanceOverview) => {
        if (res) {
          const presentCount = res.presentCount ?? 0;
          const absentCount = res.absentCount ?? 0;
          const lateCount = res.lateCount ?? 0;
          const onLeaveCount = res.onLeaveCount ?? 0;
          this.kpis.set([
            { l: 'Present Today', v: `${presentCount}`, c: 'var(--success)' },
            { l: 'Absent', v: `${absentCount}`, c: 'var(--danger)' },
            { l: 'Late Arrivals', v: `${lateCount}`, c: 'var(--warning)' },
            { l: 'On Leave', v: `${onLeaveCount}`, c: 'var(--p)' },
          ]);

          const rows: DynamicAttendanceRow[] = [];

          // 1. Present employees
          for (const p of res.present || []) {
            rows.push({
              id: p.employeeId,
              employeeCode: p.employeeCode,
              employeeName: p.employeeName,
              department: p.department,
              date: this.filterDate,
              checkIn: p.checkInTime || '—',
              checkOut: p.checkOutTime || '—',
              workHours: p.workHours ?? 0,
              status: p.status || 'Present',
              device: 'Face Terminal / Web',
            });
          }

          // 2. OnLeave employees
          for (const p of res.onLeave || []) {
            rows.push({
              id: p.employeeId,
              employeeCode: p.employeeCode,
              employeeName: p.employeeName,
              department: p.department,
              date: this.filterDate,
              checkIn: '—',
              checkOut: '—',
              workHours: 0,
              status: 'On Leave',
              device: p.leaveReason ? `Leave: ${p.leaveReason}` : 'Approved Leave',
            });
          }

          // 3. Absent employees
          for (const p of res.absent || []) {
            rows.push({
              id: p.employeeId,
              employeeCode: p.employeeCode,
              employeeName: p.employeeName,
              department: p.department,
              date: this.filterDate,
              checkIn: '—',
              checkOut: '—',
              workHours: 0,
              status: 'Absent',
              device: '—',
            });
          }

          this.dailyRows.set(rows);
        } else {
          this.dailyRows.set([]);
        }
      },
      error: () => {
        if (!silent) {
          this.dailyRows.set([]);
        }
      },
    });
  }

  protected onFilterDateChange(): void {
    this.loadDailyAttendance();
  }

  protected openQuickPunchModal(): void {
    if (this.employees().length > 0 && !this.punchForm.employeeId) {
      this.punchForm.employeeId = this.employees()[0].id;
    }
    this.showPunchModal.set(true);
  }

  protected submitQuickPunch(): void {
    if (!this.punchForm.employeeId) {
      this.toast.show('Please select an employee', 'danger');
      return;
    }

    this.api
      .recordPunch({
        employeeId: this.punchForm.employeeId,
        punchType: this.punchForm.punchType,
        note: this.punchForm.note || 'Manual Punch (HR Console)',
        device: 'HR Console',
      })
      .subscribe({
        next: (p) => {
          this.showPunchModal.set(false);
          this.punchForm.note = '';
          this.toast.show(`Recorded ${p.punchType} for ${p.employeeName}!`);
          this.loadDailyAttendance();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Failed to record punch', 'danger');
        },
      });
  }

  protected generateMuster(): void {
    if (!this.selectedMusterEmpId) return;

    const parts = this.selectedMusterMonth.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || new Date().getMonth() + 1;

    this.api.muster(this.selectedMusterEmpId, year, month).subscribe({
      next: (data: MonthlyMusterDay[]) => {
        const mapped: MusterDay[] = (data || []).map((d) => {
          const dateObj = new Date(d.date + 'T00:00:00');
          const dayNum = dateObj.getDate();
          const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const isWeekend = d.status === 'Weekend' || dateObj.getDay() === 0 || dateObj.getDay() === 6;

          let color = '#16a34a';
          if (d.status === 'Weekend') color = '#9ca3af';
          else if (d.status === 'Late') color = '#d97706';
          else if (d.status === 'Absent') color = '#dc2626';
          else if (d.status === 'OnLeave') color = '#0284c7';
          else if (d.status === 'Scheduled') color = '#8b5cf6';
          else if (d.status === 'HalfDay') color = '#ea580c';

          return {
            day: dayNum,
            dateStr: d.date,
            dayOfWeek,
            isWeekend,
            inTime: d.checkIn || '—',
            outTime: d.checkOut || '—',
            hours: d.workHours ? `${d.workHours} hrs` : '0',
            status: d.status,
            color,
          };
        });
        this.musterDays.set(mapped);
      },
      error: () => {
        this.musterDays.set([]);
      },
    });
  }

  protected loadRegularizations(): void {
    this.api.regularizations().subscribe({
      next: (res: any[]) => {
        this.regData.set(
          (res || []).map((item) => ({
            id: item.id,
            employeeId: item.employeeId,
            employeeName: item.employeeName || item.n || '—',
            n: item.employeeName || item.n || '—',
            date: item.date,
            inTime: item.inTime,
            outTime: item.outTime,
            reason: item.reason,
            status: item.status,
          }))
        );
      },
      error: () => {},
    });
  }

  protected statusClass(s: string): string {
    const l = s.toLowerCase().replace(/\s+/g, '');
    if (l === 'present') return 'badge-success';
    if (l === 'late') return 'badge-warning';
    if (l === 'absent') return 'badge-danger';
    if (l === 'halfday') return 'badge-warning';
    if (l === 'onleave') return 'badge-primary';
    return 'badge-primary';
  }

  protected regClass(s: string): string {
    return s === 'Approved' ? 'badge-success' : s === 'Rejected' ? 'badge-danger' : 'badge-warning';
  }

  protected exportCsv(): void {
    const headers = ['Employee Code', 'Employee Name', 'Department', 'Date', 'Check In', 'Check Out', 'Hours', 'Status'];
    const rows = this.filteredDailyRows().map((r) =>
      [r.employeeCode, `"${r.employeeName}"`, `"${r.department}"`, r.date, r.checkIn, r.checkOut, r.workHours, r.status].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${this.filterDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Attendance exported to CSV');
  }

  protected openRegModal(): void {
    if (this.employees().length > 0 && !this.newReg.employeeId) {
      this.newReg.employeeId = this.employees()[0].id;
      this.newReg.employeeName = this.employees()[0].fullName;
    }
    this.showRegModal.set(true);
  }

  protected submitNewReg(): void {
    if (!this.newReg.employeeId || !this.newReg.reason) {
      this.toast.show('Please fill in required fields', 'danger');
      return;
    }

    this.api
      .createRegularization({
        employeeId: this.newReg.employeeId,
        date: this.newReg.date,
        inTime: this.newReg.inTime,
        outTime: this.newReg.outTime,
        reason: this.newReg.reason,
      })
      .subscribe({
        next: () => {
          this.showRegModal.set(false);
          this.newReg.reason = '';
          this.toast.show('Regularization request submitted successfully!');
          this.loadRegularizations();
          this.loadDailyAttendance();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Failed to submit regularization request', 'danger');
        },
      });
  }

  protected regAction(r: Regularization, newStatus: 'Approved' | 'Rejected'): void {
    const action$ =
      newStatus === 'Approved'
        ? this.api.approveRegularization(r.id)
        : this.api.rejectRegularization(r.id);

    action$.subscribe({
      next: () => {
        r.status = newStatus;
        this.regData.update((list) => [...list]);
        this.toast.show(`Regularization request ${newStatus.toLowerCase()} successfully`);
        this.loadDailyAttendance();
        this.generateMuster();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || `Failed to ${newStatus.toLowerCase()} request`, 'danger');
      },
    });
  }
}
