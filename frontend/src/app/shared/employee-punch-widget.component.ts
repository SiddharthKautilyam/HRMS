import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, NgZone, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { SessionService } from '../core/services/session.service';
import { EmployeePunchStatus, EmployeePunch } from '../core/api/api.models';

@Component({
  selector: 'app-employee-punch-widget',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (hasEmployeeRecord()) {
      <div class="punch-widget-card" [class.checked-in]="isCheckedIn()">
        <!-- Header: Title, Status Badge, and Timezone info -->
        <div class="widget-header">
          <div class="title-col">
            <div class="widget-badge-row">
              <span class="widget-title">Time Tracker</span>
              <span class="tz-label" [title]="'Company Timezone: ' + (companyTz() || 'UTC')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                {{ companyTz() || 'Asia/Dubai' }}
              </span>
            </div>
            <p class="widget-subtitle">Record daily attendance punches with server-synchronized timestamps</p>
          </div>

          <div class="status-indicator-badge" [class.live]="isCheckedIn()">
            <span class="pulse-dot"></span>
            <span class="status-text">{{ isCheckedIn() ? 'CHECKED IN' : 'CHECKED OUT' }}</span>
          </div>
        </div>

        <!-- Forgotten Check-out Notice (if yesterday was missed) -->
        @if (status()?.hasForgottenCheckOut) {
          <div class="forgotten-notice">
            <div class="notice-icon">⚠️</div>
            <div class="notice-content">
              <strong>Forgotten Check-Out Detected:</strong>
              <span>{{ status()?.regularizationMessage || 'Your previous shift was unclosed and marked Incomplete.' }}</span>
            </div>
            <a [routerLink]="regularizeRoute()" class="btn-regularize">Regularize</a>
          </div>
        }

        <!-- Inline error message (e.g. double submit or race conflict) -->
        @if (errorMessage()) {
          <div class="error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ errorMessage() }}</span>
            <button class="btn-dismiss" (click)="errorMessage.set(null)">✕</button>
          </div>
        }

        <!-- Main Metrics & Action Area -->
        <div class="widget-body">
          <!-- Left: Running Timer & First Punch -->
          <div class="timer-section">
            <div class="timer-display-box">
              <span class="timer-label">TOTAL WORKED TODAY</span>
              <span class="timer-digits" [class.ticking]="isCheckedIn()">{{ timerDisplay() }}</span>
              <span class="timer-subtext">Sum of today's closed punches + active duration</span>
            </div>

            <div class="metric-pill">
              <span class="metric-icon">🌅</span>
              <div class="metric-data">
                <span class="metric-title">First Check-in</span>
                <span class="metric-val">{{ status()?.firstCheckInTime || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Action Button -->
          <div class="action-section">
            <button
              class="punch-toggle-btn"
              [class.btn-check-in]="!isCheckedIn()"
              [class.btn-check-out]="isCheckedIn()"
              [disabled]="submitting() || loading()"
              (click)="togglePunch()"
            >
              @if (submitting()) {
                <span class="spinner"></span>
                <span>Recording Punch...</span>
              } @else if (isCheckedIn()) {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Check Out</span>
              } @else {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Check In</span>
              }
            </button>
            <span class="anti-race-hint">Single-click protected • Server verified</span>
          </div>
        </div>

        <!-- Today's Punch History Dropdown / List -->
        <div class="punch-history-card">
          <div class="history-header" (click)="toggleHistory()">
            <div class="h-left">
              <span class="h-title">Today's Punch Log</span>
              <span class="count-badge">{{ todayPunches().length }}</span>
            </div>
            <button class="btn-toggle-view" type="button">
              {{ showHistory() ? 'Collapse ▲' : 'View History ▼' }}
            </button>
          </div>

          @if (showHistory()) {
            <div class="punches-table-container">
              @if (todayPunches().length === 0) {
                <div class="empty-punches">No punches recorded yet today.</div>
              } @else {
                <table class="punches-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Time</th>
                      <th>Device / Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of todayPunches(); track p.id) {
                      <tr>
                        <td>
                          <span class="type-pill" [class.type-in]="p.punchType === 'ClockIn'" [class.type-out]="p.punchType === 'ClockOut'">
                            {{ p.punchType === 'ClockIn' ? 'Check In' : 'Check Out' }}
                          </span>
                        </td>
                        <td class="punch-time-cell">{{ formatTime(p.punchTime) }}</td>
                        <td class="punch-device-cell">{{ p.device || 'Web' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .punch-widget-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
        position: relative;
        overflow: hidden;
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .punch-widget-card.checked-in {
        border-color: rgba(34, 197, 94, 0.4);
        box-shadow: 0 4px 24px -2px rgba(34, 197, 94, 0.12);
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
      }
      .title-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .widget-badge-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .widget-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-heading, #0f172a);
        letter-spacing: -0.01em;
      }
      .tz-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted, #64748b);
        background: var(--bg-subtle, #f1f5f9);
        padding: 2px 8px;
        border-radius: 6px;
      }
      .widget-subtitle {
        margin: 0;
        font-size: 12px;
        color: var(--text-muted, #64748b);
      }

      .status-indicator-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 20px;
        background: #f1f5f9;
        color: #475569;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        border: 1px solid #e2e8f0;
      }
      .status-indicator-badge.live {
        background: rgba(34, 197, 94, 0.12);
        color: #15803d;
        border-color: rgba(34, 197, 94, 0.3);
      }
      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #94a3b8;
      }
      .status-indicator-badge.live .pulse-dot {
        background: #22c55e;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
        animation: pulse 1.8s infinite;
      }
      @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
      }

      /* Forgotten Check-out Notice */
      .forgotten-notice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 16px;
        font-size: 13px;
      }
      .notice-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .btn-regularize {
        background: #d97706;
        color: #ffffff;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 12px;
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.15s ease;
      }
      .btn-regularize:hover {
        background: #b45309;
      }

      /* Error banner */
      .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 14px;
        font-size: 13px;
      }
      .btn-dismiss {
        margin-left: auto;
        background: transparent;
        border: none;
        color: #b91c1c;
        cursor: pointer;
        font-size: 14px;
      }

      /* Main Body */
      .widget-body {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #edf2f7);
        border-radius: 14px;
        padding: 18px 24px;
      }
      .timer-section {
        display: flex;
        align-items: center;
        gap: 28px;
      }
      .timer-display-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .timer-label {
        font-size: 11px;
        font-weight: 700;
        color: var(--text-muted, #64748b);
        letter-spacing: 0.05em;
      }
      .timer-digits {
        font-size: 32px;
        font-weight: 800;
        color: var(--text-heading, #0f172a);
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        letter-spacing: 0.04em;
        line-height: 1.1;
      }
      .timer-digits.ticking {
        color: #16a34a;
      }
      .timer-subtext {
        font-size: 11px;
        color: #94a3b8;
      }

      .metric-pill {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 8px 14px;
        border-radius: 10px;
      }
      .metric-icon {
        font-size: 18px;
      }
      .metric-data {
        display: flex;
        flex-direction: column;
      }
      .metric-title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
      }
      .metric-val {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }

      /* Action section */
      .action-section {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }
      .punch-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-width: 170px;
        height: 48px;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      }
      .punch-toggle-btn:active:not(:disabled) {
        transform: scale(0.98);
      }
      .punch-toggle-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .btn-check-in {
        background: linear-gradient(135deg, #16a34a, #15803d);
        box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3);
      }
      .btn-check-in:hover:not(:disabled) {
        background: linear-gradient(135deg, #15803d, #166534);
        box-shadow: 0 6px 18px rgba(22, 163, 74, 0.4);
      }

      .btn-check-out {
        background: linear-gradient(135deg, #e11d48, #be123c);
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      .btn-check-out:hover:not(:disabled) {
        background: linear-gradient(135deg, #be123c, #9f1239);
        box-shadow: 0 6px 18px rgba(225, 29, 72, 0.4);
      }

      .anti-race-hint {
        font-size: 11px;
        color: #94a3b8;
      }

      /* Spinner */
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* History section */
      .punch-history-card {
        margin-top: 14px;
        border-top: 1px dashed var(--border, #e2e8f0);
        padding-top: 12px;
      }
      .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
      }
      .h-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .h-title {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
      }
      .count-badge {
        background: #f1f5f9;
        color: #475569;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 10px;
      }
      .btn-toggle-view {
        background: none;
        border: none;
        font-size: 12px;
        font-weight: 600;
        color: #3b82f6;
        cursor: pointer;
      }

      .punches-table-container {
        margin-top: 10px;
      }
      .empty-punches {
        font-size: 12px;
        color: #94a3b8;
        padding: 8px 0;
        font-style: italic;
      }
      .punches-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .punches-table th {
        text-align: left;
        color: #64748b;
        font-weight: 600;
        padding: 6px 10px;
        border-bottom: 1px solid #edf2f7;
      }
      .punches-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #f8fafc;
        color: #1e293b;
      }
      .type-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 11px;
      }
      .type-in {
        background: #dcfce7;
        color: #15803d;
      }
      .type-out {
        background: #ffe4e6;
        color: #be123c;
      }

      /* Mobile responsiveness */
      @media (max-width: 640px) {
        .widget-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .widget-body {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          padding: 14px;
        }
        .timer-section {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .action-section {
          align-items: stretch;
        }
        .punch-toggle-btn {
          width: 100%;
        }
        .timer-digits {
          font-size: 28px;
        }
      }
    `,
  ],
})
export class EmployeePunchWidgetComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly zone = inject(NgZone);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly status = signal<EmployeePunchStatus | null>(null);
  protected readonly showHistory = signal(false);

  // Server clock synchronization
  private serverOffsetMs = 0;
  protected readonly timerDisplay = signal('00:00:00');
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly hasEmployeeRecord = computed(() => {
    const user = this.session.user();
    return !!user?.employeeId;
  });

  protected readonly isCheckedIn = computed(() => this.status()?.isCheckedIn ?? false);
  protected readonly companyTz = computed(() => this.status()?.companyTimeZone ?? 'Asia/Dubai');
  protected readonly todayPunches = computed(() => this.status()?.todayPunches ?? []);

  protected readonly regularizeRoute = computed(() => {
    const role = this.session.activeRole();
    return role === 'Employee' ? '/me/attendance' : '/attendance';
  });

  ngOnInit(): void {
    if (this.hasEmployeeRecord()) {
      this.loadStatus();
      this.startTimer();
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  loadStatus(): void {
    this.loading.set(true);
    this.api.punchStatus().subscribe({
      next: (res) => {
        this.status.set(res);
        // Compute offset between server UTC and client clock
        const serverTime = new Date(res.serverTimeUtc).getTime();
        this.serverOffsetMs = serverTime - Date.now();
        this.updateTimerDisplay();
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        // Don't show disruptive error if user has no employee record
        if (err.status !== 400 && err.status !== 404) {
          this.errorMessage.set(err.error?.message || 'Could not load punch status.');
        }
      },
    });
  }

  togglePunch(): void {
    if (this.submitting() || this.loading()) return;
    this.errorMessage.set(null);
    this.submitting.set(true);

    const nextType = this.isCheckedIn() ? 'ClockOut' : 'ClockIn';

    this.api.recordPunch({ punchType: nextType, device: 'Web Dashboard' }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.loadStatus();
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.message || err.error?.title || (err.status === 409 ? 'Punch action conflict.' : 'Failed to record punch.');
        this.errorMessage.set(msg);
        this.loadStatus(); // refresh true state
      },
    });
  }

  private startTimer(): void {
    this.zone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        this.zone.run(() => this.updateTimerDisplay());
      }, 1000);
    });
  }

  private updateTimerDisplay(): void {
    const s = this.status();
    if (!s) {
      this.timerDisplay.set('00:00:00');
      return;
    }

    let totalSeconds = s.workedSecondsToday;

    if (s.isCheckedIn && s.currentCheckInTimeUtc) {
      const nowServerMs = Date.now() + this.serverOffsetMs;
      const punchStartMs = new Date(s.currentCheckInTimeUtc).getTime();
      const openSeconds = Math.max(0, Math.floor((nowServerMs - punchStartMs) / 1000));
      totalSeconds += openSeconds;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.timerDisplay.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }
}
