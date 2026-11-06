import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { PermissionService } from '../../core/services/permission.service';
import { SessionService } from '../../core/services/session.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

interface Tile {
  key: string;
  icon: string;
  label: string;
  path: string;
  iconClass: string;
  desc?: string;
  badge?: number;
}

interface Section {
  title: string;
  tiles: Tile[];
}

/** Tile icons sized by CSS (viewBox only, like the original sitecore page). */
const T = {
  employees: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>`,
  onboarding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  offboarding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>`,
  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  leave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
  holiday: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>`,
  shift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  payroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="12" cy="15" r="2"/></svg>`,
  payslips: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  loans: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  reimburse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>`,
  leaveAppr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
  loanAppr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><polyline points="17 17 19 19 23 15"/></svg>`,
  attAppr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><polyline points="16 18 18 20 22 16"/></svg>`,
  docAppr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>`,
  empReport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="20" x2="18" y2="10"/><line x1="21" y1="20" x2="15" y2="20"/></svg>`,
  attReport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="18" y1="20" x2="18" y2="14"/><line x1="12" y1="20" x2="12" y2="16"/></svg>`,
  payReport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="18" y1="20" x2="18" y2="14"/><line x1="12" y1="20" x2="12" y2="16"/></svg>`,
  leaveReport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="18" y1="20" x2="18" y2="14"/></svg>`,
  company: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  roles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  departments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  designations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};

const tile = (
  key: keyof typeof T,
  label: string,
  path: string,
  iconClass: string,
  desc?: string,
  badge?: number,
): Tile => ({
  key,
  icon: T[key].replace('<svg ', '<svg width="18" height="18" '),
  label,
  path,
  iconClass,
  desc,
  badge,
});

/**
 * HRMS home dashboard — ported from pages/sitecore-dashboard.html. Shows a
 * welcome banner and six sections of module tiles, with a grid/list toggle.
 */
