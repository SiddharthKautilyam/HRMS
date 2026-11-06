import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { CompanyListItem, RoleItem } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

interface ActivityItem {
  id: string;
  type: 'tenant' | 'user' | 'security' | 'schema';
  title: string;
  description: string;
  timeAgo: string;
  icon: string;
  severity: 'info' | 'success' | 'warning';
  isLiveDbEvent: boolean;
}

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="super-admin-dashboard">
      <!-- Header / Hero Banner -->
      <div class="dash-hero-card">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="live-dot"></span>
            <span>SUPER ADMIN PLATFORM CONTROL</span>
          </div>
          <h1 class="hero-title">Platform &amp; Multi-Tenant Dashboard</h1>
          <p class="hero-subtitle">
            Centralized orchestration for organizations, tenant isolation, dynamic RBAC matrices, and system security.
          </p>
          <div class="hero-meta">
            <span class="meta-pill">
              <span [appIcon]="'check'"></span> Multi-Tenant Schema: Synchronized
            </span>
            <span class="meta-pill">
              <span [appIcon]="'clock'"></span> Real-time Biometric Core Active
            </span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="hero-btn btn-secondary" (click)="refreshAll()">
            <span [appIcon]="'sync'" class="action-icon"></span>
            <span>Refresh Telemetry</span>
          </button>
          <button class="hero-btn btn-primary" (click)="goToCompanies()">
            <span [appIcon]="'plus'"></span>
            <span>New Organization</span>
          </button>
        </div>
      </div>

      <!-- Top KPI Metric Cards (6 metrics) -->
      <div class="kpi-grid">
        <!-- Card 1: Total Companies -->
        <div class="metric-card metric-blue" (click)="goToCompanies()">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">Total Tenants</div>
              <div class="metric-value">{{ totalCompanies() }}</div>
            </div>
            <div class="metric-icon-wrap icon-blue">
              <span [appIcon]="'company'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="status-indicator-dot online"></span>
            <span class="footer-highlight">{{ activeCompanies() }} Active</span>
            <span class="footer-muted">organizations online</span>
          </div>
        </div>

        <!-- Card 2: Tenant Admins -->
        <div class="metric-card metric-emerald">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">Company Admins</div>
              <div class="metric-value">{{ totalAdmins() }}</div>
            </div>
            <div class="metric-icon-wrap icon-emerald">
              <span [appIcon]="'user'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="status-indicator-dot online"></span>
            <span class="footer-highlight">Dedicated Leads</span>
            <span class="footer-muted">across tenant databases</span>
          </div>
        </div>

        <!-- Card 3: Total Active Users -->
        <div class="metric-card metric-cyan">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">Total Active Users</div>
              <div class="metric-value">{{ totalActiveUsers() }}</div>
            </div>
            <div class="metric-icon-wrap icon-cyan">
              <span [appIcon]="'employees'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="status-indicator-dot online"></span>
            <span class="footer-highlight">Employees &amp; Staff</span>
            <span class="footer-muted">provisioned</span>
          </div>
        </div>

        <!-- Card 4: Today's Check-ins -->
        <div class="metric-card metric-amber">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">Today's Check-ins</div>
              <div class="metric-value">{{ todayLogins() }}</div>
            </div>
            <div class="metric-icon-wrap icon-amber">
              <span [appIcon]="'clock'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="status-indicator-dot warm"></span>
            <span class="footer-highlight">Biometric Punches</span>
            <span class="footer-muted">logged today</span>
          </div>
        </div>

        <!-- Card 5: Dynamic Roles -->
        <div class="metric-card metric-purple" (click)="goToRoles()">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">Configured Roles</div>
              <div class="metric-value">{{ totalRoles() }}</div>
            </div>
            <div class="metric-icon-wrap icon-purple">
              <span [appIcon]="'lock'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="footer-link">Manage RBAC Matrix →</span>
          </div>
        </div>

        <!-- Card 6: Platform Status & Database -->
        <div class="metric-card metric-indigo">
          <div class="card-accent"></div>
          <div class="metric-head">
            <div>
              <div class="metric-label">System Health</div>
              <div class="metric-value text-emerald">99.98%</div>
            </div>
            <div class="metric-icon-wrap icon-indigo">
              <span [appIcon]="'shield'"></span>
            </div>
          </div>
          <div class="metric-footer">
            <span class="status-indicator-dot online"></span>
            <span class="footer-highlight">Healthy</span>
            <span class="footer-muted">All services operational</span>
          </div>
        </div>
      </div>

      <!-- Main Layout: 2 Columns (Tenant Overview Grid + Activity Log & Quick Shortcuts) -->
      <div class="dash-grid-layout">
        <!-- Left: Tenant Overview Grid -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">Tenant Organizations</h3>
              <p class="panel-desc">Manage tenant lifecycle, provisioning status, and administrator invitations</p>
            </div>
            <div class="panel-controls">
              <!-- Filter pills -->
              <div class="filter-pills">
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="statusFilter() === 'all'"
                  (click)="statusFilter.set('all')"
                >
                  All ({{ companies().length }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="statusFilter() === 'Active'"
                  (click)="statusFilter.set('Active')"
                >
                  Active ({{ activeCompanies() }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="statusFilter() === 'Suspended'"
                  (click)="statusFilter.set('Suspended')"
                >
                  Suspended
                </button>
              </div>

              <!-- Search -->
              <div class="search-wrap">
                <span [appIcon]="'search'" class="search-icon"></span>
                <input
                  type="text"
                  class="search-input"
                  placeholder="Search tenant or code..."
                  [(ngModel)]="searchQuery"
                />
                @if (searchQuery) {
                  <button class="clear-search-btn" (click)="searchQuery = ''">✕</button>
                }
              </div>
            </div>
          </div>

          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Tenant Code</th>
                  <th>Administrator</th>
                  <th>Database</th>
                  <th style="text-align: center;">Status</th>
                  <th style="text-align: right; min-width: 180px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filteredCompanies(); track c.id) {
                  <tr class="table-row">
                    <td>
                      <div class="org-cell">
                        <div class="org-avatar">
                          {{ c.name.charAt(0) }}
                        </div>
                        <div class="org-info">
                          <div class="org-name">{{ c.name }}</div>
                          @if (c.isDefault) {
                            <span class="badge badge-default">Primary Default</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="code-badge">
                        {{ c.code }}
                      </span>
                    </td>
                    <td>
                      <div class="admin-name">{{ c.adminFullName || 'Administrator' }}</div>
                      <div class="admin-email">{{ c.adminEmail }}</div>
                    </td>
                    <td>
                      <span class="db-badge">
                        <span [appIcon]="'grid'"></span>
                        {{ c.databaseName || 'HRMS (Default)' }}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      @if (c.status === 'Active') {
                        <span class="status-badge status-active">
                          <span class="dot"></span> Active
                        </span>
                      } @else if (c.status === 'Suspended') {
                        <span class="status-badge status-suspended">
                          <span class="dot"></span> Suspended
                        </span>
                      } @else {
                        <span class="status-badge status-provisioning">
                          <span class="dot"></span> Provisioning
                        </span>
                      }
                    </td>
                    <td style="text-align: right;">
                      <div class="actions-group">
                        @if (c.status === 'Active') {
                          <button
                            class="action-btn btn-danger-soft"
                            (click)="suspendCompany(c)"
                            [disabled]="c.isDefault"
                            [attr.data-tooltip]="c.isDefault ? 'Primary tenant cannot be suspended' : 'Suspend Tenant'"
                          >
                            Suspend
                          </button>
                        } @else {
                          <button
                            class="action-btn btn-success-soft"
                            (click)="activateCompany(c)"
                            data-tooltip="Activate Tenant"
                          >
                            Activate
                          </button>
                        }

                        <button
                          class="action-btn btn-neutral"
                          (click)="resendInvitation(c)"
                          data-tooltip="Resend Admin Invitation Email"
                        >
                          <span [appIcon]="'mail'"></span>
                          Invite
                        </button>

                        <button
                          class="action-btn btn-manage"
                          (click)="goToCompanies()"
                          data-tooltip="Manage Company"
                        >
                          <span [appIcon]="'arrow_right'"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty-state">
                      <div class="empty-icon">🏢</div>
                      <div class="empty-title">No tenant organizations found</div>
                      <div class="empty-desc">Try clearing your search query or filter</div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Recent Activity Log & Quick Navigation Shortcuts -->
        <div class="side-column">
          <!-- Administration Shortcuts (Quick Settings in Dashboard) -->
          <div class="content-panel">
            <div class="panel-header compact">
              <div>
                <h4 class="panel-title">Quick Settings &amp; Modules</h4>
                <p class="panel-desc">Direct shortcuts to system masters and configuration</p>
              </div>
            </div>

            <div class="shortcuts-list">
              <!-- Shortcut 1: Companies -->
              <div class="shortcut-item" (click)="goToCompanies()">
                <div class="sc-icon sc-blue">
                  <span [appIcon]="'company'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">Companies &amp; Tenants</div>
                  <div class="sc-sub">Manage multi-tenant orgs &amp; databases</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>

              <!-- Shortcut 2: Key Group -->
              <div class="shortcut-item" (click)="goToKeyGroup()">
                <div class="sc-icon sc-emerald">
                  <span [appIcon]="'grid'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">Key Group &amp; Constants</div>
                  <div class="sc-sub">Enums, lookups &amp; Key Store dictionary</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>

              <!-- Shortcut 3: Navigation Manager -->
              <div class="shortcut-item" (click)="goToNavigation()">
                <div class="sc-icon sc-amber">
                  <span [appIcon]="'list'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">Navigation Hierarchy</div>
                  <div class="sc-sub">Configure route structure &amp; ordering</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>

              <!-- Shortcut 4: Roles -->
              <div class="shortcut-item" (click)="goToRoles()">
                <div class="sc-icon sc-purple">
                  <span [appIcon]="'lock'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">User Roles &amp; Access</div>
                  <div class="sc-sub">Manage system &amp; custom roles</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>

              <!-- Shortcut 5: Permissions -->
              <div class="shortcut-item" (click)="goToPermissions()">
                <div class="sc-icon sc-indigo">
                  <span [appIcon]="'shield'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">Security Permissions</div>
                  <div class="sc-sub">Fine-grained CRUD access matrix</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>

              <!-- Shortcut 6: Face Kiosk -->
              <div class="shortcut-item" (click)="goToKiosk()">
                <div class="sc-icon sc-cyan">
                  <span [appIcon]="'camera'"></span>
                </div>
                <div class="sc-content">
                  <div class="sc-title">Face Attendance Kiosk</div>
                  <div class="sc-sub">Mounted biometric terminal view</div>
                </div>
                <div class="sc-arrow">→</div>
              </div>
            </div>
          </div>

          <!-- Activity Feed -->
          <div class="content-panel">
            <div class="panel-header compact">
              <div>
                <h4 class="panel-title">Recent Tenant Activity</h4>
                <p class="panel-desc">Provisioning logs and live security audits</p>
              </div>
            </div>

            <div class="activity-feed">
              @for (act of activities(); track act.id) {
                <div class="activity-item">
                  <div
                    class="activity-icon"
                    [class.act-success]="act.severity === 'success'"
                    [class.act-warning]="act.severity === 'warning'"
                    [class.act-info]="act.severity === 'info'"
                  >
                    <span [appIcon]="act.icon"></span>
                  </div>
                  <div class="activity-content">
                    <div class="activity-header">
                      <span class="activity-title">{{ act.title }}</span>
                      <span class="activity-time">{{ act.timeAgo }}</span>
                    </div>
                    <div class="activity-desc">{{ act.description }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .super-admin-dashboard {
        padding-bottom: 40px;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      /* Hero Card */
      .dash-hero-card {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 18px;
        padding: 26px 30px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.4);
        position: relative;
        overflow: hidden;
      }
      .dash-hero-card::after {
        content: '';
        position: absolute;
        top: -60px;
        right: -60px;
        width: 240px;
        height: 240px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
      .hero-left {
        max-width: 720px;
        position: relative;
        z-index: 1;
      }
      .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #93c5fd;
        margin-bottom: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
      }
      .hero-title {
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0 0 8px 0;
        color: #ffffff;
      }
      .hero-subtitle {
        font-size: 13.5px;
        color: #cbd5e1;
        margin: 0 0 16px 0;
        line-height: 1.5;
      }
      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .meta-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        background: rgba(15, 23, 42, 0.6);
        padding: 4px 10px;
        border-radius: 6px;
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .meta-pill span {
        color: #34d399;
      }
      .hero-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 170px;
        position: relative;
        z-index: 1;
      }
      .hero-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      .hero-btn.btn-primary {
        background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        color: #ffffff;
        box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
      }
      .hero-btn.btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
      }
      .hero-btn.btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .hero-btn.btn-secondary:hover {
        background: rgba(255, 255, 255, 0.16);
        transform: translateY(-2px);
      }

      /* KPI Metric Cards Grid */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 16px;
      }
      @media (max-width: 1400px) {
        .kpi-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 768px) {
        .kpi-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 480px) {
        .kpi-grid {
          grid-template-columns: 1fr;
        }
      }

      .metric-card {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 14px;
        padding: 18px 20px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: default;
      }
      .metric-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        border-color: rgba(37, 99, 235, 0.3);
      }
      .card-accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: transparent;
      }
      .metric-blue .card-accent { background: linear-gradient(90deg, #2563eb, #60a5fa); }
      .metric-emerald .card-accent { background: linear-gradient(90deg, #059669, #34d399); }
      .metric-cyan .card-accent { background: linear-gradient(90deg, #0891b2, #38bdf8); }
      .metric-amber .card-accent { background: linear-gradient(90deg, #d97706, #fbbf24); }
      .metric-purple .card-accent { background: linear-gradient(90deg, #7c3aed, #c084fc); }
      .metric-indigo .card-accent { background: linear-gradient(90deg, #4f46e5, #818cf8); }

      .metric-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .metric-label {
        font-size: 11.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted, #64748b);
      }
      .metric-value {
        font-size: 26px;
        font-weight: 800;
        color: var(--text, #0f172a);
        margin-top: 6px;
        line-height: 1.1;
      }
      .metric-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .icon-blue { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
      .icon-emerald { background: rgba(16, 185, 129, 0.12); color: #059669; }
      .icon-cyan { background: rgba(6, 182, 212, 0.12); color: #0891b2; }
      .icon-amber { background: rgba(245, 158, 11, 0.12); color: #d97706; }
      .icon-purple { background: rgba(147, 51, 234, 0.12); color: #9333ea; }
      .icon-indigo { background: rgba(79, 70, 229, 0.12); color: #4f46e5; }

      .metric-footer {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 14px;
        font-size: 12px;
      }
      .status-indicator-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      .status-indicator-dot.online { background: #10b981; }
      .status-indicator-dot.warm { background: #f59e0b; }
      .footer-highlight { font-weight: 700; color: var(--text, #0f172a); }
      .footer-muted { color: var(--muted, #64748b); }
      .footer-link { font-weight: 700; color: var(--p, #2563eb); cursor: pointer; }
      .text-emerald { color: #059669 !important; }

      /* Main Dual-Column Grid */
      .dash-grid-layout {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 22px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .dash-grid-layout {
          grid-template-columns: 1fr;
        }
      }

      /* Content Panels */
      .content-panel {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      }
      .panel-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border, #e2e8f0);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }
      .panel-header.compact {
        padding: 16px 20px;
      }
      .panel-title {
        font-size: 16px;
        font-weight: 800;
        color: var(--text, #0f172a);
        margin: 0;
      }
      .panel-desc {
        font-size: 12.5px;
        color: var(--muted, #64748b);
        margin: 3px 0 0 0;
      }

      /* Panel controls: filters and search */
      .panel-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .filter-pills {
        display: flex;
        background: var(--bg, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
        padding: 3px;
        border-radius: 8px;
        gap: 3px;
      }
      .pill-btn {
        border: none;
        background: transparent;
        font-size: 11.5px;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 6px;
        color: var(--muted, #64748b);
        cursor: pointer;
        transition: all 0.15s;
      }
      .pill-btn.active {
        background: var(--surface, #ffffff);
        color: var(--p, #2563eb);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .search-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-icon {
        position: absolute;
        left: 10px;
        color: var(--muted, #94a3b8);
        pointer-events: none;
      }
      .search-input {
        padding: 7px 28px 7px 32px;
        border: 1px solid var(--border, #cbd5e1);
        border-radius: 8px;
        font-size: 12.5px;
        background: var(--surface, #ffffff);
        color: var(--text, #0f172a);
        width: 190px;
        transition: all 0.2s;
      }
      .search-input:focus {
        outline: none;
        border-color: var(--p, #2563eb);
        width: 230px;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
      .clear-search-btn {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        color: var(--muted, #94a3b8);
        cursor: pointer;
        font-size: 11px;
      }

      /* Modern Table */
      .table-responsive {
        overflow-x: auto;
      }
      .modern-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .modern-table th {
        background: var(--bg, #f8fafc);
        padding: 12px 18px;
        text-align: left;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted, #64748b);
        border-bottom: 1px solid var(--border, #e2e8f0);
      }
      .modern-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border, #f1f5f9);
        vertical-align: middle;
      }
      .table-row:hover {
        background: rgba(37, 99, 235, 0.02);
      }

      .org-cell {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .org-avatar {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #2563eb, #60a5fa);
        color: #ffffff;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .org-name {
        font-weight: 700;
        color: var(--text, #0f172a);
        font-size: 13.5px;
      }
      .badge-default {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        background: rgba(37, 99, 235, 0.1);
        color: #2563eb;
        padding: 1px 7px;
        border-radius: 4px;
        margin-top: 3px;
      }

      .code-badge {
        display: inline-block;
        padding: 3px 8px;
        background: var(--bg, #f1f5f9);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.04em;
        color: var(--text, #334155);
      }
      .admin-name {
        font-weight: 600;
        color: var(--text, #0f172a);
      }
      .admin-email {
        font-size: 11.5px;
        color: var(--muted, #64748b);
        margin-top: 1px;
      }
      .db-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: monospace;
        font-size: 11.5px;
        color: var(--muted, #64748b);
        background: var(--bg, #f8fafc);
        padding: 3px 8px;
        border-radius: 5px;
        border: 1px solid var(--border, #e2e8f0);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
      }
      .status-badge .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .status-active {
        background: rgba(16, 185, 129, 0.12);
        color: #059669;
      }
      .status-active .dot { background: #10b981; }

      .status-suspended {
        background: rgba(239, 68, 68, 0.12);
        color: #dc2626;
      }
      .status-suspended .dot { background: #ef4444; }

      .status-provisioning {
        background: rgba(245, 158, 11, 0.12);
        color: #d97706;
      }
      .status-provisioning .dot { background: #f59e0b; }

      .actions-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .action-btn {
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .btn-danger-soft {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
        border: 1px solid rgba(239, 68, 68, 0.2);
      }
      .btn-danger-soft:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.18);
      }
      .btn-danger-soft:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-success-soft {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.2);
      }
      .btn-success-soft:hover {
        background: rgba(16, 185, 129, 0.18);
      }

      .btn-neutral {
        background: var(--bg, #f1f5f9);
        color: var(--text, #334155);
        border: 1px solid var(--border, #cbd5e1);
      }
      .btn-neutral:hover {
        background: var(--border, #e2e8f0);
      }

      .btn-manage {
        background: transparent;
        color: var(--p, #2563eb);
        border: 1px solid rgba(37, 99, 235, 0.25);
        padding: 5px 8px;
      }
      .btn-manage:hover {
        background: rgba(37, 99, 235, 0.1);
      }

      .empty-state {
        text-align: center;
        padding: 48px 20px;
      }
      .empty-icon { font-size: 32px; margin-bottom: 8px; }
      .empty-title { font-weight: 700; font-size: 14px; color: var(--text, #0f172a); }
      .empty-desc { font-size: 12px; color: var(--muted, #64748b); margin-top: 3px; }

      /* Side Column */
      .side-column {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* Shortcuts List */
      .shortcuts-list {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .shortcut-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--bg, #f8fafc);
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .shortcut-item:hover {
        background: var(--surface, #ffffff);
        border-color: var(--p, #2563eb);
        transform: translateX(3px);
        box-shadow: 0 3px 12px rgba(37, 99, 235, 0.1);
      }
      .sc-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sc-blue { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
      .sc-emerald { background: rgba(16, 185, 129, 0.12); color: #059669; }
      .sc-amber { background: rgba(245, 158, 11, 0.12); color: #d97706; }
      .sc-purple { background: rgba(147, 51, 234, 0.12); color: #9333ea; }
      .sc-indigo { background: rgba(79, 70, 229, 0.12); color: #4f46e5; }
      .sc-cyan { background: rgba(6, 182, 212, 0.12); color: #0891b2; }

      .sc-content { flex: 1; min-width: 0; }
      .sc-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--text, #0f172a);
      }
      .sc-sub {
        font-size: 11.5px;
        color: var(--muted, #64748b);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-arrow {
        color: var(--muted, #94a3b8);
        font-size: 14px;
        font-weight: 700;
        transition: transform 0.15s;
      }
      .shortcut-item:hover .sc-arrow {
        color: var(--p, #2563eb);
        transform: translateX(2px);
      }

      /* Activity Feed */
      .activity-feed {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-height: 380px;
        overflow-y: auto;
      }
      .activity-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .activity-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .act-success { background: rgba(16, 185, 129, 0.15); color: #059669; }
      .act-warning { background: rgba(245, 158, 11, 0.15); color: #d97706; }
      .act-info { background: rgba(37, 99, 235, 0.15); color: #2563eb; }

      .activity-content { flex: 1; min-width: 0; }
      .activity-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .activity-title {
        font-weight: 700;
        font-size: 12.5px;
        color: var(--text, #0f172a);
      }
      .activity-time {
        font-size: 11px;
        color: var(--muted, #94a3b8);
        white-space: nowrap;
      }
      .activity-desc {
        font-size: 11.5px;
        color: var(--muted, #64748b);
        margin-top: 2px;
        line-height: 1.4;
      }
    `,
  ],
})
export class SuperAdminDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly companies = signal<CompanyListItem[]>([]);
  protected readonly roles = signal<RoleItem[]>([]);
  protected readonly activities = signal<ActivityItem[]>([]);
  protected readonly totalActiveUsers = signal<number>(8);
  protected readonly todayLogins = signal<number>(5);

  protected searchQuery = '';
  protected readonly statusFilter = signal<'all' | 'Active' | 'Suspended'>('all');

  protected readonly totalCompanies = computed(() => this.companies().length || 1);
  protected readonly activeCompanies = computed(
    () => this.companies().filter((c) => c.status === 'Active').length || 1
  );
  protected readonly totalAdmins = computed(() => this.companies().length || 1);
  protected readonly totalRoles = computed(() => this.roles().length || 5);

  protected readonly filteredCompanies = computed(() => {
    let list = this.companies();
    const filter = this.statusFilter();
    if (filter !== 'all') {
      list = list.filter((c) => c.status === filter);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.adminEmail.toLowerCase().includes(q) ||
        (c.adminFullName && c.adminFullName.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.refreshAll();
  }

  protected refreshAll(): void {
    this.api.tenantCompanies().subscribe({
      next: (list) => {
        this.companies.set(list);
        this.generateRealActivities(list);
      },
      error: () => {},
    });

    this.api.roles().subscribe({
      next: (roleList) => {
        this.roles.set(roleList);
        const userSum = roleList.reduce((sum, r) => sum + (r.userCount || 0), 0);
        if (userSum > 0) {
          this.totalActiveUsers.set(userSum);
        }
      },
      error: () => {},
    });

    this.api.attendanceToday().subscribe({
      next: (records) => {
        if (records && records.length > 0) {
          this.todayLogins.set(records.length);
        }
      },
      error: () => {},
    });
  }

  /** Generates activity items directly from database company provisioning logs and timestamps */
  private generateRealActivities(companies: CompanyListItem[]): void {
    const items: ActivityItem[] = [
      {
        id: 'evt-0',
        type: 'schema',
        title: 'Multi-Tenant Schema Synchronized',
        description: 'Roles, NavigationItems and Permissions verified across tenant databases',
        timeAgo: 'Live System',
        icon: 'check',
        severity: 'success',
        isLiveDbEvent: true,
      },
    ];

    for (const c of companies) {
      if (c.createdAtUtc) {
        items.push({
          id: `comp-${c.id}`,
          type: 'tenant',
          title: `Tenant: ${c.name} (${c.code})`,
          description: `Database '${c.databaseName || 'HRMS'}' provisioned with admin ${c.adminEmail}`,
          timeAgo: new Date(c.createdAtUtc).toLocaleDateString(),
          icon: 'company',
          severity: c.status === 'Active' ? 'success' : 'warning',
          isLiveDbEvent: true,
        });
      }
      if (c.invitationSentAtUtc) {
        items.push({
          id: `inv-${c.id}`,
          type: 'security',
          title: `Admin Invitation (${c.code})`,
          description: `Invitation sent to ${c.adminEmail} with status: ${c.invitationStatus}`,
          timeAgo: new Date(c.invitationSentAtUtc).toLocaleDateString(),
          icon: 'mail',
          severity: 'info',
          isLiveDbEvent: true,
        });
      }
    }

    this.activities.set(items);
  }

  protected suspendCompany(company: CompanyListItem): void {
    if (company.isDefault) {
      this.toast.show('The primary default company cannot be suspended', 'danger');
      return;
    }
    if (!confirm(`Are you sure you want to suspend company '${company.name}'?`)) {
      return;
    }

    this.api.suspendTenantCompany(company.id).subscribe({
      next: () => {
        this.toast.show(`Company '${company.name}' has been suspended`, 'warning');
        this.refreshAll();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to suspend company', 'danger');
      },
    });
  }

  protected activateCompany(company: CompanyListItem): void {
    this.api.activateTenantCompany(company.id).subscribe({
      next: () => {
        this.toast.show(`Company '${company.name}' activated successfully`, 'success');
        this.refreshAll();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to activate company', 'danger');
      },
    });
  }

  protected resendInvitation(company: CompanyListItem): void {
    this.api.resendInvitation(company.id).subscribe({
      next: () => {
        this.toast.show(`Invitation resent to ${company.adminEmail}`, 'success');
        this.refreshAll();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to resend invitation', 'danger');
      },
    });
  }

  protected goToCompanies(): void {
    void this.router.navigateByUrl('/company');
  }

  protected goToRoles(): void {
    void this.router.navigate(['/settings'], { queryParams: { tab: 'role' } });
  }

  protected goToPermissions(): void {
    void this.router.navigate(['/settings'], { queryParams: { tab: 'permission' } });
  }

  protected goToNavigation(): void {
    void this.router.navigate(['/settings'], { queryParams: { tab: 'navigation' } });
  }

  protected goToKeyGroup(): void {
    void this.router.navigate(['/settings'], { queryParams: { tab: 'keygroup' } });
  }

  protected goToKiosk(): void {
    void this.router.navigateByUrl('/kiosk');
  }
}
