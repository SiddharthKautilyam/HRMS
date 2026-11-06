import { Role } from '../models';

/** Role-aware canned answer engine — ported from assets/js/ai-chat.js. */
export function aiResponse(rawMessage: string, role: Role): string {
  const m = rawMessage.toLowerCase();
  const isAdmin = role === 'HR Manager' || role === 'Super Admin' || role === 'Company Admin';

  if (/^(hi|hello|hey|good morning|good afternoon|thanks|thank you|ok|okay|great)[!.\s]*$/.test(m)) {
    return 'Hello! 👋 How can I assist you today? Ask me about leave, payroll, attendance, onboarding, documents, loans, approvals, or any HR topic.';
  }

  if (/leave|vacation|time off|annual|sick|emergency leave|maternity|paternity|unpaid/.test(m)) {
    if (isAdmin) {
      return 'You can view, approve, and track all employee leave requests or configure leave types under <b>Leave Management</b>.';
    }
    return 'You can view your available leave balances and submit a new leave request under <b>Leave Management → Apply Leave</b>.';
  }

  if (/payroll|salary|payslip|pay slip|net pay|gross|deduction|allowance|wage|increment|ctc|compensation/.test(m)) {
    if (isAdmin) {
      return 'You can process monthly salary cycles, review employee payslips, and export WPS reports under <b>Payroll</b>.';
    }
    return 'You can view and download your payslips for any payroll cycle under <b>My Payslips</b>.';
  }

  if (/attendance|clock|punch|check.?in|check.?out|late|absent|muster|regulariz/.test(m)) {
    if (isAdmin) {
      return 'Daily attendance logs, check-in timestamps, and pending regularization requests are managed under <b>Attendance</b>.';
    }
    return 'You can track your daily punches and submit attendance regularization requests in the <b>Attendance</b> section.';
  }

  if (/onboard|new hire|joining|wizard|biometric|it equipment|system access/.test(m)) {
    if (isAdmin) {
      return 'Onboard new staff step-by-step through Personal, Job, Salary, Documents, and Account creation under <b>Onboarding</b>.';
    }
    return 'Your onboarding tasks and document submissions can be reviewed in <b>My Profile</b>.';
  }

  if (/document|passport|visa|emirates id|work permit|insurance|expir|upload/.test(m)) {
    if (isAdmin) {
      return 'Track employee document expiries, upload renewals, and verify legal papers under <b>Documents</b>.';
    }
    return 'You can view your uploaded employee documents and check expiry status under <b>Profile → Documents</b>.';
  }

  if (/loan|advance|salary advance|emi|repayment|borrow/.test(m)) {
    if (isAdmin) {
      return 'Manage company loan disbursements, EMI deductions, and staff advances under <b>Loans & Advances</b>.';
    }
    return 'You can apply for personal loans or salary advances under <b>Loans & Advances</b>.';
  }

  if (/approv|pending approval|reject|request status/.test(m)) {
    if (isAdmin) {
      return 'Review and action all pending leave, overtime, and regularization requests under <b>Approvals</b>.';
    }
    return 'Check the status of your submitted leave, advance, and regularization requests in their respective sections.';
  }

  if (/report|analytics|export|download report|stat|metric|summary/.test(m)) {
    if (isAdmin) {
      return 'Export comprehensive payroll, attendance, leave, and workforce reports in CSV/PDF format under <b>Reports</b>.';
    }
    return 'You can download your payslips and attendance records from your personal dashboard.';
  }

  if (/employee|staff|team member|headcount|department|roster|add employee/.test(m)) {
    if (isAdmin) {
      return 'Search, edit, and add team members across departments in the <b>Employees</b> directory.';
    }
    return 'View your profile and company team details in <b>My Profile</b>.';
  }

  if (/policy|policies|holiday|shift|branch|company|settings|handbook|notice period|work hour|guideline/.test(m)) {
    if (isAdmin) {
      return 'Manage company details, departments, designations, holidays, shifts, and permissions in <b>Settings</b>.';
    }
    return 'Company holiday calendars and work schedules can be checked under <b>Attendance</b>.';
  }

  if (/performance|review|goal|kpi|rating|appraisal/.test(m)) {
    return 'Performance reviews and KPIs are tracked in <b>My Performance</b>. View your goals, ratings, and upcoming review schedule there. Contact your manager or HR for appraisal queries.';
  }

  if (/task|to.?do|assignment|checklist/.test(m)) {
    return 'Your tasks and assignments are in <b>My Tasks</b>. View pending items, mark tasks complete, and track deadlines from there.';
  }

  if (/announcement|notice|news|update|bulletin/.test(m)) {
    return 'Company announcements are in <b>Announcements</b>. Check there for the latest HR updates, policy changes, and company news.';
  }

  if (/profile|setting|password|account|personal detail|bank detail/.test(m)) {
    return 'Update your personal details, bank info, and contact details in <b>My Profile</b>. To change your password go to <b>Settings → Security</b>. For bank detail changes, contact HR directly.';
  }

  return 'I can help with <b>leave</b>, <b>payroll & payslips</b>, <b>attendance</b>, <b>onboarding</b>, <b>documents</b>, <b>loans</b>, <b>approvals</b>, <b>reports</b>, and <b>HR policies</b>. Could you be more specific about what you need?';
}

/** Opening line the assistant shows per role. */
export const AI_GREETINGS: Record<Role, string> = {
  'Super Admin':
    'Hi Admin! I can help with system settings, user management, payroll, reports, and HR policies.',
  'HR Manager':
    'Hi HR Manager! I can help with employee queries, leave policies, payroll processing, and compliance.',
  'Company Admin':
    'Hi! I can help you manage your company — employees, leave, payroll, attendance, and reports.',
  Manager:
    'Hi Manager! I can help you manage team attendance, review leave approvals, monitor shift rosters, and reports.',
  Employee:
    "Hi! I'm your HR assistant. I can help with leave, payroll, attendance, onboarding, and company policies.",
};

/** Quick suggestion chips per role. */
export const AI_SUGGESTIONS: Record<Role, string[]> = {
  'Super Admin': ['Payroll Overview', 'Pending Approvals', 'Document Expiry', 'Company Settings'],
  'HR Manager': ['Leave Requests', 'Payroll Processing', 'Employee Onboarding', 'Attendance Report'],
  'Company Admin': ['Add Employee', 'Leave Requests', 'Payroll Processing', 'Attendance Report'],
  Manager: ['Team Attendance', 'Pending Approvals', 'Shift Roster', 'Leave Requests'],
  Employee: ['Apply for Leave', 'View Payslip', 'Attendance Query', 'Loan Request'],
};
