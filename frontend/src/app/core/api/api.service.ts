import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Announcement,
  Approval,
  ApprovalSummary,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceTrendPoint,
  Activity,
  DashboardStats,
  DepartmentDto,
  DepartmentHeadcount,
  DesignationDto,
  CompanyItemDto,
  DocumentDto,
  DocumentSummary,
  EmployeeDetail,
  EmployeeListItem,
  ExpoAlert,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Loan,
  LoanSummary,
  LoginResponse,
  MonthlyMusterDay,
  NotificationItem,
  Paged,
  PayrollRun,
  PayrollSummary,
  Payslip,
  PendingApproval,
  RecentLeave,
  Regularization,
  ApiUser,
  AttendanceReportRow,
  BranchDto,
  CompanyLogoResponse,
  CompanySettings,
  SaveCompanySettingsRequest,
  TenantBrandingResponse,
  EmployeeDashboard,
  ErpOverview,
  HolidayDto,
  LeaveReportRow,
  NotificationPreference,
  OvertimeReportRow,
  PayrollReportRow,
  PerformanceReview,
  ShiftDto,
  TaskItem,
  EmployeePunch,
  EmployeePunchStatus,
  TodayAttendanceOverview,
  EnrolledFace,
  EnrollFaceRequest,
  FacePunchRequest,
  FacePunchResult,
  NoticeBoardItem,
  CelebrationItem,
  DashboardTemplateData,
  ShiftTemplateDto,
  ShiftAssignmentDto,
  RosterMatrix,
  NavigationItem,
  SaveNavigationItemRequest,
  ReorderNavigationBatchRequest,
  RoleItem,
  CreateRoleRequest,
  UpdateRoleRequest,
  RoleNavigationPermission,
  SaveRolePermissionsRequest,
  KeyStore,
  KeyGroup,
  SaveKeyGroupRequest,
  SaveKeyStoreRequest,
  ReorderKeyStoresRequest,
  Asset,
  SupportTicket,
  ActivationInfo,
  CompanyDetail,
  CompanyListItem,
  CompanyProvisioningResult,
  CreateCompanyRequest,
  ResendInvitationResult,
  UpdateCompanyRequest,
} from './api.models';

type Query = Record<string, unknown>;

