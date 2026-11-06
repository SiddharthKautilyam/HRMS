import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast.service';
import { ToastType } from '../core/models';

const COLORS: Record<ToastType, string> = {
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

const GLYPHS: Record<ToastType, string> = {
  success: '✓',
  danger: '✕',
  warning: '⚠',
  info: 'ℹ',
};

/** Hosts the transient toasts produced by ToastService (replaces showToast). */
@Component({
  selector: 'app-toasts',
  imports: [CommonModule],
  template: `
    <div class="toast-host">
      @for (toast of toasts() ; track toast.id) {
        <div class="toast">
          <span class="toast-icon" [style.background]="colors[toast.type]">{{ glyphs[toast.type] }}</span>
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;
  readonly colors = COLORS;
  readonly glyphs = GLYPHS;
}
