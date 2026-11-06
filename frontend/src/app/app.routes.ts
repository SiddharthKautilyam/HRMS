import { Routes } from '@angular/router';
import { authGuard, landingRedirectGuard, superAdminGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

/**
 * Every page from the original static site is mapped to a lazy-loaded standalone
 * component. Admin / HR / manager pages share the ShellComponent; the employee
 * portal lives under `/me/*` on the same shell (the sidebar swaps by role).
 * The first-run welcome wizard is standalone (no shell), matching the original.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot Password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },

  // Company admin account activation (public, rendered without the app shell).
  {
    path: 'activate',
    title: 'Activate Account',
    loadComponent: () =>
      import('./features/auth/activate.component').then((m) => m.ActivateComponent),
  },

  // Standalone first-run onboarding (rendered without the app shell).
  {
    path: 'me/onboarding',
    title: 'Welcome Onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/employee/emp-onboarding.component').then((m) => m.EmpOnboardingComponent),
  },

  // Standalone Face Recognition Attendance Kiosk (Mounted tablet / office entrance screen)
  {
    path: 'kiosk',
    title: 'Face Attendance Kiosk',
    loadComponent: () =>
      import('./features/attendance/kiosk.component').then((m) => m.KioskComponent),
  },

  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    children: [],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      // Dashboards
      {
        path: 'dashboard',
        data: { title: 'HRMS Home' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'analytics',
        data: { title: 'Analytics' },
        loadComponent: () => import('./features/dashboard/analytics.component').then((m) => m.AnalyticsComponent),
      },

      // HR modules
      {
        path: 'company',
        data: { title: 'Company' },
        loadComponent: () => import('./features/hr/company.component').then((m) => m.CompanyComponent),
      },
      {
        path: 'employees',
        data: { title: 'Employees' },
        loadComponent: () => import('./features/hr/employees.component').then((m) => m.EmployeesComponent),
      },
      {
        path: 'employee-profile',
        data: { title: 'Profile' },
        loadComponent: () =>
          import('./features/hr/employee-profile.component').then((m) => m.EmployeeProfileComponent),
      },
      {
        path: 'onboarding',
        data: { title: 'Onboarding' },
        loadComponent: () => import('./features/hr/onboarding.component').then((m) => m.OnboardingComponent),
      },
      {
        path: 'leave',
        data: { title: 'Leave Management' },
        loadComponent: () => import('./features/hr/leave.component').then((m) => m.LeaveComponent),
      },
      {
        path: 'attendance',
        data: { title: 'Attendance' },
        loadComponent: () => import('./features/hr/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'shift',
        data: { title: 'Shift Management' },
        loadComponent: () => import('./features/hr/shift.component').then((m) => m.ShiftComponent),
      },
      {
        path: 'roster',
        data: { title: 'Shift Roster' },
        loadComponent: () => import('./features/hr/shift.component').then((m) => m.ShiftComponent),
      },
      {
        path: 'payroll',
        data: { title: 'Payroll Processing' },
        loadComponent: () => import('./features/hr/payroll.component').then((m) => m.PayrollComponent),
      },
      {
        path: 'payslips',
        data: { title: 'Payslip' },
        loadComponent: () => import('./features/hr/payslip.component').then((m) => m.PayslipComponent),
      },
      {
        path: 'documents',
        data: { title: 'Documents' },
        loadComponent: () => import('./features/hr/documents.component').then((m) => m.DocumentsComponent),
      },
      {
        path: 'approvals',
        data: { title: 'Approvals' },
        loadComponent: () => import('./features/hr/approvals.component').then((m) => m.ApprovalsComponent),
      },
      {
        path: 'loans',
        data: { title: 'Loans & Advances' },
        loadComponent: () => import('./features/hr/loans.component').then((m) => m.LoansComponent),
      },
      {
        path: 'reports',
        data: { title: 'Reports' },
        loadComponent: () => import('./features/hr/reports.component').then((m) => m.ReportsComponent),
      },

      // Master setup
      {
        path: 'settings',
        data: { title: 'Company Settings' },
        loadComponent: () => import('./features/hr/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'erp',
        data: { title: 'ERP Integration' },
        loadComponent: () => import('./features/hr/erp.component').then((m) => m.ErpComponent),
      },

      // Platform administration (Merged into unified Company Management)
      {
        path: 'companies',
        redirectTo: 'company',
        pathMatch: 'full',
      },
      {
        path: 'support',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },

      // Employee portal
      {
        path: 'me/dashboard',
        data: { title: 'My Dashboard' },
        loadComponent: () =>
          import('./features/employee/emp-dashboard.component').then((m) => m.EmpDashboardComponent),
      },
      {
        path: 'me/home',
        data: { title: 'My Dashboard' },
        loadComponent: () => import('./features/employee/emp-home.component').then((m) => m.EmpHomeComponent),
      },
      {
        path: 'me/profile',
        data: { title: 'Profile' },
        loadComponent: () => import('./features/employee/emp-profile.component').then((m) => m.EmpProfileComponent),
      },
      {
        path: 'me/attendance',
        data: { title: 'My Attendance' },
        loadComponent: () =>
          import('./features/employee/emp-attendance.component').then((m) => m.EmpAttendanceComponent),
      },
      {
        path: 'me/leave',
        data: { title: 'Leave' },
        loadComponent: () => import('./features/employee/emp-leave.component').then((m) => m.EmpLeaveComponent),
      },
      {
        path: 'me/payslips',
        data: { title: 'Payslips' },
        loadComponent: () => import('./features/employee/emp-payslips.component').then((m) => m.EmpPayslipsComponent),
      },
      {
        path: 'me/payroll',
        data: { title: 'Payroll' },
        loadComponent: () => import('./features/employee/emp-payroll.component').then((m) => m.EmpPayrollComponent),
      },
      {
        path: 'me/documents',
        data: { title: 'Documents' },
        loadComponent: () =>
          import('./features/employee/emp-documents.component').then((m) => m.EmpDocumentsComponent),
      },
      {
        path: 'me/announcements',
        data: { title: 'Announcements' },
        loadComponent: () =>
          import('./features/employee/emp-announcements.component').then((m) => m.EmpAnnouncementsComponent),
      },
      {
        path: 'me/settings',
        data: { title: 'Settings' },
        loadComponent: () => import('./features/employee/emp-settings.component').then((m) => m.EmpSettingsComponent),
      },
      {
        path: 'me/tasks',
        data: { title: 'Tasks' },
        loadComponent: () => import('./features/employee/emp-tasks.component').then((m) => m.EmpTasksComponent),
      },
      {
        path: 'me/performance',
        data: { title: 'Performance' },
        loadComponent: () =>
          import('./features/employee/emp-performance.component').then((m) => m.EmpPerformanceComponent),
      },

      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