/**
 * Thin, typed wrapper around the .NET HRMS API. Authentication is attached by
 * the auth interceptor; callers only deal with typed payloads.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  private departmentsCache$?: Observable<DepartmentDto[]>;
  private designationsCache$?: Observable<DesignationDto[]>;
  private branchesCache$?: Observable<BranchDto[]>;

  // ── Auth ──
  getTenantBranding(code?: string, subdomain?: string): Observable<TenantBrandingResponse> {
    const params: Record<string, string> = {};
    if (code?.trim()) params['code'] = code.trim();
    if (subdomain?.trim()) params['subdomain'] = subdomain.trim();
    return this.http.get<TenantBrandingResponse>(this.url('/auth/tenant-branding'), { params });
  }

  login(email: string, password: string, companyCode?: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url('/auth/login'), {
      email,
      password,
      companyCode: companyCode?.trim() ? companyCode.trim() : null,
    });
  }

  me(): Observable<ApiUser> {
    return this.http.get<ApiUser>(this.url('/auth/me'));
  }

  updateProfile(fullName: string): Observable<ApiUser> {
    return this.http.put<ApiUser>(this.url('/auth/profile'), { fullName });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(this.url('/auth/change-password'), { currentPassword, newPassword });
  }

  /** Validates an account activation token so the set-password screen can render. */
  validateActivation(token: string): Observable<ActivationInfo> {
    return this.http.get<ActivationInfo>(this.url('/auth/activate'), { params: toParams({ token }) });
  }

  /** Sets the company admin password from an activation token and signs them in. */
  activateAccount(token: string, newPassword: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url('/auth/activate'), { token, newPassword });
  }

  // ── Platform: company management (Super Admin only) ──
  tenantCompanies(search?: string): Observable<CompanyListItem[]> {
    return this.http.get<CompanyListItem[]>(this.url('/companies'), { params: toParams({ search }) });
  }

  tenantCompany(id: string): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(this.url(`/companies/${id}`));
  }

  createTenantCompany(body: CreateCompanyRequest): Observable<CompanyProvisioningResult> {
    return this.http.post<CompanyProvisioningResult>(this.url('/companies'), body);
  }

  updateTenantCompany(id: string, body: UpdateCompanyRequest): Observable<CompanyDetail> {
    return this.http.put<CompanyDetail>(this.url(`/companies/${id}`), body);
  }

  activateTenantCompany(id: string): Observable<CompanyDetail> {
    return this.http.post<CompanyDetail>(this.url(`/companies/${id}/activate`), {});
  }

  suspendTenantCompany(id: string): Observable<CompanyDetail> {
    return this.http.post<CompanyDetail>(this.url(`/companies/${id}/suspend`), {});
  }

  retryProvisioning(id: string): Observable<CompanyProvisioningResult> {
    return this.http.post<CompanyProvisioningResult>(this.url(`/companies/${id}/retry-provisioning`), {});
  }

  resendInvitation(id: string): Observable<ResendInvitationResult> {
    return this.http.post<ResendInvitationResult>(this.url(`/companies/${id}/resend-invitation`), {});
  }

  deleteTenantCompany(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/companies/${id}`));
  }

  // ── Employees ──
  employees(query: Query = {}): Observable<Paged<EmployeeListItem>> {
    return this.http.get<Paged<EmployeeListItem>>(this.url('/employees'), { params: toParams(query) });
  }

  employee(id: string): Observable<EmployeeDetail> {
    return this.http.get<EmployeeDetail>(this.url(`/employees/${id}`));
  }

  employeeMe(employeeId?: string): Observable<EmployeeDetail> {
    return this.http.get<EmployeeDetail>(this.url('/employees/me'), { params: toParams({ employeeId }) });
  }

  createEmployee(body: unknown): Observable<EmployeeDetail> {
    return this.http.post<EmployeeDetail>(this.url('/employees'), body);
  }

  updateEmployee(id: string, body: unknown): Observable<EmployeeDetail> {
    return this.http.put<EmployeeDetail>(this.url(`/employees/${id}`), body);
  }

  deleteEmployee(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/employees/${id}`));
  }

  // ── Leave ──
  leaveTypes(): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(this.url('/leave/types'));
  }

  createLeaveType(body: unknown): Observable<LeaveType> {
    return this.http.post<LeaveType>(this.url('/leave/types'), body);
  }

  updateLeaveType(id: string, body: unknown): Observable<LeaveType> {
    return this.http.put<LeaveType>(this.url(`/leave/types/${id}`), body);
  }

  deleteLeaveType(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/leave/types/${id}`));
  }

  leaveRequests(query: Query = {}): Observable<Paged<LeaveRequest>> {
    return this.http.get<Paged<LeaveRequest>>(this.url('/leave/requests'), { params: toParams(query) });
  }

  leaveRequestsForEmployee(employeeId: string): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(this.url(`/leave/requests/employee/${employeeId}`));
  }

  createLeaveRequest(body: unknown): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(this.url('/leave/requests'), body);
  }

  approveLeave(id: string, note?: string): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(this.url(`/leave/requests/${id}/approve`), { note: note ?? null });
  }

  rejectLeave(id: string, note?: string): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(this.url(`/leave/requests/${id}/reject`), { note: note ?? null });
  }

  leaveBalances(employeeId: string): Observable<LeaveBalance[]> {
    return this.http.get<LeaveBalance[]>(this.url(`/leave/balances/${employeeId}`));
  }

  // ── Attendance ──
  attendanceSummary(): Observable<AttendanceSummary> {
    return this.http.get<AttendanceSummary>(this.url('/attendance/summary'));
  }

  attendanceToday(): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(this.url('/attendance/today'));
  }

  attendanceForEmployee(employeeId: string, year?: number, month?: number): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(this.url(`/attendance/employee/${employeeId}`), {
      params: toParams({ year, month }),
    });
  }

  muster(employeeId: string, year?: number, month?: number): Observable<MonthlyMusterDay[]> {
    return this.http.get<MonthlyMusterDay[]>(this.url(`/attendance/muster/${employeeId}`), {
      params: toParams({ year, month }),
    });
  }

  regularizations(): Observable<Regularization[]> {
    return this.http.get<Regularization[]>(this.url('/attendance/regularizations'));
  }

  createRegularization(body: unknown): Observable<Regularization> {
    return this.http.post<Regularization>(this.url('/attendance/regularizations'), body);
  }

  approveRegularization(id: string): Observable<Regularization> {
    return this.http.post<Regularization>(this.url(`/attendance/regularizations/${id}/approve`), {});
  }

  rejectRegularization(id: string): Observable<Regularization> {
    return this.http.post<Regularization>(this.url(`/attendance/regularizations/${id}/reject`), {});
  }

  // ── Payroll ──
  payrollSummary(): Observable<PayrollSummary> {
    return this.http.get<PayrollSummary>(this.url('/payroll/summary'));
  }

  payrollRuns(): Observable<PayrollRun[]> {
    return this.http.get<PayrollRun[]>(this.url('/payroll/runs'));
  }

  payslipsForRun(runId: string): Observable<Payslip[]> {
    return this.http.get<Payslip[]>(this.url(`/payroll/runs/${runId}/payslips`));
  }

  payslipsForEmployee(employeeId: string): Observable<Payslip[]> {
    return this.http.get<Payslip[]>(this.url(`/payroll/employees/${employeeId}/payslips`));
  }

  myPayslips(employeeId?: string): Observable<Payslip[]> {
    return this.http.get<Payslip[]>(this.url('/payroll/me/payslips'), { params: toParams({ employeeId }) });
  }

  runPayroll(body: unknown): Observable<PayrollRun> {
    return this.http.post<PayrollRun>(this.url('/payroll/run'), body);
  }

  downloadPayslip(params: {
    payslipId?: string;
    employeeId?: string;
    employeeCode?: string;
    month?: number;
    year?: number;
  }): Observable<Blob> {
    return this.http.get(this.url('/payroll/download-slip'), {
      params: toParams(params),
      responseType: 'blob',
    });
  }

  downloadPayslipById(id: string): Observable<Blob> {
    return this.http.get(this.url(`/payroll/payslips/${id}/download`), {
      responseType: 'blob',
    });
  }

  // ── Loans ──
  loans(status?: string): Observable<Loan[]> {
    return this.http.get<Loan[]>(this.url('/loans'), { params: toParams({ status }) });
  }

  loanSummary(): Observable<LoanSummary> {
    return this.http.get<LoanSummary>(this.url('/loans/summary'));
  }

  createLoan(body: unknown): Observable<Loan> {
    return this.http.post<Loan>(this.url('/loans'), body);
  }

  approveLoan(id: string): Observable<Loan> {
    return this.http.post<Loan>(this.url(`/loans/${id}/approve`), {});
  }

  rejectLoan(id: string): Observable<Loan> {
    return this.http.post<Loan>(this.url(`/loans/${id}/reject`), {});
  }

  // ── Documents ──
  documents(query: Query = {}): Observable<DocumentDto[]> {
    return this.http.get<DocumentDto[]>(this.url('/documents'), { params: toParams(query) });
  }

  companyDocuments(): Observable<DocumentDto[]> {
    return this.http.get<DocumentDto[]>(this.url('/documents/company'));
  }

  documentSummary(): Observable<DocumentSummary> {
    return this.http.get<DocumentSummary>(this.url('/documents/summary'));
  }

  createDocument(body: unknown): Observable<DocumentDto> {
    return this.http.post<DocumentDto>(this.url('/documents'), body);
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/documents/${id}`));
  }

  // ── Approvals ──
  approvals(query: Query = {}): Observable<Approval[]> {
    return this.http.get<Approval[]>(this.url('/approvals'), { params: toParams(query) });
  }

  approvalSummary(): Observable<ApprovalSummary> {
    return this.http.get<ApprovalSummary>(this.url('/approvals/summary'));
  }

  createApproval(body: unknown): Observable<Approval> {
    return this.http.post<Approval>(this.url('/approvals'), body);
  }

  approveApproval(id: string, note?: string): Observable<Approval> {
    return this.http.post<Approval>(this.url(`/approvals/${id}/approve`), { note: note ?? null });
  }

  rejectApproval(id: string, note?: string): Observable<Approval> {
    return this.http.post<Approval>(this.url(`/approvals/${id}/reject`), { note: note ?? null });
  }

  approveAllApprovals(): Observable<{ approved: number }> {
    return this.http.post<{ approved: number }>(this.url('/approvals/approve-all'), {});
  }

  // ── Organisation ──
  departments(): Observable<DepartmentDto[]> {
    if (!this.departmentsCache$) {
      this.departmentsCache$ = this.http
        .get<DepartmentDto[]>(this.url('/organization/departments'))
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.departmentsCache$;
  }

  createDepartment(body: unknown): Observable<DepartmentDto> {
    this.departmentsCache$ = undefined;
    return this.http.post<DepartmentDto>(this.url('/organization/departments'), body);
  }

  updateDepartment(id: string, body: unknown): Observable<DepartmentDto> {
    this.departmentsCache$ = undefined;
    return this.http.put<DepartmentDto>(this.url(`/organization/departments/${id}`), body);
  }

  deleteDepartment(id: string): Observable<void> {
    this.departmentsCache$ = undefined;
    return this.http.delete<void>(this.url(`/organization/departments/${id}`));
  }

  designations(): Observable<DesignationDto[]> {
    if (!this.designationsCache$) {
      this.designationsCache$ = this.http
        .get<DesignationDto[]>(this.url('/organization/designations'))
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.designationsCache$;
  }

  createDesignation(body: unknown): Observable<DesignationDto> {
    this.designationsCache$ = undefined;
    return this.http.post<DesignationDto>(this.url('/organization/designations'), body);
  }

  updateDesignation(id: string, body: unknown): Observable<DesignationDto> {
    this.designationsCache$ = undefined;
    return this.http.put<DesignationDto>(this.url(`/organization/designations/${id}`), body);
  }

  deleteDesignation(id: string): Observable<void> {
    this.designationsCache$ = undefined;
    return this.http.delete<void>(this.url(`/organization/designations/${id}`));
  }

  company(): Observable<CompanySettings> {
    return this.http.get<CompanySettings>(this.url('/organization/company'));
  }

  updateCompany(body: SaveCompanySettingsRequest): Observable<CompanySettings> {
    return this.http.put<CompanySettings>(this.url('/organization/company'), body);
  }

  uploadCompanyLogo(file: File): Observable<CompanyLogoResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<CompanyLogoResponse>(this.url('/organization/company/logo'), formData);
  }

  companies(): Observable<CompanyItemDto[]> {
    return this.http.get<CompanyItemDto[]>(this.url('/organization/branches'));
  }

  createCompany(body: unknown): Observable<CompanyItemDto> {
    this.branchesCache$ = undefined;
    return this.http.post<CompanyItemDto>(this.url('/organization/branches'), body);
  }

  deleteCompany(id: string): Observable<void> {
    this.branchesCache$ = undefined;
    return this.http.delete<void>(this.url(`/organization/branches/${id}`));
  }

  branches(): Observable<BranchDto[]> {
    if (!this.branchesCache$) {
      this.branchesCache$ = this.http
        .get<BranchDto[]>(this.url('/organization/branches'))
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.branchesCache$;
  }

  holidays(): Observable<HolidayDto[]> {
    return this.http.get<HolidayDto[]>(this.url('/organization/holidays'));
  }

  createHoliday(body: unknown): Observable<HolidayDto> {
    return this.http.post<HolidayDto>(this.url('/organization/holidays'), body);
  }

  updateHoliday(id: string, body: unknown): Observable<HolidayDto> {
    return this.http.put<HolidayDto>(this.url(`/organization/holidays/${id}`), body);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/organization/holidays/${id}`));
  }

  shifts(): Observable<ShiftDto[]> {
    return this.http.get<ShiftDto[]>(this.url('/organization/shifts'));
  }

  createBranch(body: unknown): Observable<BranchDto> {
    return this.http.post<BranchDto>(this.url('/organization/branches'), body);
  }

  updateBranch(id: string, body: unknown): Observable<BranchDto> {
    return this.http.put<BranchDto>(this.url(`/organization/branches/${id}`), body);
  }

  createShift(body: unknown): Observable<ShiftDto> {
    return this.http.post<ShiftDto>(this.url('/organization/shifts'), body);
  }

  updateShift(id: string, body: unknown): Observable<ShiftDto> {
    return this.http.put<ShiftDto>(this.url(`/organization/shifts/${id}`), body);
  }

  deleteShift(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/organization/shifts/${id}`));
  }

  // ── Announcements / notifications ──
  announcements(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(this.url('/announcements'));
  }

  notifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(this.url('/notifications'));
  }

  markNotificationRead(id: string): Observable<void> {
    return this.http.post<void>(this.url(`/notifications/${id}/read`), {});
  }

  // ── Dashboard ──
  dashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(this.url('/dashboard/stats'));
  }

  departmentHeadcount(): Observable<DepartmentHeadcount[]> {
    return this.http.get<DepartmentHeadcount[]>(this.url('/dashboard/department-headcount'));
  }

  attendanceTrend(): Observable<AttendanceTrendPoint[]> {
    return this.http.get<AttendanceTrendPoint[]>(this.url('/dashboard/attendance-trend'));
  }

  recentActivity(take = 6): Observable<Activity[]> {
    return this.http.get<Activity[]>(this.url('/dashboard/activity'), { params: toParams({ take }) });
  }

  documentAlerts(take = 5): Observable<ExpoAlert[]> {
    return this.http.get<ExpoAlert[]>(this.url('/dashboard/document-alerts'), { params: toParams({ take }) });
  }

  pendingApprovals(take = 5): Observable<PendingApproval[]> {
    return this.http.get<PendingApproval[]>(this.url('/dashboard/pending-approvals'), { params: toParams({ take }) });
  }

  recentLeaves(take = 5): Observable<RecentLeave[]> {
    return this.http.get<RecentLeave[]>(this.url('/dashboard/recent-leaves'), { params: toParams({ take }) });
  }

  dashboardMe(employeeId?: string): Observable<EmployeeDashboard> {
    return this.http.get<EmployeeDashboard>(this.url('/dashboard/me'), { params: toParams({ employeeId }) });
  }

  // ── Tasks ──
  tasks(employeeId?: string): Observable<TaskItem[]> {
    return this.http.get<TaskItem[]>(this.url('/tasks'), { params: toParams({ employeeId }) });
  }

  createTask(body: unknown): Observable<TaskItem> {
    return this.http.post<TaskItem>(this.url('/tasks'), body);
  }

  updateTaskStatus(id: string, status: string): Observable<TaskItem> {
    return this.http.patch<TaskItem>(this.url(`/tasks/${id}/status`), { status });
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/tasks/${id}`));
  }

  // ── Performance ──
  performanceMe(employeeId?: string): Observable<PerformanceReview> {
    return this.http.get<PerformanceReview>(this.url('/performance/me'), { params: toParams({ employeeId }) });
  }

  performanceList(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(this.url('/performance'));
  }

  // ── ERP ──
  erpOverview(): Observable<ErpOverview> {
    return this.http.get<ErpOverview>(this.url('/erp'));
  }

  erpSync(): Observable<ErpOverview> {
    return this.http.post<ErpOverview>(this.url('/erp/sync'), {});
  }

  // ── Reports ──
  reportsPayroll(): Observable<PayrollReportRow[]> {
    return this.http.get<PayrollReportRow[]>(this.url('/reports/payroll'));
  }

  reportsAttendance(year?: number, month?: number): Observable<AttendanceReportRow[]> {
    return this.http.get<AttendanceReportRow[]>(this.url('/reports/attendance'), { params: toParams({ year, month }) });
  }

  reportsLeave(): Observable<LeaveReportRow[]> {
    return this.http.get<LeaveReportRow[]>(this.url('/reports/leave'));
  }

  reportsOvertime(): Observable<OvertimeReportRow[]> {
    return this.http.get<OvertimeReportRow[]>(this.url('/reports/overtime'));
  }

  // ── Notification preferences ──
  notificationPreferences(): Observable<NotificationPreference[]> {
    return this.http.get<NotificationPreference[]>(this.url('/notifications/preferences'));
  }

  updateNotificationPreference(id: string, enabled: boolean): Observable<NotificationPreference> {
    return this.http.put<NotificationPreference>(this.url(`/notifications/preferences/${id}`), { enabled });
  }

  // ── Ported modules: Punch, Roster, Navigation, Options, Assets, Support, Dashboard Template ──
  recordPunch(payload: { punchType: string; note?: string; device?: string; employeeId?: string }): Observable<EmployeePunch> {
    return this.http.post<EmployeePunch>(this.url('/attendance/punch'), payload);
  }

  punchStatus(employeeId?: string): Observable<EmployeePunchStatus> {
    return this.http.get<EmployeePunchStatus>(this.url('/attendance/punch/status'), { params: toParams({ employeeId }) });
  }

  todayPunches(employeeId?: string): Observable<EmployeePunch[]> {
    return this.http.get<EmployeePunch[]>(this.url('/attendance/punches/today'), { params: toParams({ employeeId }) });
  }

  todayAttendanceOverview(): Observable<TodayAttendanceOverview> {
    return this.http.get<TodayAttendanceOverview>(this.url('/attendance/overview/today'));
  }

  enrolledFaces(token?: string): Observable<EnrolledFace[]> {
    return this.http.get<EnrolledFace[]>(this.url('/attendance/enrolled-faces'), this.withToken(token));
  }

  facePunch(payload: FacePunchRequest, token?: string): Observable<FacePunchResult> {
    return this.http.post<FacePunchResult>(this.url('/attendance/face-punch'), payload, this.withToken(token));
  }

  enrollFace(employeeId: string, payload: EnrollFaceRequest, token?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      this.url(`/attendance/employees/${employeeId}/enroll-face`),
      payload,
      this.withToken(token),
    );
  }

  removeFace(employeeId: string, token?: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      this.url(`/attendance/employees/${employeeId}/enroll-face`),
      this.withToken(token),
    );
  }

  /** Adds an explicit bearer token (used before the session is established at login). */
  private withToken(token?: string): { headers?: Record<string, string> } {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  dashboardTemplateData(employeeId?: string): Observable<DashboardTemplateData> {
    return this.http.get<DashboardTemplateData>(this.url('/dashboard/template-data'), { params: toParams({ employeeId }) });
  }

  shiftTemplates(): Observable<ShiftTemplateDto[]> {
    return this.http.get<ShiftTemplateDto[]>(this.url('/roster/templates'));
  }

  createShiftTemplate(payload: any): Observable<ShiftTemplateDto> {
    return this.http.post<ShiftTemplateDto>(this.url('/roster/templates'), payload);
  }

  updateShiftTemplate(id: string, payload: any): Observable<ShiftTemplateDto> {
    return this.http.put<ShiftTemplateDto>(this.url(`/roster/templates/${id}`), payload);
  }

  deleteShiftTemplate(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/roster/templates/${id}`));
  }

  shiftAssignments(departmentId?: string): Observable<ShiftAssignmentDto[]> {
    return this.http.get<ShiftAssignmentDto[]>(this.url('/roster/assignments'), { params: toParams({ departmentId }) });
  }

  assignShift(payload: any): Observable<ShiftAssignmentDto> {
    return this.http.post<ShiftAssignmentDto>(this.url('/roster/assignments'), payload);
  }

  generateRoster(payload: { startDate: string; endDate: string; departmentId?: string }): Observable<RosterMatrix> {
    return this.http.post<RosterMatrix>(this.url('/roster/generate'), payload);
  }

  // ── Roles ──
  roles(): Observable<RoleItem[]> {
    return this.http.get<RoleItem[]>(this.url('/roles'));
  }

  role(id: string): Observable<RoleItem> {
    return this.http.get<RoleItem>(this.url(`/roles/${id}`));
  }

  createRole(payload: CreateRoleRequest): Observable<RoleItem> {
    return this.http.post<RoleItem>(this.url('/roles'), payload);
  }

  updateRole(id: string, payload: UpdateRoleRequest): Observable<RoleItem> {
    return this.http.put<RoleItem>(this.url(`/roles/${id}`), payload);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/roles/${id}`));
  }

  // ── Navigation ──
  navigationTree(): Observable<NavigationItem[]> {
    return this.http.get<NavigationItem[]>(this.url('/navigation/tree'));
  }

  navigationList(): Observable<NavigationItem[]> {
    return this.http.get<NavigationItem[]>(this.url('/navigation/tree'));
  }

  userNavigation(): Observable<NavigationItem[]> {
    return this.http.get<NavigationItem[]>(this.url('/navigation/user'));
  }

  createNavigationItem(payload: SaveNavigationItemRequest): Observable<NavigationItem> {
    return this.http.post<NavigationItem>(this.url('/navigation'), payload);
  }

  updateNavigationItem(id: string, payload: SaveNavigationItemRequest): Observable<NavigationItem> {
    return this.http.put<NavigationItem>(this.url(`/navigation/${id}`), payload);
  }

  deleteNavigationItem(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/navigation/${id}`));
  }

  reorderNavigation(payload: ReorderNavigationBatchRequest): Observable<void> {
    return this.http.put<void>(this.url('/navigation/reorder'), payload);
  }

  rolePermissions(roleId: string): Observable<RoleNavigationPermission[]> {
    return this.http.get<RoleNavigationPermission[]>(this.url(`/navigation/role/${roleId}`));
  }

  saveRolePermissions(payload: SaveRolePermissionsRequest): Observable<void> {
    return this.http.post<void>(this.url('/navigation/role'), payload);
  }

  optionsMultiple(groupCodes: string[]): Observable<Record<string, KeyStore[]>> {
    return this.http.post<Record<string, KeyStore[]>>(this.url('/options/multiple'), groupCodes);
  }

  keyGroups(): Observable<KeyGroup[]> {
    return this.http.get<KeyGroup[]>(this.url('/options/groups'));
  }

  keyGroup(id: string): Observable<KeyGroup> {
    return this.http.get<KeyGroup>(this.url(`/options/groups/${id}`));
  }

  saveKeyGroup(payload: SaveKeyGroupRequest): Observable<KeyGroup> {
    if (payload.id) {
      return this.http.put<KeyGroup>(this.url(`/options/groups/${payload.id}`), payload);
    }
    return this.http.post<KeyGroup>(this.url('/options/groups'), payload);
  }

  deleteKeyGroup(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/options/groups/${id}`));
  }

  keyStoresByGroup(groupCode: string): Observable<KeyStore[]> {
    return this.http.get<KeyStore[]>(this.url(`/options/group/${groupCode}`));
  }

  saveKeyStore(payload: SaveKeyStoreRequest): Observable<KeyStore> {
    if (payload.id) {
      return this.http.put<KeyStore>(this.url(`/options/values/${payload.id}`), payload);
    }
    return this.http.post<KeyStore>(this.url('/options/values'), payload);
  }

  deleteKeyStore(id: string): Observable<void> {
    return this.http.delete<void>(this.url(`/options/values/${id}`));
  }

  reorderKeyStores(payload: ReorderKeyStoresRequest): Observable<void> {
    return this.http.put<void>(this.url('/options/values/reorder'), payload);
  }

  assets(): Observable<Asset[]> {
    return this.http.get<Asset[]>(this.url('/assets'));
  }

  supportTickets(employeeId?: string): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.url('/support'), { params: toParams({ employeeId }) });
  }

  createSupportTicket(payload: any): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(this.url('/support'), payload);
  }

  updateSupportTicket(id: string, payload: any): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(this.url(`/support/${id}`), payload);
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }
}

function toParams(values: Query): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}