@Component({
  selector: 'app-sitecore-dashboard',
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  template: `
    <!-- Welcome Banner -->
    <div class="sc-banner">
      <div class="sc-banner-text" style="position: relative; z-index: 1">
        <h2>{{ greeting() }}, {{ displayName() }} 👋</h2>
        <p>Welcome to HRMS — Select a module to get started</p>
      </div>
      <div class="sc-banner-stats">
        @for (stat of stats(); track stat.label; let last = $last) {
          <div class="sc-stat">
            <div class="sc-stat-val">{{ stat.value }}</div>
            <div class="sc-stat-lbl">{{ stat.label }}</div>
          </div>
          @if (!last) {
            <div class="sc-stat-div"></div>
          }
        }
      </div>
    </div>

    <!-- View Toggle -->
    <div class="view-toggle">
      <button class="vt-btn" [class.active]="view() === 'grid'" (click)="view.set('grid')" title="Grid View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      </button>
      <button class="vt-btn" [class.active]="view() === 'list'" (click)="view.set('list')" title="List View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
    </div>

    <!-- Tile Grid -->
    <div class="sc-wrap" [class.list-view]="view() === 'list'">
      @for (section of visibleSections(); track section.title) {
        <div class="sc-section">
          <div class="sc-section-title">{{ section.title }}</div>
          <div class="sc-tiles">
            @for (t of section.tiles; track t.key + t.label) {
              <div class="sc-tile" [routerLink]="t.path">
                @if (t.badge) {
                  <span class="sc-tile-badge">{{ t.badge }}</span>
                }
                <div class="sc-tile-icon" [class]="t.iconClass" [innerHTML]="t.icon | safeHtml"></div>
                <div class="sc-main">
                  <div class="sc-tile-name">{{ t.label }}</div>
                  @if (t.desc) {
                    <div class="sc-tile-desc">{{ t.desc }}</div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .sc-wrap {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .sc-section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        box-shadow: var(--shadow);
      }
      .sc-section-title {
        font-size: 14px;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sc-section-title::before {
        content: '';
        width: 4px;
        height: 18px;
        background: var(--p);
        border-radius: 4px;
        flex-shrink: 0;
      }
      .sc-tiles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .sc-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 10px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.18s ease;
        text-align: center;
        min-height: 100px;
        position: relative;
        overflow: hidden;
      }
      .sc-tile:hover {
        border-color: var(--p);
        background: var(--surface);
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12);
        transform: translateY(-2px);
      }
      .sc-tile:hover .sc-tile-icon {
        transform: scale(1.1);
      }
      .sc-tile-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.18s ease;
      }
      :host ::ng-deep .sc-tile-icon svg,
      .sc-tile-icon svg {
        width: 18px;
        height: 18px;
      }
      .sc-tile-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .sc-tile-desc {
        font-size: 13px;
        font-weight: 500;
        color: var(--muted);
        line-height: 1.3;
      }
      .sc-tile-badge {
        position: absolute;
        top: 7px;
        right: 7px;
        background: #ef4444;
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
        pointer-events: none;
      }
      .ic-blue { background: #e8f0fe; color: #2563eb; }
      .ic-indigo { background: #ede9fe; color: #6366f1; }
      .ic-green { background: #dcfce7; color: #16a34a; }
      .ic-red { background: #fee2e2; color: #dc2626; }
      .ic-teal { background: #ccfbf1; color: #0d9488; }
      .ic-orange { background: #ffedd5; color: #ea580c; }
      .ic-purple { background: #f3e8ff; color: #9333ea; }
      .ic-amber { background: #fef3c7; color: #d97706; }
      .ic-pink { background: #fce7f3; color: #db2777; }
      .ic-cyan { background: #cffafe; color: #0891b2; }
      .ic-lime { background: #ecfccb; color: #65a30d; }
      .ic-rose { background: #ffe4e6; color: #e11d48; }
      .sc-banner {
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%);
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
      .sc-banner::before {
        content: '';
        position: absolute;
        right: -40px;
        top: -40px;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
      }
      .sc-banner::after {
        content: '';
        position: absolute;
        right: 60px;
        bottom: -50px;
        width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.04);
      }
      .sc-banner-text h2 {
        font-size: 1.2rem;
        font-weight: 800;
        color: #fff;
        margin-bottom: 4px;
      }
      .sc-banner-text p {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }
      .sc-banner-stats {
        display: flex;
        gap: 20px;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }
      .sc-stat {
        text-align: center;
      }
      .sc-stat-val {
        font-size: 1.4rem;
        font-weight: 800;
        color: #fff;
        line-height: 1;
      }
      .sc-stat-lbl {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.65);
        margin-top: 3px;
        font-weight: 600;
      }
      .sc-stat-div {
        width: 1px;
        background: rgba(255, 255, 255, 0.2);
        align-self: stretch;
      }
      .view-toggle {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
      }
      .vt-btn {
        width: 34px;
        height: 34px;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .vt-btn:hover {
        border-color: var(--p);
        color: var(--p);
      }
      .vt-btn.active {
        background: var(--p);
        border-color: var(--p);
        color: #fff;
      }
      .vt-btn svg {
        width: 16px;
        height: 16px;
      }
      .sc-wrap.list-view .sc-section {
        padding: 16px 20px;
      }
      .sc-wrap.list-view .sc-tiles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .sc-wrap.list-view .sc-tile {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        min-height: unset;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg);
        text-align: left;
      }
      .sc-wrap.list-view .sc-tile:hover {
        border-color: var(--p);
        background: var(--surface);
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12);
        transform: translateY(-2px);
      }
      .sc-wrap.list-view .sc-tile:hover .sc-tile-icon {
        transform: scale(1.1);
      }
      .sc-wrap.list-view .sc-tile-icon {
        width: 28px;
        height: 28px;
        border-radius: 5px;
        flex-shrink: 0;
      }
      :host ::ng-deep .sc-wrap.list-view .sc-tile-icon svg,
      .sc-wrap.list-view .sc-tile-icon svg {
        width: 15px;
        height: 15px;
      }
      .sc-wrap.list-view .sc-tile-name {
        font-size: 14px;
        font-weight: 700;
      }
      .sc-wrap.list-view .sc-tile-desc {
        font-size: 13px;
        margin-top: 1px;
      }
      @media (max-width: 1600px) {
        .sc-wrap {
          grid-template-columns: 1fr;
        }
        .sc-wrap.list-view {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 1200px) {
        .sc-section,
        .sc-wrap.list-view .sc-section {
          padding: 12px;
        }
        .sc-wrap.list-view {
          grid-template-columns: repeat(1, 1fr);
        }
      }
      @media (max-width: 768px) {
        .sc-tiles {
          grid-template-columns: repeat(2, 1fr);
        }
        .sc-banner-stats {
          display: none;
        }
      }
      @media (max-width: 576px) {
        .sc-wrap.list-view .sc-tiles {
          grid-template-columns: repeat(1, 1fr);
        }
      }
      @media (max-width: 480px) {
        .sc-tiles {
          grid-template-columns: repeat(1, 1fr);
        }
        .sc-tile {
          min-height: 80px;
          padding: 12px 6px;
        }
        .sc-tile-icon {
          width: 30px;
          height: 30px;
        }
        :host ::ng-deep .sc-tile-icon svg,
        .sc-tile-icon svg {
          width: 15px;
          height: 15px;
        }
      }
    `,
  ],
})
export class SitecoreDashboardComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  protected readonly perms = inject(PermissionService);

  private readonly tileModuleMap: Record<string, string> = {
    employees: 'Employees',
    profile: 'Profile',
    onboarding: 'Onboarding',
    offboarding: 'Employees',
    attendance: 'Attendance',
    leave: 'Leave',
    holiday: 'Company',
    shift: 'Shift',
    payroll: 'Payroll',
    payslips: 'Payslips',
    loans: 'Payroll',
    reimburse: 'Payroll',
    leaveAppr: 'Approvals',
    loanAppr: 'Approvals',
    attAppr: 'Approvals',
    docAppr: 'Approvals',
    empReport: 'Reports',
    attReport: 'Reports',
    payReport: 'Reports',
    leaveReport: 'Reports',
    company: 'Settings',
    roles: 'Settings',
    departments: 'Company',
    designations: 'Company',
  };

  protected readonly visibleSections = computed(() => {
    const isSuper = this.session.activeRole() === 'Super Admin';
    return this.sections
      .map((sec) => ({
        title: sec.title,
        tiles: sec.tiles.filter((t) => {
          if (isSuper) return true;
          const modName = this.tileModuleMap[t.key] || t.label;
          return this.perms.hasModuleAccess(modName);
        }),
      }))
      .filter((sec) => sec.tiles.length > 0);
  });

  protected readonly view = signal<'grid' | 'list'>('grid');

  protected readonly stats = signal([
    { label: 'Employees', value: '—' },
    { label: 'Attendance', value: '—' },
    { label: 'Pending', value: '—' },
    { label: 'Payroll', value: '—' },
  ]);

  protected readonly greeting = signal(SitecoreDashboardComponent.greet());
  protected readonly displayName = signal(
    this.session.activeRole() === 'Super Admin' ? 'Admin' : this.session.activeRole(),
  );

  ngOnInit(): void {
    this.api.dashboardStats().subscribe({
      next: (stats) =>
        this.stats.set([
          { label: 'Employees', value: stats.totalEmployees.toLocaleString() },
          { label: 'Attendance', value: `${stats.attendanceRate}%` },
          { label: 'Pending', value: `${stats.pendingApprovals}` },
          { label: 'Payroll', value: this.compactMoney(stats.monthlyPayroll) },
        ]),
      error: () => {
        /* API offline — the banner keeps its placeholders. */
      },
    });
  }

  private compactMoney(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  }

  protected readonly sections: Section[] = [
    {
      title: 'Employee Management',
      tiles: [
        tile('employees', 'Employees', '/employees', 'ic-blue', 'All staff records'),
        tile('profile', 'Emp Profile', '/employee-profile', 'ic-indigo', 'View & edit info'),
        tile('onboarding', 'Onboarding', '/onboarding', 'ic-green', 'New hire setup'),
        tile('offboarding', 'Offboarding', '/employees', 'ic-red', 'Exit process'),
      ],
    },
    {
      title: 'Attendance & Leave',
      tiles: [
        tile('attendance', 'Attendance', '/attendance', 'ic-teal', 'Daily check-in/out'),
        tile('leave', 'Leave', '/leave', 'ic-green', 'Apply & track leave'),
        tile('holiday', 'Holiday Calendar', '/attendance', 'ic-orange', 'Public & optional'),
        tile('shift', 'Shift Management', '/shift', 'ic-blue', 'Rosters & timings'),
      ],
    },
    {
      title: 'Payroll',
      tiles: [
        tile('payroll', 'Payroll', '/payroll', 'ic-indigo', 'Process salaries'),
        tile('payslips', 'Payslips', '/payslips', 'ic-green', 'Monthly pay stubs'),
        tile('loans', 'Loans', '/loans', 'ic-purple', 'Staff loan requests'),
        tile('reimburse', 'Reimbursements', '/payroll', 'ic-orange', 'Expense claims'),
      ],
    },
    {
      title: 'Approvals',
      tiles: [
        tile('leaveAppr', 'Leave Approvals', '/approvals', 'ic-teal', 'Approve/reject leave'),
        tile('loanAppr', 'Loan Approvals', '/approvals', 'ic-amber', 'Review loan requests'),
        tile('attAppr', 'Attendance Requests', '/approvals', 'ic-purple', 'Regularise punches'),
        tile('docAppr', 'Documents Approval', '/approvals', 'ic-blue', 'Verify submissions'),
      ],
    },
    {
      title: 'Reports',
      tiles: [
        tile('empReport', 'Employee Reports', '/reports', 'ic-blue', 'Headcount & details'),
        tile('attReport', 'Attendance Reports', '/reports', 'ic-teal', 'Daily & monthly log'),
        tile('payReport', 'Payroll Reports', '/reports', 'ic-indigo', 'Salary & deductions'),
        tile('leaveReport', 'Leave Reports', '/reports', 'ic-orange', 'Balance & history'),
      ],
    },
    {
      title: 'Settings & Administration',
      tiles: [
        tile('company', 'Company Setup', '/company', 'ic-cyan', 'Org info & branding'),
        tile('roles', 'Roles & Permissions', '/settings', 'ic-purple', 'Access control & RBAC'),
        tile('departments', 'Departments', '/company', 'ic-green', 'Teams & divisions'),
        tile('designations', 'Designations', '/company', 'ic-amber', 'Job titles & grades'),
      ],
    },
  ];

  private static greet(): string {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  }
}
