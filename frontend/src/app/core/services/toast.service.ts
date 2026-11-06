import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../models';

/** Global toast notifications — replaces the original `showToast()` helper. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private seq = 0;

  show(message: string, type: ToastType = 'success'): void {
    const id = ++this.seq;
    this._toasts.update((list) => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 3000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
