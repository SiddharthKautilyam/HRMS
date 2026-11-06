import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface Integration {
  name: string;
  desc: string;
  status: 'Connected' | 'Error' | 'Pending';
  last: string;
  icon: string;
}

interface SyncLog {
  msg: string;
  time: string;
  ok: boolean;
}

/** ERP Integration — ported from pages/erp.html. */
@Component({
  selector: 'app-erp',
  imports: [CommonModule, IconDirective, SafeHtmlPipe],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">ERP Integration</div>
        <div class="page-subtitle">Manage system integrations and sync status</div>
      </div>
      <button class="btn btn-primary btn-sm" (click)="sync()"><span [appIcon]="'sync'"></span> Sync Now</button>
    </div>

    <div class="grid-4" style="margin-bottom: 24px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.c + '20'" [style.color]="k.c"><span [appIcon]="'link'"></span></div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div class="grid-2" style="margin-bottom: 24px">
      <div class="card">
        <div class="card-header" style="margin-bottom: 12px"><div class="card-title">Connected Integrations</div></div>
        <div class="card-body" style="padding-top: 4px">
          @for (s of integrations(); track s.name) {
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border)">
              <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--p)" [innerHTML]="s.icon | safeHtml"></div>
              <div style="flex: 1">
                <div style="font-size: 0.875rem; font-weight: 700">{{ s.name }}</div>
                <div style="font-size: 0.86rem; color: var(--muted)">{{ s.desc }}</div>
              </div>
              <div style="text-align: right">
                <span class="badge" [class]="statusClass(s.status)">{{ s.status }}</span>
                <div style="font-size: 0.86rem; color: var(--muted); margin-top: 3px">{{ s.last }}</div>
              </div>
              <button class="btn btn-ghost btn-sm" (click)="toast.show('Configuring...')"><span [appIcon]="'gear'"></span></button>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="margin-bottom: 12px">
          <div class="card-title">Sync Logs</div>
          <span class="badge badge-danger">2 Errors</span>
        </div>
        <div class="card-body" style="padding-top: 4px">
          @for (l of logs(); track l.msg) {
            <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border)">
              <div [style.background]="l.ok ? 'var(--success)' : 'var(--danger)'" style="width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0"></div>
              <div style="flex: 1; font-size: 0.82rem; color: var(--text)">{{ l.msg }}</div>
              <div style="font-size: 0.86rem; color: var(--muted); white-space: nowrap">{{ l.time }}</div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ErpComponent implements OnInit {
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly kpis = signal([
    { l: 'Connected Systems', v: '4', c: '#10B981' },
    { l: 'Last Sync', v: '2h ago', c: 'var(--p)' },
    { l: 'Sync Errors', v: '2', c: '#EF4444' },
    { l: 'Records Synced', v: '12,840', c: '#F59E0B' },
  ]);

  protected readonly integrations = signal<Integration[]>([
    { name: 'SAP ERP', desc: 'Finance & Accounting sync', status: 'Connected', last: '2h ago', icon: SVG.building },
    { name: 'Oracle HCM', desc: 'HR data synchronization', status: 'Connected', last: '2h ago', icon: SVG.erp },
    { name: 'Face Recognition System', desc: 'Attendance & access control', status: 'Error', last: 'Failed', icon: SVG.user },
    { name: 'Email Server', desc: 'SMTP notifications', status: 'Connected', last: 'Active', icon: SVG.mail },
    { name: 'Active Directory', desc: 'User authentication', status: 'Connected', last: 'Active', icon: SVG.lock },
    { name: 'Payroll Bank API', desc: 'WPS payment gateway', status: 'Pending', last: 'Not configured', icon: SVG.money },
  ]);

  protected readonly logs = signal<SyncLog[]>([
    { msg: 'Payroll data synced to SAP', time: '2h ago', ok: true },
    { msg: 'Employee records updated · 284 records', time: '2h ago', ok: true },
    { msg: 'Face terminal sync failed · Connection timeout', time: '3h ago', ok: false },
    { msg: 'Leave balances synced to Oracle HCM', time: '5h ago', ok: true },
    { msg: 'WPS payment file generated', time: '1d ago', ok: true },
    { msg: 'Active Directory sync failed · Auth error', time: '1d ago', ok: false },
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected sync(): void {
    this.api.erpSync().subscribe({
      next: (overview) => {
        this.apply(overview);
        this.toast.show('Sync completed');
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Sync failed.', 'danger'),
    });
  }

  private load(): void {
    this.api.erpOverview().subscribe({
      next: (overview) => this.apply(overview),
      error: () => {
        /* API offline — keep the demo integration data. */
      },
    });
  }

  private apply(overview: {
    connectedSystems: number;
    lastSyncLabel: string;
    syncErrors: number;
    recordsSynced: number;
    integrations: { name: string; description: string; status: string; lastSyncLabel: string; iconKey: string }[];
    logs: { message: string; timeLabel: string; success: boolean }[];
  }): void {
    this.kpis.set([
      { l: 'Connected Systems', v: `${overview.connectedSystems}`, c: '#10B981' },
      { l: 'Last Sync', v: overview.lastSyncLabel, c: 'var(--p)' },
      { l: 'Sync Errors', v: `${overview.syncErrors}`, c: '#EF4444' },
      { l: 'Records Synced', v: overview.recordsSynced.toLocaleString(), c: '#F59E0B' },
    ]);

    this.integrations.set(
      overview.integrations.map((i) => ({
        name: i.name,
        desc: i.description,
        status: i.status as Integration['status'],
        last: i.lastSyncLabel,
        icon: SVG[i.iconKey as keyof typeof SVG] ?? SVG.link,
      })),
    );

    this.logs.set(
      overview.logs.map((l) => ({ msg: l.message, time: l.timeLabel, ok: l.success })),
    );
  }

  protected statusClass(status: Integration['status']): string {
    return `badge-${status === 'Connected' ? 'success' : status === 'Error' ? 'danger' : 'warning'}`;
  }
}

const SVG = {
  link: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  building: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>`,
  erp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  user: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mail: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  money: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="12" cy="15" r="2"/></svg>`,
};
