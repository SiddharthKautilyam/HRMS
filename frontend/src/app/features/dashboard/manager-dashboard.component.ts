import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface TeamMember {
  init: string;
  name: string;
  role: string;
  status: string;
  sc: string;
}

interface Tile {
  icon: string;
  name: string;
  path: string;
  cls: string;
  badge?: string;
  desc?: string;
}

/** Manager Dashboard — ported from pages/dashboard-mgr.html. */
@Component({
  selector: 'app-manager-dashboard',
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  template: `
    <!-- Banner -->
    <div class="role-banner">
      <div class="rb-text" style="position: relative; z-index: 1">
        <h2>{{ greeting }}, Manager 👋</h2>
        <p>Department Overview &nbsp;·&nbsp; {{ team().length }} Team Members</p>
      </div>
      <div class="rb-stats">
        <div class="rb-stat"><div class="rb-stat-val">{{ team().length }}</div><div class="rb-stat-lbl">Team Size</div></div>
        <div class="rb-stat-div"></div>
        <div class="rb-stat"><div class="rb-stat-val">{{ presentCount() }}</div><div class="rb-stat-lbl">Present</div></div>
        <div class="rb-stat-div"></div>
        <div class="rb-stat"><div class="rb-stat-val">{{ pendingCount() }}</div><div class="rb-stat-lbl">Pending</div></div>
      </div>
    </div>

    <!-- Team Members Quick View -->
    <div class="tile-section">
      <div class="tile-section-title">My Team — Today's Status</div>
      <div class="team-quick">
        @for (m of team(); track m.name) {
          <div class="tm-card" routerLink="/employees">
            <div class="tm-main">
              <div class="tm-avatar">{{ m.init }}</div>
              <div class="tm-main-title">
                <div class="tm-name">{{ m.name }}</div>
                <div class="tm-role">{{ m.role }}</div>
              </div>
            </div>
            <span class="badge" [class]="'badge-' + m.sc">{{ m.status }}</span>
          </div>
        } @empty {
          <div style="padding: 24px; color: var(--muted); font-size: 13px;">No team members registered yet.</div>
        }
      </div>
    </div>

    @for (section of sections; track section.title) {
      <div class="tile-section">
        <div class="tile-section-title">{{ section.title }}</div>
        <div class="tile-grid-4">
          @for (t of section.tiles; track t.name) {
            <div class="tile" [routerLink]="t.path">
              @if (t.badge) {
                <span class="tile-badge">{{ t.badge }}</span>
              }
              <div class="tile-icon" [class]="t.cls" [innerHTML]="t.icon | safeHtml"></div>
              <div class="tile-name">{{ t.name }}</div>
              @if (t.desc) {
                <div class="tile-desc">{{ t.desc }}</div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .role-banner {
        background: linear-gradient(135deg, #0f4c81 0%, #1d6fa4 60%, #2563eb 100%);
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        position: relative;
        overflow: hidden;
      }
      .role-banner::before {
        content: '';
        position: absolute;
        right: -40px;
        top: -40px;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
      }
      .role-banner::after {
        content: '';
        position: absolute;
        right: 60px;
        bottom: -50px;
        width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.04);
      }
      .rb-text h2 {
        font-size: 1.2rem;
        font-weight: 800;
        color: #fff;
        margin-bottom: 4px;
      }
      .rb-text p {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }
      .rb-stats {
        display: flex;
        gap: 20px;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }
      .rb-stat {
        text-align: center;
      }
      .rb-stat-val {
        font-size: 1.4rem;
        font-weight: 800;
        color: #fff;
        line-height: 1;
      }
      .rb-stat-lbl {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.65);
        margin-top: 3px;
        font-weight: 600;
      }
      .rb-stat-div {
        width: 1px;
        background: rgba(255, 255, 255, 0.2);
        align-self: stretch;
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
      .tile-grid-4 {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }
      .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.18s ease;
        text-align: center;
        min-height: 110px;
        position: relative;
        overflow: hidden;
      }
      .tile:hover {
        border-color: var(--p);
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.12);
        transform: translateY(-3px);
      }
      .tile:hover .tile-icon {
        transform: scale(1.1);
      }
      .tile-icon {
        width: 45px;
        height: 45px;
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
      .tile-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
      }
      .tile-desc {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.4;
      }
      .tile-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: var(--danger);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 20px;
        line-height: 1.4;
      }
      .ic-blue { background: #e8f0fe; color: #2563eb; }
      .ic-indigo { background: #ede9fe; color: #6366f1; }
      .ic-green { background: #dcfce7; color: #16a34a; }
      .ic-teal { background: #ccfbf1; color: #0d9488; }
      .ic-orange { background: #ffedd5; color: #ea580c; }
      .ic-purple { background: #f3e8ff; color: #9333ea; }
      .ic-amber { background: #fef3c7; color: #d97706; }
      .ic-cyan { background: #cffafe; color: #0891b2; }
      .team-quick {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      .tm-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        text-align: center;
        transition: var(--t);
        cursor: pointer;
      }
      .tm-card:hover {
        border-color: var(--p);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
      }
      .tm-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--p-soft);
        color: var(--p);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 14px;
        flex-shrink: 0;
      }
      .tm-main {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
      }
      .tm-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
      }
      .tm-role {
        font-size: 13px;
        color: var(--muted);
      }
      @media (max-width: 1500px) {
        .team-quick {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 1100px) {
        .tile-grid-4 {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 900px) {
        .tile-grid-4 {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .team-quick {
          grid-template-columns: repeat(2, 1fr);
        }
        .rb-stats {
          display: none;
        }
        .tm-card {
          padding: 10px;
        }
        .tm-avatar {
          width: 36px;
          height: 36px;
          font-size: 12px;
        }
      }
      @media (max-width: 576px) {
        .team-quick {
          grid-template-columns: repeat(1, 1fr);
        }
      }
      @media (max-width: 480px) {
        .tile {
          min-height: 90px;
          padding: 16px 8px;
        }
        .tile-icon {
          width: 44px;
          height: 44px;
        }
      }
    `,
  ],
})
export class ManagerDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly greeting = ManagerDashboardComponent.greet();
  protected readonly team = signal<TeamMember[]>([]);
  protected readonly presentCount = signal(0);
  protected readonly pendingCount = signal(0);

  ngOnInit(): void {
    this.api.employees({ pageSize: 50 }).subscribe({
      next: (res) => {
        const members = (res.items || []).map((e) => ({
          init: (e.fullName || 'E').slice(0, 2).toUpperCase(),
          name: e.fullName,
          role: e.jobTitle || e.department || 'Employee',
          status: 'Active',
          sc: 'success',
        }));
        this.team.set(members);
      },
      error: () => {},
    });

    this.api.approvals({ status: 'Pending' }).subscribe({
      next: (res) => {
        this.pendingCount.set(res?.length || 0);
      },
      error: () => {},
    });
  }

  protected readonly sections: { title: string; tiles: Tile[] }[] = [
    {
      title: 'Attendance',
      tiles: [
        { icon: I.attendance, name: 'Team Attendance', path: '/attendance', cls: 'ic-teal', desc: 'Daily overview' },
        { icon: I.overtime, name: 'Overtime', path: '/attendance', cls: 'ic-orange', desc: 'Track extra hours' },
        { icon: I.wfh, name: 'Work From Home', path: '/attendance', cls: 'ic-blue', desc: 'Remote tracking' },
        { icon: I.reports, name: 'Att. Reports', path: '/reports', cls: 'ic-indigo', desc: 'Monthly summary' },
      ],
    },
    {
      title: 'Leave Approvals',
      tiles: [
        { icon: I.approvals, name: 'All Approvals', path: '/approvals', cls: 'ic-amber', desc: 'Needs action' },
        { icon: I.leave, name: 'Leave Requests', path: '/leave', cls: 'ic-green', desc: 'Pending review' },
        { icon: I.overtime, name: 'Overtime Req.', path: '/approvals', cls: 'ic-orange', desc: 'Pending review' },
        { icon: I.wfh, name: 'WFH Requests', path: '/approvals', cls: 'ic-cyan', desc: 'Remote requests' },
      ],
    },
    {
      title: 'Team Management',
      tiles: [
        { icon: I.team, name: 'Team Members', path: '/employees', cls: 'ic-blue', desc: 'All staff records' },
        { icon: I.profile, name: 'Profiles', path: '/employee-profile', cls: 'ic-indigo', desc: 'View details' },
        { icon: I.goals, name: 'Goals', path: '/reports', cls: 'ic-purple', desc: 'Performance review' },
        { icon: I.hire, name: 'Request Hire', path: '/employees', cls: 'ic-green', desc: 'New position' },
      ],
    },
  ];

  private static greet(): string {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  }
}

const I = {
  team: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  leave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
  approvals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  hire: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  overtime: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="16" y1="18" x2="18" y2="20"/><line x1="18" y1="18" x2="16" y2="20"/></svg>`,
  wfh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
};
