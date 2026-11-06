import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { TemplateDashboardComponent } from './template-dashboard.component';
import { SitecoreDashboardComponent } from './sitecore-dashboard.component';
import { SuperAdminDashboardComponent } from './super-admin-dashboard.component';

/** Routes `/dashboard` based on role: Super Admin platform dashboard vs workspace/modules dashboard. */
@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, TemplateDashboardComponent, SitecoreDashboardComponent, SuperAdminDashboardComponent],
  template: `
    @if (isSuperAdmin()) {
      <app-super-admin-dashboard />
    } @else {
      <div class="dash-mode-bar">
        <div class="dash-mode-tabs">
          <button
            class="mode-btn"
            [class.active]="mode() === 'workspace'"
            (click)="mode.set('workspace')"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            Overview &amp; Multi-Widgets
          </button>
          <button
            class="mode-btn"
            [class.active]="mode() === 'modules'"
            (click)="mode.set('modules')"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Module Shortcuts
          </button>
        </div>
      </div>

      @if (mode() === 'workspace') {
        <app-template-dashboard />
      } @else {
        <app-sitecore-dashboard />
      }
    }
  `,
  styles: [
    `
      .dash-mode-bar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
      }
      .dash-mode-tabs {
        display: inline-flex;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 10px;
        padding: 3px;
        gap: 3px;
      }
      .mode-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        background: transparent;
        border-radius: 7px;
        cursor: pointer;
        color: var(--muted, #6b7280);
        transition: all 0.15s ease;

        &.active {
          background: var(--p, #2563eb);
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly mode = signal<'workspace' | 'modules'>('workspace');
  protected readonly isSuperAdmin = computed(() => this.session.activeRole() === 'Super Admin');

  ngOnInit(): void {
    if (this.session.activeRole() === 'Employee') {
      void this.router.navigateByUrl('/me/dashboard', { replaceUrl: true });
    }
  }
}
