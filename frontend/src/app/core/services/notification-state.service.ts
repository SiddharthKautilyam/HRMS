import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { SessionService } from './session.service';
import { ToastService } from './toast.service';

export interface DetailedNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'Approval' | 'Attendance' | 'Policy' | 'Birthday' | 'Document' | 'Payroll' | 'System';
  unread: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationStateService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  readonly notifications = signal<DetailedNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter((n) => n.unread).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.api.notifications().subscribe({
      next: (items) => {
        const isEmp = this.session.activeRole() === 'Employee';
        const mapped = (items || []).map((n) => {
          const t = (n.title || '').toLowerCase();
          const m = (n.message || '').toLowerCase();
          const full = `${t} ${m}`;

          let category: DetailedNotification['category'] = 'System';
          let actionUrl: string | undefined = undefined;
          let actionLabel: string | undefined = undefined;

          if (full.includes('birthday') || full.includes('celebrat')) {
            category = 'Birthday';
            actionLabel = 'Send Wishes';
          } else if (full.includes('attendance') || full.includes('absent') || full.includes('punch')) {
            category = 'Attendance';
            actionUrl = isEmp ? '/me/attendance' : '/attendance';
            actionLabel = 'View Attendance';
          } else if (full.includes('leave') || full.includes('approval') || full.includes('overtime') || full.includes('request')) {
            category = 'Approval';
            actionUrl = isEmp ? '/me/leave' : '/approvals';
            actionLabel = 'Review in Approvals';
          } else if (full.includes('policy') || full.includes('notice') || full.includes('announcement')) {
            category = 'Policy';
            actionUrl = isEmp ? '/me/announcements' : '/announcements';
            actionLabel = 'Read Announcement';
          } else if (full.includes('document') || full.includes('passport') || full.includes('expiry') || full.includes('visa')) {
            category = 'Document';
            actionUrl = isEmp ? '/me/documents' : '/documents';
            actionLabel = 'Check Documents';
          } else if (full.includes('payroll') || full.includes('salary') || full.includes('payslip')) {
            category = 'Payroll';
            actionUrl = isEmp ? '/me/payslips' : '/payroll';
            actionLabel = 'View Payroll';
          }

          return {
            id: n.id,
            title: n.title,
            message: n.message,
            time: n.timeLabel,
            category,
            unread: !n.isRead,
            actionUrl,
            actionLabel,
          };
        });

        this.notifications.set(mapped);
      },
      error: () => {
        /* Best effort */
      },
    });
  }

  markRead(id: string): void {
    const list = this.notifications();
    const item = list.find((n) => n.id === id);
    if (item && item.unread) {
      this.notifications.update((items) =>
        items.map((n) => (n.id === id ? { ...n, unread: false } : n))
      );
      this.api.markNotificationRead(id).subscribe({
        error: () => {
          /* Best effort */
        },
      });
    }
  }

  toggleRead(id: string): void {
    const list = this.notifications();
    const item = list.find((n) => n.id === id);
    if (!item) return;

    const newUnread = !item.unread;
    this.notifications.update((items) =>
      items.map((n) => (n.id === id ? { ...n, unread: newUnread } : n))
    );

    this.api.toggleNotificationRead(id).subscribe({
      error: () => {
        /* Best effort */
      },
    });
  }

  markAllAsRead(): void {
    this.notifications.update((items) => items.map((n) => ({ ...n, unread: false })));
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.toast.show('All notifications marked as read', 'success');
      },
      error: () => {
        this.toast.show('All notifications marked as read', 'success');
      },
    });
  }

  clearAll(): void {
    this.notifications.set([]);
    this.api.clearAllNotifications().subscribe({
      next: () => {
        this.toast.show('All notifications cleared', 'info');
      },
      error: () => {
        this.toast.show('All notifications cleared', 'info');
      },
    });
  }

  deleteItem(id: string): void {
    this.notifications.update((items) => items.filter((n) => n.id !== id));
    this.api.deleteNotification(id).subscribe({
      next: () => {
        this.toast.show('Notification dismissed', 'info');
      },
      error: () => {
        this.toast.show('Notification dismissed', 'info');
      },
    });
  }
}
