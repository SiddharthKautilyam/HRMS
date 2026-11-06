import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from './session.service';

export interface ModulePermission {
  moduleId: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isFull: boolean;
  isExpanded?: boolean;
}

export const SYSTEM_MODULES: { id: string; name: string }[] = [
  { id: 'm1', name: 'Dashboard' },
  { id: 'm2', name: 'Company' },
  { id: 'm3', name: 'Employees' },
  { id: 'm4', name: 'Profile' },
  { id: 'm5', name: 'Shift' },
  { id: 'm6', name: 'Attendance' },
  { id: 'm7', name: 'Leave' },
  { id: 'm8', name: 'Payroll' },
  { id: 'm9', name: 'Payslips' },
  { id: 'm10', name: 'Onboarding' },
  { id: 'm11', name: 'Documents' },
  { id: 'm12', name: 'Approvals' },
  { id: 'm13', name: 'Reports' },
  { id: 'm14', name: 'Settings' },
  { id: 'm15', name: 'Analytics' },
];

function fullPerm(id: string, name: string): ModulePermission {
  return { moduleId: id, moduleName: name, canView: true, canCreate: true, canEdit: true, canDelete: true, isFull: true };
}

function viewOnlyPerm(id: string, name: string): ModulePermission {
  return { moduleId: id, moduleName: name, canView: true, canCreate: false, canEdit: false, canDelete: false, isFull: false };
}

function noPerm(id: string, name: string): ModulePermission {
  return { moduleId: id, moduleName: name, canView: false, canCreate: false, canEdit: false, canDelete: false, isFull: false };
}

function defaultForRole(roleCode: string): ModulePermission[] {
  const code = (roleCode || '').toUpperCase().replace(/\s+/g, '');
  if (code === 'SUPERADMIN' || code === 'ADMIN' || code === 'COMPANYADMIN') {
    return SYSTEM_MODULES.map((m) => fullPerm(m.id, m.name));
  }
  if (code === 'HR' || code === 'HRMANAGER') {
    return SYSTEM_MODULES.map((m) => {
      if (m.name === 'Settings') {
        return { moduleId: m.id, moduleName: m.name, canView: true, canCreate: true, canEdit: true, canDelete: false, isFull: false };
      }
      return fullPerm(m.id, m.name);
    });
  }
  if (code === 'MANAGER') {
    const allowed = ['Dashboard', 'Employees', 'Profile', 'Attendance', 'Leave', 'Approvals', 'Documents', 'Reports', 'Analytics'];
    return SYSTEM_MODULES.map((m) => {
      if (['Dashboard', 'Profile', 'Approvals'].includes(m.name)) {
        return fullPerm(m.id, m.name);
      }
      if (['Attendance', 'Leave', 'Documents'].includes(m.name)) {
        return { moduleId: m.id, moduleName: m.name, canView: true, canCreate: true, canEdit: true, canDelete: false, isFull: false };
      }
      if (allowed.includes(m.name)) {
        return viewOnlyPerm(m.id, m.name);
      }
      return noPerm(m.id, m.name);
    });
  }
  // Default for EMP / Employee
  const empModules = ['Dashboard', 'Profile', 'Attendance', 'Leave', 'Payslips', 'Documents'];
  return SYSTEM_MODULES.map((m) => {
    if (['Dashboard', 'Profile'].includes(m.name)) {
      return { moduleId: m.id, moduleName: m.name, canView: true, canCreate: false, canEdit: true, canDelete: false, isFull: false };
    }
    if (['Attendance', 'Leave'].includes(m.name)) {
      return { moduleId: m.id, moduleName: m.name, canView: true, canCreate: true, canEdit: false, canDelete: false, isFull: false };
    }
    if (['Payslips', 'Documents'].includes(m.name)) {
      return viewOnlyPerm(m.id, m.name);
    }
    return noPerm(m.id, m.name);
  });
}

const STORAGE_PREFIX = 'hrms.perm.';

