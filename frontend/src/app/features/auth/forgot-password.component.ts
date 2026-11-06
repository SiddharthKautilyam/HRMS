import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

/** Forgot-password screen — ported from forgot-password.html. */
@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterLink, IconDirective],
  template: `
    <div class="auth-forgot">
      <div class="card">
        <div [style.display]="sent() ? 'none' : 'block'">
          <div class="icon-wrap" [appIcon]="'key'"></div>
          <h1>Forgot Password?</h1>
          <p>No worries! Enter your email and we'll send you a reset link.</p>
          <label>Email Address</label>
          <div class="iw">
            <span [appIcon]="'mail'"></span>
            <input type="email" placeholder="you@company.com" [(ngModel)]="email" />
          </div>
          <button class="btn" (click)="sendReset()">Send Reset Link</button>
          <a routerLink="/login" class="back">← Back to Sign In</a>
        </div>

        <div class="success-state" [class.show]="sent()">
          <div
            class="icon-wrap"
            [appIcon]="'inbox'"
            style="background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(5,150,105,.12))"
          ></div>
          <h1>Check Your Email</h1>
          <p>
            We sent a password reset link to <strong>{{ email() }}</strong>. Check your inbox and follow the
            instructions.
          </p>
          <button class="btn" (click)="backToSignIn()">Back to Sign In</button>
          <br />
          <a class="back" (click)="resend()">Didn't receive it? Resend</a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly email = signal('');
  protected readonly sent = signal(false);

  protected sendReset(): void {
    if (!this.email()) {
      this.toast.show('Please enter your email', 'danger');
      return;
    }
    this.sent.set(true);
  }

  protected resend(): void {
    this.toast.show('Reset link resent!');
  }

  protected backToSignIn(): void {
    void this.router.navigateByUrl('/login');
  }
}
