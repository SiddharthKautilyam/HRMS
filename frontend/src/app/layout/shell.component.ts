import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from '../core/api/api.service';
import { NAV_CONFIG } from '../core/data/nav-config';
import { notificationsFor } from '../core/data/notifications.data';
import { ICONS, IconName } from '../core/icons/icons';
import { IconDirective } from '../core/icons/icon.directive';
import { AppNotification } from '../core/models';
import { PunchService } from '../core/services/punch.service';
import { SessionService } from '../core/services/session.service';
import { ThemeService } from '../core/services/theme.service';
import { ToastService } from '../core/services/toast.service';
import { UiService } from '../core/services/ui.service';
import { PermissionService } from '../core/services/permission.service';
import { SafeHtmlPipe } from '../shared/safe-html.pipe';
import { FacePunchModalComponent } from '../shared/face-punch-modal.component';

interface MasterNavItem {
  label: string;
  section: string;
  icon: IconName;
  path: string;
  empPath?: string;
  superOnly?: boolean;
  queryParams?: Record<string, string>;
  isSubItem?: boolean;
}

const MASTER_NAV_CATALOGUE: MasterNavItem[] = [
  // Overview
  { label: 'Dashboard', section: 'Overview', icon: 'dashboard', path: '/dashboard', empPath: '/me/dashboard' },
  { label: 'Analytics', section: 'Overview', icon: 'reports', path: '/analytics', empPath: '/analytics' },

  // HR Modules
  { label: 'Company', section: 'HR Modules', icon: 'company', path: '/company', empPath: '/company' },
  { label: 'Employees', section: 'HR Modules', icon: 'employees', path: '/employees', empPath: '/employees' },
  { label: 'Profile', section: 'HR Modules', icon: 'user', path: '/employee-profile', empPath: '/me/profile' },
  { label: 'Shift', section: 'HR Modules', icon: 'clock', path: '/shift', empPath: '/shift' },
  { label: 'Attendance', section: 'HR Modules', icon: 'attendance', path: '/attendance', empPath: '/me/attendance' },
  { label: 'Leave', section: 'HR Modules', icon: 'leave', path: '/leave', empPath: '/me/leave' },
  { label: 'Loans', section: 'HR Modules', icon: 'loans', path: '/loans', empPath: '/loans' },
  { label: 'Payroll', section: 'HR Modules', icon: 'payroll', path: '/payroll', empPath: '/payroll' },
  { label: 'Payslips', section: 'HR Modules', icon: 'payslip', path: '/payslips', empPath: '/me/payslips' },
  { label: 'Onboarding', section: 'HR Modules', icon: 'onboarding', path: '/onboarding', empPath: '/onboarding' },
  { label: 'Documents', section: 'HR Modules', icon: 'documents', path: '/documents', empPath: '/me/documents' },
  { label: 'Approvals', section: 'HR Modules', icon: 'approvals', path: '/approvals', empPath: '/approvals' },

  // Master Setup
  { label: 'Settings', section: 'Master Setup', icon: 'settings', path: '/settings', empPath: '/settings' },
  { label: 'Reports', section: 'Master Setup', icon: 'reports', path: '/reports', empPath: '/reports' },
];

/**
 * Application chrome shared by every role — ported from renderLayout() and
 * renderEmployeeLayout(). Renders the role-driven sidebar, the header with its
 * notification / punch / avatar fly-outs, the change-password modal, and the
 * routed page content.
 */
