import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { DetailedNotification, NotificationStateService } from '../../core/services/notification-state.service';

export type { DetailedNotification };

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="flex justify-end items-center" style="margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-outline btn-sm" (click)="markAllAsRead()" style="display: flex; align-items: center; gap: 6px;">
          <span [appIcon]="'check'"></span> Mark All as Read
        </button>
        <button class="btn btn-outline btn-sm" (click)="clearAll()" style="display: flex; align-items: center; gap: 6px; color: var(--danger); border-color: var(--danger);">
          <span [appIcon]="'x'"></span> Clear All
        </button>
      </div>
    </div>

    <!-- Filter and Search Bar -->
    <div class="card" style="margin-bottom: 20px; padding: 14px 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <!-- Filter Tabs -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button
            class="btn btn-sm"
            [class.btn-primary]="activeFilter() === 'all'"
            [class.btn-outline]="activeFilter() !== 'all'"
            (click)="activeFilter.set('all')"
          >
            All ({{ notifications().length }})
          </button>
          <button
            class="btn btn-sm"
            [class.btn-primary]="activeFilter() === 'unread'"
            [class.btn-outline]="activeFilter() !== 'unread'"
            (click)="activeFilter.set('unread')"
          >
            Unread ({{ unreadCount() }})
          </button>
          <button
            class="btn btn-sm"
            [class.btn-primary]="activeFilter() === 'approval'"
            [class.btn-outline]="activeFilter() !== 'approval'"
            (click)="activeFilter.set('approval')"
          >
            Approvals
          </button>
          <button
            class="btn btn-sm"
            [class.btn-primary]="activeFilter() === 'attendance'"
            [class.btn-outline]="activeFilter() !== 'attendance'"
            (click)="activeFilter.set('attendance')"
          >
            Attendance
          </button>
          <button
            class="btn btn-sm"
            [class.btn-primary]="activeFilter() === 'policy'"
            [class.btn-outline]="activeFilter() !== 'policy'"
            (click)="activeFilter.set('policy')"
          >
            Policy &amp; Notices
          </button>
        </div>

        <!-- Search Input -->
        <div style="position: relative; min-width: 240px; flex: 1; max-width: 340px;">
          <input
            type="search"
            id="notif_search_input"
            name="notif_search_input"
            class="form-control form-control-sm"
            placeholder="Search notifications…"
            [ngModel]="searchKeyword()"
            (ngModelChange)="searchKeyword.set($event)"
            (search)="searchKeyword.set($any($event.target).value)"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            data-lpignore="true"
            data-form-type="other"
            style="padding-right: 28px;"
          />
          @if (searchKeyword().length > 0) {
            <button
              type="button"
              (click)="searchKeyword.set('')"
              style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 14px; cursor: pointer; color: var(--muted); padding: 2px;"
              title="Clear search"
            >
              ✕
            </button>
          }
        </div>
      </div>
    </div>

    <!-- Notification Cards List -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
      @for (n of filteredList(); track n.id || n.title) {
        <div
          class="card"
          style="padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; transition: 0.15s; border-left: 4px solid transparent;"
          [style.border-left-color]="n.unread ? 'var(--p)' : 'var(--border)'"
          [style.background]="n.unread ? 'var(--p-soft)' : 'var(--surface)'"
        >
          <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
            <!-- Category Icon Badge -->
            <div
              style="width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
              [style.background]="getCategoryBg(n.category)"
              [style.color]="getCategoryColor(n.category)"
            >
              <span [appIcon]="getCategoryIcon(n.category)"></span>
            </div>

            <!-- Content -->
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 15px; color: var(--text);">
                  {{ n.title }}
                </span>
                <span class="badge" [class]="getCategoryBadgeClass(n.category)">
                  {{ n.category }}
                </span>
                @if (n.unread) {
                  <span style="font-size: 11px; font-weight: 700; background: var(--p); color: #fff; padding: 2px 7px; border-radius: 12px;">
                    NEW
                  </span>
                }
              </div>

              <div style="font-size: 13.5px; color: var(--muted); margin-bottom: 8px; line-height: 1.5;">
                {{ n.message }}
              </div>

              <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--light);">
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span [appIcon]="'clock'"></span> {{ n.time }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
            @if (n.actionUrl) {
              <button
                class="btn btn-outline btn-sm"
                (click)="navigateToAction(n)"
                style="display: flex; align-items: center; gap: 6px; font-weight: 600;"
              >
                {{ n.actionLabel || 'View' }}
              </button>
            }

            <button
              class="btn btn-ghost btn-sm"
              [title]="n.unread ? 'Mark as read' : 'Mark as unread'"
              (click)="toggleRead(n)"
            >
              <span [appIcon]="n.unread ? 'check' : 'bell'"></span>
            </button>

            <button
              class="btn btn-ghost btn-sm"
              title="Delete notification"
              (click)="deleteItem(n)"
              style="color: var(--muted);"
              onmouseover="this.style.color='var(--danger)'"
              onmouseout="this.style.color='var(--muted)'"
            >
              <span [appIcon]="'x'"></span>
            </button>
          </div>
        </div>
      } @empty {
        <div class="card" style="text-align: center; padding: 48px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px; opacity: 0.6;">🔔</div>
          <div style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px;">No Notifications Found</div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
            You're all caught up! There are no notifications matching your current filter.
          </div>
          <button class="btn btn-outline btn-sm" (click)="resetFilters()">Reset Filters</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .kpi-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: var(--shadow);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
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
      .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.06);
      }
      .kpi-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
      }
      .kpi-value {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--text);
      }
      .kpi-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 600;
      }
    `,
  ],
})
export class NotificationsComponent implements OnInit {
  protected readonly notifState = inject(NotificationStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly notifications = computed(() => this.notifState.notifications());
  protected readonly activeFilter = signal<'all' | 'unread' | 'approval' | 'attendance' | 'policy'>('all');
  protected readonly searchKeyword = signal('');

  protected readonly unreadCount = computed(() => this.notifState.unreadCount());
  protected readonly approvalCount = computed(() => this.notifications().filter((n) => n.category === 'Approval').length);
  protected readonly attendanceCount = computed(() => this.notifications().filter((n) => n.category === 'Attendance').length);

  protected readonly filteredList = computed(() => {
    let list = this.notifications();
    const filter = this.activeFilter();
    const q = this.searchKeyword().trim().toLowerCase();

    if (filter === 'unread') {
      list = list.filter((n) => n.unread);
    } else if (filter === 'approval') {
      list = list.filter((n) => n.category === 'Approval');
    } else if (filter === 'attendance') {
      list = list.filter((n) => n.category === 'Attendance');
    } else if (filter === 'policy') {
      list = list.filter((n) => n.category === 'Policy');
    }

    if (q) {
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
    }

    return list;
  });

  ngOnInit(): void {
    this.notifState.load();
  }

  protected navigateToAction(n: DetailedNotification): void {
    if (n.category === 'Birthday') {
      this.toast.show(`Celebration wish sent for ${n.title}! 🎂`, 'success');
      return;
    }
    if (n.actionUrl) {
      this.router.navigate([n.actionUrl]);
    }
  }

  protected toggleRead(n: DetailedNotification): void {
    if (n.id) {
      this.notifState.toggleRead(n.id);
    }
  }

  protected markAllAsRead(): void {
    this.notifState.markAllAsRead();
  }

  protected clearAll(): void {
    this.notifState.clearAll();
  }

  protected deleteItem(n: DetailedNotification): void {
    if (n.id) {
      this.notifState.deleteItem(n.id);
    }
  }

  protected resetFilters(): void {
    this.activeFilter.set('all');
    this.searchKeyword.set('');
  }

  protected getCategoryBg(cat: DetailedNotification['category']): string {
    switch (cat) {
      case 'Approval':
        return 'rgba(16,185,129,.12)';
      case 'Attendance':
        return 'rgba(245,158,11,.12)';
      case 'Policy':
        return 'rgba(37,99,235,.12)';
      case 'Birthday':
        return 'rgba(168,85,247,.12)';
      case 'Document':
        return 'rgba(239,68,68,.12)';
      case 'Payroll':
        return 'rgba(6,182,212,.12)';
      default:
        return 'rgba(107,114,128,.12)';
    }
  }

  protected getCategoryColor(cat: DetailedNotification['category']): string {
    switch (cat) {
      case 'Approval':
        return '#059669';
      case 'Attendance':
        return '#d97706';
      case 'Policy':
        return '#2563eb';
      case 'Birthday':
        return '#9333ea';
      case 'Document':
        return '#dc2626';
      case 'Payroll':
        return '#0891b2';
      default:
        return '#4b5563';
    }
  }

  protected getCategoryIcon(cat: DetailedNotification['category']): any {
    switch (cat) {
      case 'Approval':
        return 'receipt';
      case 'Attendance':
        return 'clock';
      case 'Policy':
        return 'bell';
      case 'Birthday':
        return 'user';
      case 'Document':
        return 'documents';
      case 'Payroll':
        return 'payroll';
      default:
        return 'bell';
    }
  }

  protected getCategoryBadgeClass(cat: DetailedNotification['category']): string {
    switch (cat) {
      case 'Approval':
        return 'badge-success';
      case 'Attendance':
        return 'badge-warning';
      case 'Policy':
        return 'badge-info';
      case 'Birthday':
        return 'badge-primary';
      case 'Document':
        return 'badge-danger';
      case 'Payroll':
        return 'badge-primary';
      default:
        return 'badge-secondary';
    }
  }
}
