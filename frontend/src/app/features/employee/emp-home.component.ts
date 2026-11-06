import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDashboard } from '../../core/api/api.models';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface LeaveCard {
  n: string;
  total: number;
  label: string;
  sub: string;
  color: string;
}

interface Tile {
  icon: string;
  name: string;
  path: string;
  cls: string;
  badge?: string;
  desc: string;
}

interface Activity {
  color: string;
  title: string;
  time: string;
}

/** Employee home dashboard (tile launcher) — ported from pages/emp-home.html. */
@Component({
  selector: 'app-emp-home',
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  template: `
    <!-- Personal Banner -->
    <div class="emp-banner">
      <div class="emp-avatar-wrap">
        <div class="emp-avatar">{{ dashboard()?.initials ?? '—' }}</div>
        <div class="emp-online"></div>
      </div>
      <div class="emp-info">
        <h2>{{ greeting }}, {{ firstName() }} 👋</h2>
        <p>{{ dateStr }} &nbsp;·&nbsp; {{ dashboard()?.jobTitle ?? '—' }} &nbsp;·&nbsp; {{ dashboard()?.department ?? '—' }}</p>
        <span class="emp-status">{{ dashboard()?.status ?? '—' }} &nbsp;·&nbsp; Check-in: {{ dashboard()?.checkInLabel ?? '—' }}</span>
      </div>
      <div class="emp-banner-actions">
        <button class="btn-white" routerLink="/me/leave">+ Apply Leave</button>
        <button class="btn-white" routerLink="/me/attendance">Attendance</button>
      </div>
    </div>

    <!-- Leave Balance -->
    <div class="tile-section">
      <div class="tile-section-title">Leave Balance</div>
      <div class="leave-grid">
        @for (l of leaveData(); track l.label) {
          <div class="leave-card" routerLink="/me/leave">
            <div class="lc-num" [style.color]="l.color">{{ l.n }}</div>
            <div class="lc-label">{{ l.label }}</div>
            <div class="lc-sub">{{ l.sub }}</div>
            @if (l.total) {
              <div class="lc-bar">
                <div class="lc-bar-fill" [style.width.%]="pct(l)" [style.background]="l.color"></div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Main Tiles -->
    <div class="tile-section">
      <div class="tile-section-title">My Workspace</div>
      <div class="tile-grid">
        @for (t of tiles(); track t.name) {
          <div class="tile" [routerLink]="t.path">
            @if (t.badge) {
              <span class="tile-badge">{{ t.badge }}</span>
            }
            <div class="tile-icon" [class]="t.cls" [innerHTML]="t.icon | safeHtml"></div>
            <div class="tile-main">
              <div class="tile-name">{{ t.name }}</div>
              <div class="tile-desc">{{ t.desc }}</div>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Recent Activity</div>
          <div class="card-subtitle">Your latest actions</div>
        </div>
      </div>
      <div class="card-body">
        @for (a of activity(); track a.title) {
          <div class="activity-row">
            <div class="act-dot" [style.background]="a.color"></div>
            <div class="act-info">
              <div class="act-title">{{ a.title }}</div>
              <div class="act-time">{{ a.time }}</div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .emp-banner {
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%);
        border-radius: 14px;
        padding: 15px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        overflow: hidden;
      }
      .emp-banner::before {
        content: '';
        position: absolute;
        right: -30px;
        top: -30px;
        width: 160px;
        height: 160px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
      }
      .emp-banner::after {
        content: '';
        position: absolute;
        right: 80px;
        bottom: -40px;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.04);
      }
      .emp-avatar-wrap {
        position: relative;
        flex-shrink: 0;
        z-index: 1;
      }
      .emp-avatar {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.3rem;
        font-weight: 800;
        border: 3px solid rgba(255, 255, 255, 0.3);
      }
      .emp-online {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #22c55e;
        border: 2px solid #2563eb;
      }
      .emp-info {
        flex: 1;
        min-width: 0;
        z-index: 1;
      }
      .emp-info h2 {
        font-size: 1.2rem;
        font-weight: 800;
        color: #fff;
        margin-bottom: 3px;
      }
      .emp-info p {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.75);
        margin-bottom: 8px;
      }
      .emp-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.25);
        padding: 3px 10px;
        border-radius: 20px;
      }
      .emp-status::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        flex-shrink: 0;
      }
      .emp-banner-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
        z-index: 1;
      }
      .emp-banner-actions .btn-white {
        padding: 8px 14px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .emp-banner-actions .btn-white:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .leave-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      .leave-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        transition: var(--t);
        cursor: pointer;
      }
      .leave-card:hover {
        border-color: var(--p);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
        transform: translateY(-2px);
      }
      .lc-num {
        font-size: 2rem;
        font-weight: 900;
        line-height: 1;
        margin-bottom: 4px;
      }
      .lc-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 2px;
      }
      .lc-sub {
        font-size: 12px;
        color: var(--muted);
      }
      .lc-bar {
        height: 3px;
        border-radius: 10px;
        background: var(--border);
        margin-top: 8px;
        overflow: hidden;
      }
      .lc-bar-fill {
        height: 100%;
        border-radius: 10px;
      }
      .tile-section {
        margin-bottom: 20px;
      }
      .tile-section-title {
        font-size: 13px;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tile-section-title::before {
        content: '';
        width: 4px;
        height: 16px;
        background: var(--p);
        border-radius: 4px;
        flex-shrink: 0;
      }
      .tile-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .tile {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.18s ease;
        position: relative;
        overflow: hidden;
      }
      .tile:hover {
        border-color: var(--p);
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.1);
        transform: translateY(-2px);
      }
      .tile:hover .tile-icon {
        transform: scale(1.08);
      }
      .tile-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.18s ease;
      }
      .tile-icon svg {
        width: 20px;
        height: 20px;
      }
      .tile-main {
        flex: 1;
        min-width: 0;
        text-align: left;
      }
      .tile-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tile-desc {
        font-size: 13px;
        color: var(--muted);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tile-badge {
        position: absolute;
        top: 7px;
        right: 7px;
        background: var(--p);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .ic-blue { background: #e8f0fe; color: #2563eb; }
      .ic-indigo { background: #ede9fe; color: #6366f1; }
      .ic-green { background: #dcfce7; color: #16a34a; }
      .ic-teal { background: #ccfbf1; color: #0d9488; }
      .ic-orange { background: #ffedd5; color: #ea580c; }
      .ic-purple { background: #f3e8ff; color: #9333ea; }
      .ic-amber { background: #fef3c7; color: #d97706; }
      .ic-red { background: #fee2e2; color: #dc2626; }
      .ic-cyan { background: #cffafe; color: #0891b2; }
      .ic-pink { background: #fce7f3; color: #db2777; }
      .activity-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border);
      }
      .activity-row:last-child {
        border-bottom: none;
      }
      .act-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .act-info {
        flex: 1;
        min-width: 0;
      }
      .act-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }
      .act-time {
        font-size: 12px;
        color: var(--muted);
        margin-top: 1px;
      }
      @media (max-width: 1100px) {
        .tile-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .leave-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 768px) {
        .tile-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .emp-banner-actions {
          display: none;
        }
      }
      @media (max-width: 480px) {
        .emp-banner {
          flex-direction: column;
        }
        .emp-info {
          text-align: center;
        }
        .tile-grid {
          grid-template-columns: repeat(1, 1fr);
        }
        .tile-icon {
          width: 38px;
          height: 38px;
        }
        .lc-num {
          font-size: 1.6rem;
        }
      }
    `,
  ],
})
export class EmpHomeComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly greeting = EmpHomeComponent.greet();
  protected readonly dateStr = EmpHomeComponent.dateString();

  protected readonly dashboard = signal<EmployeeDashboard | null>(null);

  protected readonly firstName = computed(() => (this.dashboard()?.fullName ?? '').split(' ')[0]);

  protected readonly leaveData = computed<LeaveCard[]>(() =>
    (this.dashboard()?.leaveBalances ?? []).map((l) => ({
      n: String(l.balance),
      total: l.total,
      label: l.type.endsWith('Leave') ? l.type : `${l.type} Leave`,
      sub: l.total > 0 ? `of ${l.total} days` : 'As needed',
      color: l.color,
    })),
  );

  protected readonly tiles = computed<Tile[]>(() => {
    const announcements = this.dashboard()?.announcements.length ?? 0;

    return [
      { icon: I.attendance, name: 'Attendance', path: '/me/attendance', cls: 'ic-teal', desc: 'Check-in / out' },
      { icon: I.leave, name: 'Leave', path: '/me/leave', cls: 'ic-green', desc: 'Apply & track' },
      { icon: I.payslip, name: 'Payslips', path: '/me/payslips', cls: 'ic-indigo', desc: 'View payslips' },
      { icon: I.profile, name: 'My Profile', path: '/me/profile', cls: 'ic-blue', desc: 'View & edit' },
      { icon: I.documents, name: 'Documents', path: '/me/documents', cls: 'ic-cyan', desc: 'My files' },
      { icon: I.loans, name: 'Loans', path: '/me/payroll', cls: 'ic-amber', desc: 'Requests' },
      {
        icon: I.announce,
        name: 'Announcements',
        path: '/me/announcements',
        cls: 'ic-pink',
        badge: announcements > 0 ? String(announcements) : undefined,
        desc: 'New updates',
      },
      { icon: I.settings, name: 'Settings', path: '/me/settings', cls: 'ic-indigo', desc: 'Preferences' },
    ];
  });

  protected readonly activity = computed<Activity[]>(() => {
    const palette = ['#22c55e', '#2563eb', '#f59e0b', '#6366f1', '#0d9488'];
    return (this.dashboard()?.activity ?? []).map((a, i) => ({
      color: palette[i % palette.length],
      title: `${a.action} - ${a.status}`,
      time: a.dateLabel,
    }));
  });

  ngOnInit(): void {
    this.api.dashboardMe().subscribe({
      next: (dashboard) => this.dashboard.set(dashboard),
      error: () => {
        /* API offline — the dashboard stays empty. */
      },
    });
  }

  /** Percentage fill for the leave progress bar (0 when the value is not numeric). */
  protected pct(l: LeaveCard): number {
    const n = parseFloat(l.n);
    return Number.isNaN(n) ? 0 : Math.round((n / l.total) * 100);
  }

  private static greet(): string {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  }

  private static dateString(): string {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
}

const I = {
  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  leave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
  payslip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  announce: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  loans: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};