/**
 * Centralized dynamic permission service that manages role & employee-specific
 * permissions, allowing Super Admin and HR to grant or restrict access dynamically.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly session = inject(SessionService);
  private readonly version = signal(0);

  constructor() {
    this.purgeLegacyStorage();
  }

  /** Clears old localStorage permission copies to ensure database-driven permissions are authoritative */
  private purgeLegacyStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch {}
  }

  /** All system module permissions for current active user/role */
  readonly currentPermissions = computed<Map<string, ModulePermission>>(() => {
    // depend on version to re-evaluate when permissions are updated
    this.version();
    const role = this.session.activeRole();
    const user = this.session.user();

    // Check if current user has individual employee overrides
    if (user?.employeeId) {
      const empSaved = this.readStorage(`emp.${user.employeeId}`);
      if (empSaved) return new Map(empSaved.map((p) => [p.moduleName.toLowerCase(), p]));
    }
    if (user?.name) {
      const empSaved = this.readStorage(`emp.${user.name}`);
      if (empSaved) return new Map(empSaved.map((p) => [p.moduleName.toLowerCase(), p]));
    }

    // Otherwise use role permissions
    const rolePerms = this.getPermissionsForRole(role);
    return new Map(rolePerms.map((p) => [p.moduleName.toLowerCase(), p]));
  });

  /** Normalizes module name matching (e.g. 'Employee' vs 'Employees') */
  private normKey(name: string): string {
    const s = (name || '').trim().toLowerCase();
    if (s === 'employee') return 'employees';
    if (s === 'leave management') return 'leave';
    if (s === 'shift roster' || s === 'roster') return 'shift';
    if (s === 'holiday' || s === 'companies') return 'company';
    if (s === 'payslip') return 'payslips';
    if (s === 'news' || s === 'overview') return 'dashboard';
    if (s === 'my account' || s === 'emp profile') return 'profile';
    if (s === 'loans' || s === 'reimbursements') return 'payroll';
    if (s === 'roles & permissions' || s === 'role') return 'settings';
    return s;
  }

  hasModuleAccess(moduleName: string): boolean {
    const role = this.session.activeRole();
    if (role === 'Super Admin' || role === 'Company Admin') return true;
    const key = this.normKey(moduleName);
    const perm = this.currentPermissions().get(key);
    return perm ? perm.canView : false;
  }

  canCreate(moduleName: string): boolean {
    const role = this.session.activeRole();
    if (role === 'Super Admin' || role === 'Company Admin') return true;
    const key = this.normKey(moduleName);
    const perm = this.currentPermissions().get(key);
    return perm ? perm.canCreate : false;
  }

  canEdit(moduleName: string): boolean {
    const role = this.session.activeRole();
    if (role === 'Super Admin' || role === 'Company Admin') return true;
    const key = this.normKey(moduleName);
    const perm = this.currentPermissions().get(key);
    return perm ? perm.canEdit : false;
  }

  canDelete(moduleName: string): boolean {
    const role = this.session.activeRole();
    if (role === 'Super Admin' || role === 'Company Admin') return true;
    const key = this.normKey(moduleName);
    const perm = this.currentPermissions().get(key);
    return perm ? perm.canDelete : false;
  }

  getPermissionsForRole(roleCodeOrName: string): ModulePermission[] {
    const norm = (roleCodeOrName || '').toUpperCase().replace(/\s+/g, '');
    const key = `role.${norm}`;
    const stored = this.readStorage(key) ?? this.readStorage(`role.${(roleCodeOrName || '').toUpperCase()}`);
    if (stored && stored.length > 0) {
      return stored;
    }
    return defaultForRole(roleCodeOrName);
  }

  getPermissionsForEmployee(empIdentifier: string): ModulePermission[] {
    const key = `emp.${empIdentifier}`;
    const stored = this.readStorage(key);
    if (stored && stored.length > 0) {
      return stored;
    }
    // Default to Employee role defaults
    return defaultForRole('EMP');
  }

  saveRolePermissions(roleCode: string, permissions: ModulePermission[]): void {
    const raw = (roleCode || '').toUpperCase().trim();
    const norm = raw.replace(/\s+/g, '');
    this.writeStorage(`role.${raw}`, permissions);
    this.writeStorage(`role.${norm}`, permissions);
    // Also save under standard aliases so any role mapping matches
    if (norm === 'ADMIN' || norm === 'COMPANYADMIN') {
      this.writeStorage('role.ADMIN', permissions);
      this.writeStorage('role.COMPANY ADMIN', permissions);
      this.writeStorage('role.COMPANYADMIN', permissions);
    } else if (norm === 'HR' || norm === 'HRMANAGER') {
      this.writeStorage('role.HR', permissions);
      this.writeStorage('role.HR MANAGER', permissions);
      this.writeStorage('role.HRMANAGER', permissions);
    } else if (norm === 'MANAGER') {
      this.writeStorage('role.MANAGER', permissions);
    } else if (norm === 'EMP' || norm === 'EMPLOYEE') {
      this.writeStorage('role.EMP', permissions);
      this.writeStorage('role.EMPLOYEE', permissions);
    }
    this.version.update((v) => v + 1);
  }

  saveEmployeePermissions(empIdentifier: string, permissions: ModulePermission[]): void {
    const key = `emp.${empIdentifier}`;
    this.writeStorage(key, permissions);
    this.version.update((v) => v + 1);
  }

  private readStorage(subKey: string): ModulePermission[] | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + subKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeStorage(subKey: string, permissions: ModulePermission[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PREFIX + subKey, JSON.stringify(permissions));
    } catch {}
  }
}
