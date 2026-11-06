import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ActivationInfo } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Company admin account activation. Reached from the invitation email link
 * (/activate?token=…), it validates the one-time token and lets the admin set a
 * password, then signs them straight into their company's portal.
 */
@Component({
  selector: 'app-activate',
  imports: [CommonModule, FormsModule, RouterLink, IconDirective],
  template: `
    <div class="auth-forgot">
      <div class="card">
        @if (loading()) {
          <div class="icon-wrap" [appIcon]="'lock'"></div>
          <h1>Checking your link…</h1>
          <p>Please wait while we validate your activation link.</p>
        } @else if (info(); as i) {
          @if (!i.valid) {
            <div class="icon-wrap" [appIcon]="'x'" style="background: rgba(239,68,68,.1); color: var(--danger)"></div>
            <h1>Link Unavailable</h1>
            <p>{{ i.reason || 'This activation link is not valid.' }}</p>
            <a routerLink="/login" class="back">← Back to Sign In</a>
          } @else {
            <div class="icon-wrap" [appIcon]="'key'"></div>
            <h1>Activate Your Account</h1>
            <p>
              Set a password for <strong>{{ i.adminEmail }}</strong> to activate
              <strong>{{ i.companyName }}</strong>.
            </p>

            <label>New Password</label>
            <div class="iw">
              <span [appIcon]="'lock'"></span>
              <input type="password" placeholder="At least 8 characters" [(ngModel)]="newPassword" />
            </div>

            <label>Confirm Password</label>
            <div class="iw">
              <span [appIcon]="'lock'"></span>
              <input type="password" placeholder="Re-enter your password" [(ngModel)]="confirmPassword" />
            </div>

            <button class="btn" [disabled]="submitting()" (click)="submit()">
              {{ submitting() ? 'Activating…' : 'Set Password & Sign In' }}
            </button>
            <a routerLink="/login" class="back">← Back to Sign In</a>
          }
        }
      </div>
    </div>
  `,
})
export class ActivateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly info = signal<ActivationInfo | null>(null);
  protected readonly submitting = signal(false);

  protected newPassword = '';
  protected confirmPassword = '';

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.info.set({ valid: false, reason: 'This activation link is missing its token.' });
      this.loading.set(false);
      return;
    }

    this.api.validateActivation(this.token).subscribe({
      next: (info) => {
        this.info.set(info);
        this.loading.set(false);
      },
      error: () => {
        this.info.set({ valid: false, reason: 'We could not validate this activation link.' });
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.submitting()) return;

    if (this.newPassword.length < 8) {
      this.toast.show('Password must be at least 8 characters.', 'warning');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toast.show('Passwords do not match.', 'warning');
      return;
    }

    this.submitting.set(true);
    this.api.activateAccount(this.token, this.newPassword).subscribe({
      next: (response) => {
        const landing = this.session.setSession(response.accessToken, response.user);
        this.toast.show('Account activated. Welcome!', 'success');
        void this.router.navigateByUrl(landing);
      },
      error: (error) => {
        this.submitting.set(false);
        this.toast.show(error?.error?.title ?? 'Activation failed. Please try again.', 'danger');
      },
    });
  }
}
