import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'hrmsTheme';

/**
 * Dark mode toggle. The initial theme is applied by an inline script in
 * index.html to avoid a flash; this service keeps the toggle button and
 * localStorage in sync (ported from assets/js/dark-mode.js).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.readStoredTheme());

  readonly mode = this._mode.asReadonly();
  readonly isDark = () => this._mode() === 'dark';

  toggle(): void {
    this.set(this._mode() === 'dark' ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
    this._mode.set(mode);
    setTimeout(() => root.classList.remove('theme-transitioning'), 320);
  }

  private readStoredTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') return 'light';
    return (localStorage.getItem(THEME_KEY) as ThemeMode) ?? 'light';
  }
}
