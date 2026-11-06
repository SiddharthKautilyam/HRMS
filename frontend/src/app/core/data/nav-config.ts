import { NavSection, Role } from '../models';

const overview = (analyticsPath: string): NavSection => ({
  section: 'Overview',
  items: [
    { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { icon: 'reports', label: 'Analytics', path: analyticsPath },
  ],
});

const hrModules = (approvalBadge?: string): NavSection => ({
  section: 'HR Modules',
  items: [
    { icon: 'company', label: 'Company', path: '/company' },
    { icon: 'employees', label: 'Employees', path: '/employees' },
    { icon: 'user', label: 'Profile', path: '/employee-profile' },
    { icon: 'clock', label: 'Shift', path: '/shift' },
    { icon: 'attendance', label: 'Attendance', path: '/attendance' },
    { icon: 'leave', label: 'Leave', path: '/leave' },
    { icon: 'loans', label: 'Loans', path: '/loans' },
    { icon: 'payroll', label: 'Payroll', path: '/payroll' },
    { icon: 'payslip', label: 'Payslips', path: '/payslips' },
    { icon: 'onboarding', label: 'Onboarding', path: '/onboarding' },
    { icon: 'documents', label: 'Documents', path: '/documents' },
    { icon: 'approvals', label: 'Approvals', path: '/approvals', badge: approvalBadge },
  ],
});

const masterSetup: NavSection = {
  section: 'Master Setup',
  items: [
    { icon: 'settings', label: 'Settings', path: '/settings' },
    { icon: 'reports', label: 'Reports', path: '/reports' },
  ],
};

/** Sidebar navigation per role — dynamically filtered by PermissionService. */
export const NAV_CONFIG: Record<Role, NavSection[]> = {
  'Super Admin': [
    {
      section: 'Platform',
      items: [
        { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
        { icon: 'company', label: 'Company Onboarding', path: '/companies' },
        { icon: 'settings', label: 'Settings', path: '/settings' },
      ],
    },
  ],
  'Company Admin': [overview('/analytics'), hrModules(), masterSetup],
  'HR Manager': [overview('/analytics'), hrModules(), masterSetup],
  Manager: [
    overview('/analytics'),
    {
      section: 'Management',
      items: [
        { icon: 'employees', label: 'Employees', path: '/employees' },
        { icon: 'user', label: 'Profile', path: '/employee-profile' },
        { icon: 'attendance', label: 'Attendance', path: '/attendance' },
        { icon: 'leave', label: 'Leave', path: '/leave' },
        { icon: 'approvals', label: 'Approvals', path: '/approvals' },
        { icon: 'documents', label: 'Documents', path: '/documents' },
      ],
    },
    {
      section: 'Reports',
      items: [{ icon: 'reports', label: 'Reports', path: '/reports' }],
    },
  ],
  Employee: [
    {
      section: 'Main',
      items: [
        { icon: 'dashboard', label: 'Dashboard', path: '/me/dashboard' },
        { icon: 'user', label: 'Profile', path: '/me/profile' },
      ],
    },
    {
      section: 'Work',
      items: [
        { icon: 'attendance', label: 'Attendance', path: '/me/attendance' },
        { icon: 'leave', label: 'Leave', path: '/me/leave' },
        { icon: 'payslip', label: 'Payslips', path: '/me/payslips' },
        { icon: 'documents', label: 'Documents', path: '/me/documents' },
      ],
    },
    {
      section: 'More',
      items: [
        { icon: 'bell', label: 'News', path: '/me/announcements' },
        { icon: 'settings', label: 'Settings', path: '/me/settings' },
      ],
    },
  ],
};

/** Where each role lands after signing in — mirrors the map in index.html's `go()`. */
export const ROLE_LANDING: Record<Role, string> = {
  'Super Admin': '/dashboard',
  'Company Admin': '/dashboard',
  'HR Manager': '/dashboard',
  Manager: '/dashboard',
  Employee: '/me/dashboard',
};
