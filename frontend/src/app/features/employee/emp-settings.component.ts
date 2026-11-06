import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

interface Preference {
  id: string;
  l: string;
  d: string;
  on: boolean;
}

/** Settings — ported from pages/emp-settings.html. */
@Component({
  selector: 'app-emp-settings',
  imports: [CommonModule, IconDirective],
  template: `
    <div style="margin-bottom: 24px">
      <div class="page-title">Settings</div>
      <div class="page-subtitle">Manage your account preferences</div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">Change Password</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input class="form-control" type="password" placeholder="Enter current password" />
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input class="form-control" type="password" placeholder="Enter new password" />
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input class="form-control" type="password" placeholder="Confirm new password" />
          </div>
          <button class="btn btn-primary" style="display: flex; align-items: center; gap: 6px" (click)="toast.show('Password updated!')">
            <span [appIcon]="'check'"></span> Update Password
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Notification Preferences</div></div>
        <div class="card-body" style="padding: 0">
          @for (n of preferences(); track n.id) {
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); gap: 16px">
              <div style="flex: 1; min-width: 0">
                <div class="notif-label" style="font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px">{{ n.l }}</div>
                <div class="notif-desc" style="font-size: 14px; color: var(--muted)">{{ n.d }}</div>
              </div>
              <div
                class="toggle-wrap"
                [attr.data-on]="n.on"
                (click)="toggle(n.id)"
                [style.background]="n.on ? 'var(--p)' : 'var(--border)'"
                style="flex-shrink: 0; width: 44px; height: 24px; border-radius: 24px; position: relative; cursor: pointer; transition: background .25s"
              >
                <div
                  [style.left.px]="n.on ? 23 : 3"
                  style="position: absolute; top: 3px; width: 18px; height: 18px; background: var(--surface); border-radius: 50%; transition: left .25s; box-shadow: 0 1px 4px rgba(0,0,0,.2)"
                ></div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @media (max-width: 768px) {
        .toggle-wrap {
          width: 34px !important;
          height: 18px !important;
          border-radius: 18px !important;
        }
        .toggle-wrap div {
          width: 12px !important;
          height: 12px !important;
          top: 3px !important;
          left: 3px !important;
        }
        .toggle-wrap[data-on='true'] div {
          left: 19px !important;
        }
        .notif-label {
          font-size: 13px !important;
        }
        .notif-desc {
          font-size: 12px !important;
        }
      }
    `,
  ],
})
export class EmpSettingsComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly preferences = signal<Preference[]>([]);

  ngOnInit(): void {
    this.api.notificationPreferences().subscribe({
      next: (items) =>
        this.preferences.set(items.map((p) => ({ id: p.id, l: p.name, d: p.description, on: p.enabled }))),
      error: () => {
        /* API offline — the preference list stays empty. */
      },
    });
  }

  protected toggle(id: string): void {
    const current = this.preferences().find((p) => p.id === id);
    if (!current) return;

    const enabled = !current.on;
    this.preferences.update((list) => list.map((p) => (p.id === id ? { ...p, on: enabled } : p)));

    this.api.updateNotificationPreference(id, enabled).subscribe({
      next: () => this.toast.show('Preference saved'),
      error: () => {
        this.preferences.update((list) => list.map((p) => (p.id === id ? { ...p, on: !enabled } : p)));
        this.toast.show('Could not save the preference.', 'danger');
      },
    });
  }
}
