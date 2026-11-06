import { AppNotification, Role } from '../models';

/** Notification feed for admin / HR / manager roles (from layout.js). */
export const ADMIN_NOTIFICATIONS: AppNotification[] = [
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    title: 'Leave Approved',
    message: 'Your annual leave (Feb 10-14) has been approved.',
    time: '2 min ago',
    unread: true,
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    title: 'Attendance Alert',
    message: 'An employee check-in exception was recorded today.',
    time: '15 min ago',
    unread: true,
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    title: 'New Approval Request',
    message: 'A new overtime request has been submitted for review.',
    time: '1 hr ago',
    unread: true,
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    title: 'Document Expiry',
    message: 'A company compliance document is expiring soon.',
    time: '3 hr ago',
    unread: true,
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    title: 'Payroll Processed',
    message: 'January 2025 payroll has been processed.',
    time: '1 day ago',
    unread: false,
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    title: 'Policy Update',
    message: 'New leave policy effective March 1, 2025.',
    time: '2 days ago',
    unread: false,
  },
];

const box = (bg: string, stroke: string, inner: string): string =>
  `<div style="width:32px;height:32px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></div>`;

/** Notification feed for the employee portal (from emp-layout.js). */
export const EMPLOYEE_NOTIFICATIONS: AppNotification[] = [
  {
    icon: box('#dcfce7', '#16a34a', '<polyline points="20 6 9 17 4 12"/>'),
    title: 'Leave Approved',
    message: 'Your sick leave (Jan 8–9) has been approved.',
    time: '1 hr ago',
    unread: true,
  },
  {
    icon: box('#dbeafe', '#2563eb', '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    title: 'Salary Credited',
    message: 'January 2025 salary has been credited.',
    time: '2 hr ago',
    unread: true,
  },
  {
    icon: box('#eff6ff', '#2563eb', '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    title: 'Task Assigned',
    message: 'New task: Complete Q4 Report by Jan 31.',
    time: '3 hr ago',
    unread: true,
  },
  {
    icon: box('#fef3c7', '#d97706', '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    title: 'Policy Update',
    message: 'New leave policy effective March 1, 2025.',
    time: '1 day ago',
    unread: false,
  },
  {
    icon: box('#ede9fe', '#7c3aed', '<circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/><path d="M12 14v2"/>'),
    title: 'Work Anniversary',
    message: 'Congratulations! 3 years at HRMS.',
    time: '2 days ago',
    unread: false,
  },
];

export function notificationsFor(role: Role): AppNotification[] {
  return role === 'Employee' ? EMPLOYEE_NOTIFICATIONS : ADMIN_NOTIFICATIONS;
}
