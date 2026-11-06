import { Injectable, computed, signal } from '@angular/core';
import { ApiUser } from '../api/api.models';
import { ROLE_LANDING } from '../data/nav-config';
import { Role, SessionUser } from '../models';

const ROLE_KEY = 'hrRole';
const TOKEN_KEY = 'hrms.token';
const USER_KEY = 'hrms.user';

const USER_MAP: Record<Role, SessionUser> = {
  'Super Admin': { role: 'Super Admin', name: 'Super Admin', initials: 'SA' },
  'HR Manager': { role: 'HR Manager', name: 'HR Manager', initials: 'HR' },
  'Company Admin': { role: 'Company Admin', name: 'Company Admin', initials: 'CA' },
  Manager: { role: 'Manager', name: 'Team Manager', initials: 'TM' },
  Employee: { role: 'Employee', name: 'Employee', initials: 'EM' },
};

/**
 * Holds the signed-in user, role and JWT. Persists to sessionStorage so a
 * refresh keeps the session (until the tab closes).
 *
 * `setSession` is used for real API logins; `login(role)` remains as the
 * offline/demo fallback when the API is unreachable.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _role = signal<Role | null>(this.readStoredRole());
  private readonly _token = signal<string | null>(this.readStoredToken());
  private readonly _user = signal<SessionUser | null>(this.readStoredUser());

  readonly role = this._role.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._role() !== null);
  readonly user = computed<SessionUser | null>(() => this._user() ?? this.defaultUser(this._role()));

  /** Role used for layout decisions, defaulting to Super Admin like the original. */
  readonly activeRole = computed<Role>(() => this._role() ?? 'Super Admin');

  readonly landingPath = computed(() => ROLE_LANDING[this._role() ?? 'Super Admin']);
  readonly companyLogo = computed(() => this._user()?.companyLogoUrl ?? null);

  /** Stores the JWT + profile returned by `POST /api/auth/login`. */
  setSession(accessToken: string, apiUser: ApiUser): string {
    const role = apiUser.role as Role;
    const user: SessionUser = {
      role,
      name: apiUser.fullName,
      email: apiUser.email,
      initials: apiUser.initials,
      employeeId: apiUser.employeeId ?? undefined,
      companyName: apiUser.companyName ?? undefined,
      companyCode: apiUser.companyCode ?? undefined,
      companyLogoUrl: apiUser.companyLogoUrl ?? undefined,
    };

    sessionStorage.setItem(ROLE_KEY, role);
    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));

    this._role.set(role);
    this._token.set(accessToken);
    this._user.set(user);

    return ROLE_LANDING[role];
  }

  /** Updates the in-memory session user and updates sessionStorage. */
  updateUser(patch: Partial<SessionUser>): void {
    const current = this._user();
    if (!current) return;
    const updated = { ...current, ...patch };
    this._user.set(updated);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  }

  /** Updates the tenant company logo reactively across the whole shell without re-login. */
  updateCompanyLogo(logoUrl: string | null): void {
    this.updateUser({ companyLogoUrl: logoUrl ?? undefined });
  }

  /** Offline/demo login (no API token). */
  login(role: Role): string {
    sessionStorage.setItem(ROLE_KEY, role);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    this._role.set(role);
    this._token.set(null);
    this._user.set(null);

    return ROLE_LANDING[role];
  }

  setRole(role: Role): void {
    this._role.set(role);
    sessionStorage.setItem(ROLE_KEY, role);
  }

  logout(): void {
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    this._role.set(null);
    this._token.set(null);
    this._user.set(null);
  }

  private defaultUser(role: Role | null): SessionUser | null {
    return role ? USER_MAP[role] : null;
  }

  private readStoredRole(): Role | null {
    if (typeof sessionStorage === 'undefined') return null;
    const stored = sessionStorage.getItem(ROLE_KEY);
    return stored ? (stored as Role) : null;
  }

  private readStoredToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(TOKEN_KEY);
  }

  private readStoredUser(): SessionUser | null {
    if (typeof sessionStorage === 'undefined') return null;
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as SessionUser;
    } catch {
      return null;
    }
  }
}
