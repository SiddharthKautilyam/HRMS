import { Injectable, signal } from '@angular/core';

type Panel = 'notif' | 'punch' | 'avatar' | null;

/**
 * Tracks modal overlay visibility and the header fly-out panels — the Angular
 * equivalent of the original `openModal`/`closeModal`/`toggleNotifPanel` helpers.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly _modals = signal<Record<string, boolean>>({});
  private readonly _panel = signal<Panel>(null);
  private readonly _navRefresh = signal<number>(0);

  readonly panel = this._panel.asReadonly();
  readonly navigationRefresh = this._navRefresh.asReadonly();

  triggerNavigationRefresh(): void {
    this._navRefresh.update((v) => v + 1);
  }

  isOpen(id: string): boolean {
    return !!this._modals()[id];
  }

  open(id: string): void {
    this._modals.update((m) => ({ ...m, [id]: true }));
    document.body.classList.add('modal-open');
  }

  close(id: string): void {
    this._modals.update((m) => ({ ...m, [id]: false }));
    if (!Object.values(this._modals()).some(Boolean)) {
      document.body.classList.remove('modal-open');
    }
  }

  /** Closes the modal when the dark backdrop itself (not the dialog) is clicked. */
  onOverlayClick(event: MouseEvent, id: string): void {
    if (event.target === event.currentTarget) this.close(id);
  }

  togglePanel(panel: Exclude<Panel, null>): void {
    this._panel.update((current) => (current === panel ? null : panel));
  }

  closePanel(): void {
    this._panel.set(null);
  }

  isPanel(panel: Exclude<Panel, null>): boolean {
    return this._panel() === panel;
  }
}