@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconDirective, SafeHtmlPipe, FacePunchModalComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit, OnDestroy {
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  protected readonly ui = inject(UiService);
  protected readonly punch = inject(PunchService);
  protected readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly sidebarOpen = signal(false);
  protected readonly pendingApprovalsCount = signal<number>(0);

  protected readonly tenants = signal([
    { id: '1', name: 'Firebird', location: 'Dubai HQ', logo: 'assets/images/shape-logo.png' },
    { id: '2', name: 'HRNexus Global', location: 'Abu Dhabi', logo: 'assets/images/shape-logo.png' },
    { id: '3', name: 'Nexus Tech', location: 'Riyadh', logo: 'assets/images/shape-logo.png' },
    { id: '4', name: 'Acme Solutions', location: 'London', logo: 'assets/images/shape-logo.png' },
  ]);
  protected readonly selectedTenant = signal(this.readStoredTenant() || this.tenants()[0]);
  protected readonly tenantOpen = signal(false);

  protected readonly user = computed(() => this.session.user());
  protected readonly role = computed(() => this.session.activeRole());
  protected readonly companyLogo = computed(() => this.session.companyLogo() || null);
  protected readonly currentCompanyName = computed(() => this.user()?.companyName || this.selectedTenant().name);

  protected resolveLogoUrl(url?: string | null): string {
    if (!url) return 'assets/images/shape-logo.png';
    const trimmed = url.trim();
    if (!trimmed) return 'assets/images/shape-logo.png';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('/assets/') || trimmed.startsWith('assets/')) {
      return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    }
    if (trimmed.startsWith('/uploads/')) {
      const isDev = typeof window !== 'undefined' && window.location.port === '4200';
      return isDev ? `http://localhost:5096${trimmed}` : trimmed;
    }
    return trimmed;
  }

  protected onLogoError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('assets/images/shape-logo.png')) {
      target.src = 'assets/images/shape-logo.png';
    }
  }

  protected readonly backendNavItems = signal<any[]>([]);

  /** Sidebar sections dynamically generated per role */
  protected readonly nav = computed(() => {
    const isSuper = this.role() === 'Super Admin';
    const isCompanyAdmin = this.role() === 'Company Admin';
    const isEmp = this.role() === 'Employee';
    const count = this.pendingApprovalsCount();

    // 1. In Super Admin: strictly Dashboard, Company Onboarding, and Settings page
    if (isSuper) {
      return [
        {
          section: 'Platform',
          items: [
            { icon: 'dashboard' as IconName, label: 'Dashboard', path: '/dashboard' },
            { icon: 'company' as IconName, label: 'Company Onboarding', path: '/companies' },
            { icon: 'settings' as IconName, label: 'Settings', path: '/settings' },
          ],
        },
      ];
    }

    const backendItems = this.backendNavItems();

    // Helper to filter out ERP, Face Kiosk, Key Group, Navigation, Permissions, Roles from main menu bar
    const isExcludedFromSidebar = (route?: string, title?: string): boolean => {
      const r = (route || '').toLowerCase();
      const t = (title || '').toLowerCase();
      if (r === '/erp' || t.includes('erp') || t.includes('erp integration')) return true;
      if (r === '/kiosk' || t.includes('kiosk') || t.includes('face kiosk')) return true;
      if (
        t === 'key group' ||
        t === 'key groups' ||
        t === 'navigation' ||
        t === 'permission' ||
        t === 'permissions' ||
        t === 'role' ||
        t === 'roles' ||
        r.includes('#keygroup') ||
        r.includes('#navigation') ||
        r.includes('#permission') ||
        r.includes('#role') ||
        r.includes('tab=keygroup') ||
        r.includes('tab=navigation') ||
        r.includes('tab=permission') ||
        r.includes('tab=role')
      ) {
        return true;
      }
      return false;
    };

    const getSection = (item: any): string => {
      const title = (item.title || item.label || '').toLowerCase();
      const route = (item.route || item.path || '').toLowerCase();
      if (title.includes('dash') || route.includes('dash')) {
        return 'Overview';
      }
      if (title.includes('setting') || route.includes('setting') || route.includes('report') || title.includes('report')) {
        return 'Master Setup';
      }
      return 'HR Modules';
    };

    const parseBackendItem = (
      i: any,
      isChild = false
    ): { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean } => {
      const iconKey = (i.icon as IconName) in ICONS ? (i.icon as IconName) : 'settings';
      let rawRoute: string = i.route || '/settings';
      let queryParams: Record<string, string> | undefined = undefined;

      if (rawRoute.includes('#')) {
        const [base, frag] = rawRoute.split('#');
        rawRoute = base;
        queryParams = { tab: frag };
      } else if (rawRoute.includes('?tab=')) {
        const [base, tabVal] = rawRoute.split('?tab=');
        rawRoute = base;
        queryParams = { tab: tabVal };
      }

      const lowerRoute = rawRoute.toLowerCase().trim();
      let path = rawRoute;

      if (lowerRoute === '/dashboard' || lowerRoute === 'dashboard') {
        path = isEmp ? '/me/dashboard' : '/dashboard';
      } else if (
        lowerRoute === '/profile' ||
        lowerRoute === '/employee-profile' ||
        lowerRoute.includes('emplyee') ||
        lowerRoute.includes('profile')
      ) {
        path = isEmp ? '/me/profile' : '/employee-profile';
      }

      const badge = i.title === 'Approvals' && count > 0 ? `${count}` : (i.badge || undefined);

      return {
        icon: iconKey,
        label: i.title,
        path,
        badge,
        queryParams,
        isSubItem: isChild || i.parentId != null,
      };
    };

    // 2. For Company Admin (Admin):
    // Full catalogue with Overview, HR Modules, and Master Setup (Settings, Reports),
    // with ERP, Face Kiosk, Key Group, Navigation, Permissions, Roles excluded from the main menu bar.
    if (isCompanyAdmin) {
      const sections = ['Overview', 'HR Modules', 'Master Setup'];
      const result: { section: string; items: { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean }[] }[] = [];

      for (const sec of sections) {
        const items: { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean }[] = MASTER_NAV_CATALOGUE
          .filter((item) => item.section === sec && !isExcludedFromSidebar(item.path, item.label))
          .map((item) => {
            const badge = item.label === 'Approvals' && count > 0 ? `${count}` : undefined;
            return {
              icon: item.icon,
              label: item.label,
              path: item.path,
              badge,
              queryParams: item.queryParams,
              isSubItem: item.isSubItem,
            };
          });

        // Also check if backendItems has any custom navigation items in this section that are not in MASTER_NAV_CATALOGUE
        if (backendItems.length > 0) {
          const existingPaths = new Set(items.map((i) => (i.path || '').toLowerCase()));
          const existingLabels = new Set(items.map((i) => (i.label || '').toLowerCase()));

          for (const bItem of backendItems) {
            if (isExcludedFromSidebar(bItem.route, bItem.title)) continue;
            const bSection = getSection(bItem);
            if (bSection === sec) {
              const bRoute = (bItem.route || '').toLowerCase();
              const bTitle = (bItem.title || '').toLowerCase();
              if (!existingPaths.has(bRoute) && !existingLabels.has(bTitle)) {
                items.push(parseBackendItem(bItem, false));
              }
            }
          }
        }

        if (items.length > 0) {
          result.push({ section: sec, items });
        }
      }

      return result;
    }

    // 3. For other roles (Employee, Manager, HR Manager):
    const hasMeaningfulBackendItems = backendItems.length > 1 || (backendItems.length === 1 && backendItems[0].route !== '/settings' && backendItems[0].title !== 'Settings');

    if (hasMeaningfulBackendItems) {
      const sections = ['Overview', 'HR Modules', 'Master Setup'];
      const result: { section: string; items: { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean }[] }[] = [];

      for (const sec of sections) {
        const matching = backendItems.filter((i) => getSection(i) === sec && !isExcludedFromSidebar(i.route, i.title));
        if (matching.length > 0) {
          const items: { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean }[] = [];
          for (const topItem of matching) {
            items.push(parseBackendItem(topItem, false));
            if (topItem.children && Array.isArray(topItem.children) && topItem.children.length > 0) {
              for (const child of topItem.children) {
                if (!isExcludedFromSidebar(child.route, child.title)) {
                  items.push(parseBackendItem(child, true));
                }
              }
            }
          }
          if (items.length > 0) {
            result.push({ section: sec, items });
          }
        }
      }
      return result;
    }

    // Fallback: evaluate through permission matrix
    const permitted = MASTER_NAV_CATALOGUE.filter((item) => {
      if (isExcludedFromSidebar(item.path, item.label)) return false;
      return this.perms.hasModuleAccess(item.label);
    });

    const sections = ['Overview', 'HR Modules', 'Master Setup'];
    const result: { section: string; items: { icon: IconName; label: string; path: string; badge?: string; queryParams?: Record<string, string>; isSubItem?: boolean }[] }[] = [];

    for (const sec of sections) {
      const items = permitted
        .filter((item) => item.section === sec)
        .map((item) => {
          const path = isEmp && item.empPath ? item.empPath : item.path;
          const badge = item.label === 'Approvals' && count > 0 ? `${count}` : undefined;
          return {
            icon: item.icon,
            label: item.label,
            path,
            badge,
            queryParams: item.queryParams,
            isSubItem: item.isSubItem,
          };
        });

      if (items.length > 0) {
        result.push({ section: sec, items });
      }
    }

    return result;
  });

  protected readonly notifications = signal<AppNotification[]>(notificationsFor(this.role()));
  protected readonly unreadCount = computed(() => this.notifications().filter((n) => n.unread).length);

  protected readonly homePath = computed(() => (this.role() === 'Employee' ? '/me/profile' : '/employee-profile'));

  private readonly navSub = this.router.events
    .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
    .subscribe(() => {
      this.sidebarOpen.set(false);
      this.ui.closePanel();
      this.updateTitle();
      this.loadPendingApprovals();
    });

  constructor() {
    this.updateTitle();
    effect(() => {
      if (this.ui.navigationRefresh() > 0) {
        this.loadUserNavigation();
      }
    });
  }

  ngOnInit(): void {
    this.refetchBranding();
    this.loadPendingApprovals();
    this.loadUserNavigation();
    if (this.role() === 'Super Admin') {
      this.api.tenantCompanies().subscribe({
        next: (items) => {
          if (items && items.length > 0) {
            this.tenants.set(
              items.map((c) => ({
                id: c.id,
                name: c.name,
                location: c.code,
                logo: 'assets/images/shape-logo.png',
              }))
            );
          }
        },
        error: () => {},
      });
    }

    this.api.notifications().subscribe({
      next: (items) =>
        this.notifications.set(
          items.map((n) => ({
            id: n.id,
            icon: ICONS[(n.iconKey as IconName) in ICONS ? (n.iconKey as IconName) : 'bell'],
            title: n.title,
            message: n.message,
            time: n.timeLabel,
            unread: !n.isRead,
          })),
        ),
      error: () => {
        /* API offline — keep the bundled notification feed. */
      },
    });
  }

  private refetchBranding(): void {
    if (!this.session.isAuthenticated()) return;
    this.api.company().subscribe({
      next: (settings) => {
        if (settings) {
          this.session.updateCompanyLogo(settings.logoUrl ?? null);
          if (settings.companyName) {
            this.session.updateUser({ companyName: settings.companyName });
          }
        }
      },
      error: () => {
        // Fallback for Super Admin or non-tenant contexts
        this.api.me().subscribe({
          next: (u) => {
            if (u?.companyLogoUrl) {
              this.session.updateCompanyLogo(u.companyLogoUrl);
            }
          },
          error: () => {},
        });
      },
    });
  }

  private loadPendingApprovals(): void {
    if (!this.session.isAuthenticated()) return;
    this.api.approvals({ status: 'Pending' }).subscribe({
      next: (res) => {
        this.pendingApprovalsCount.set(res?.length || 0);
      },
      error: () => {
        this.pendingApprovalsCount.set(0);
      },
    });
  }

  private loadUserNavigation(): void {
    if (!this.session.isAuthenticated()) return;
    this.api.userNavigation().subscribe({
      next: (items) => {
        if (items && items.length > 0) {
          this.backendNavItems.set(items);
        }
      },
      error: () => {
        /* Backend offline or unauthenticated fallback */
      },
    });
  }

  protected markRead(notification: AppNotification): void {
    if (!notification.unread) return;

    notification.unread = false;
    this.notifications.update((list) => [...list]);

    if (notification.id) {
      this.api.markNotificationRead(notification.id).subscribe({
        error: () => {
          /* best effort */
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected openChangePassword(): void {
    this.ui.closePanel();
    this.ui.open('chgPwdModal');
  }

  protected logout(): void {
    this.ui.closePanel();
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }

  protected toggleDark(): void {
    this.theme.toggle();
  }

  protected selectTenant(tenant: { id: string; name: string; location: string; logo: string }): void {
    this.selectedTenant.set(tenant);
    sessionStorage.setItem('current_tenant', JSON.stringify(tenant));
    this.tenantOpen.set(false);
    this.toast.show(`Switched to tenant: ${tenant.name} (${tenant.location})`);
  }

  private readStoredTenant(): { id: string; name: string; location: string; logo: string } | null {
    try {
      const s = sessionStorage.getItem('current_tenant');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  protected toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }

  protected clockIn(): void {
    this.punch.requestClockIn();
  }

  protected clockOut(): void {
    this.punch.requestClockOut();
  }

  protected startBreak(): void {
    this.punch.requestStartBreak();
  }

  protected endBreak(): void {
    this.punch.requestEndBreak();
  }

  protected savePassword(): void {
    this.ui.close('chgPwdModal');
    this.toast.show('Password updated successfully!');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    this.tenantOpen.set(false);
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const panels: { key: 'notif' | 'punch' | 'avatar'; panel: string; button: string }[] = [
      { key: 'notif', panel: 'notifPanel', button: 'notifBtn' },
      { key: 'punch', panel: 'punchPanel', button: 'punchBtn' },
      { key: 'avatar', panel: 'avatarMenu', button: 'avatarBtn' },
    ];
    for (const p of panels) {
      if (!this.ui.isPanel(p.key)) continue;
      const panelEl = document.getElementById(p.panel);
      const buttonEl = document.getElementById(p.button);
      if (panelEl && buttonEl && !panelEl.contains(target) && !buttonEl.contains(target)) {
        this.ui.closePanel();
      }
    }
  }

  /** Sets `document.title` from the deepest matched route's `data.title`. */
  private updateTitle(): void {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title: string | undefined;
    while (route) {
      const candidate = route.data['title'];
      if (typeof candidate === 'string') title = candidate;
      route = route.firstChild;
    }
    document.title = title ? `${title} — HRMS` : 'HRMS';
  }
}
