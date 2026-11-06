/** Types mirroring the .NET HRMS API DTOs (camelCase JSON, string enums). */

export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  role: string;
  roleCode: string;
  employeeId?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyCode?: string | null;
  companyLogoUrl?: string | null;
}

export interface TenantBrandingResponse {
  companyName: string;
  companyCode: string;
  logoUrl?: string | null;
}

export interface CompanyLogoResponse {
  logoUrl: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: ApiUser;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  grade: string;
  status: string;
  joinDate: string;
  salary: number;
  currency: string;
  jobTitle: string;
  isFaceEnrolled?: boolean;
  facePhotoUrl?: string | null;
}

export interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender: string;
  maritalStatus: string;
  bloodGroup?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  departmentId: string;
  department: string;
  designationId?: string | null;
  designation?: string | null;
  branchId?: string | null;
  branch?: string | null;
  reportingManager?: string | null;
  jobTitle: string;
  grade: string;
  employmentType: string;
  status: string;
  joinDate: string;
  noticePeriodDays: number;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  mobileAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  currency: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  ifscCode?: string | null;
  swiftCode?: string | null;
  paymentMode: string;
  wpsId?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  visaNumber?: string | null;
  visaExpiry?: string | null;
  emiratesId?: string | null;
  roleCode?: string | null;
  roleName?: string | null;
  isFaceEnrolled?: boolean;
  facePhotoUrl?: string | null;
}

export interface LeaveType {
  id: string;
  name: string;
  maxDaysPerYear: number;
  isPaid: boolean;
  color: string;
  description?: string | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: string;
  submittedAtUtc: string;
  submittedLabel: string;
}

export interface LeaveBalance {
  type: string;
  balance: number;
  total: number;
  used: number;
  color: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  breakMinutes: number;
  workHours: number;
  status: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  onLeave: number;
}

export interface MonthlyMusterDay {
  date: string;
  dayLabel: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours: number;
  status: string;
}

export interface Regularization {
  id: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  date: string;
  inTime: string;
  outTime: string;
  status: string;
  submittedLabel: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  payDate: string;
  status: string;
  employeeCount: number;
  totalGross: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNet: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  workingDays: number;
  status: string;
  payDate: string;
}

export interface PayrollSummary {
  grossPayroll: number;
  totalAllowances: number;
  totalDeductions: number;
  netPayable: number;
  employeeCount: number;
}

export interface Loan {
  id: string;
  employeeId: string;
  employeeName: string;
  loanType: string;
  amount: number;
  emi: number;
  paidAmount: number;
  balance: number;
  tenureMonths: number;
  status: string;
  reason?: string | null;
  requestedAtUtc: string;
}

export interface LoanSummary {
  totalDisbursed: number;
  outstanding: number;
  activeLoans: number;
  pendingApproval: number;
}

export interface DocumentDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  name: string;
  type: string;
  documentNumber?: string | null;
  issuedBy?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  daysLeft?: number | null;
  status: string;
  notes?: string | null;
  fileSize?: string | null;
  fileUrl?: string | null;
  isCompanyDocument: boolean;
}

export interface DocumentSummary {
  total: number;
  expiringSoon: number;
  expired: number;
  valid: number;
}

export interface Approval {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  type: string;
  title: string;
  details: string;
  submittedAtUtc: string;
  submittedLabel: string;
  priority: string;
  status: string;
}

export interface ApprovalSummary {
  totalPending: number;
  leaveRequests: number;
  overtime: number;
  regularization: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  tag: string;
  severity: string;
  publishedAtUtc: string;
  publishedLabel: string;
  isActive: boolean;
}

export interface NotificationItem {
  id: string;
  iconKey: string;
  title: string;
  message: string;
  timeLabel: string;
  isRead: boolean;
}

export interface DashboardStats {
  totalEmployees: number;
  attendanceRate: number;
  pendingApprovals: number;
  monthlyPayroll: number;
  departments: number;
  newJoinersThisMonth: number;
  onLeaveToday: number;
  resignations: number;
}

export interface DepartmentHeadcount {
  department: string;
  count: number;
}

export interface AttendanceTrendPoint {
  label: string;
  present: number;
  absent: number;
  late: number;
}

export interface Activity {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  action: string;
  dateLabel: string;
  status: string;
}

export interface ExpoAlert {
  employeeName: string;
  document: string;
  expiryLabel: string;
  daysLeft: number;
  status: string;
}

export interface PendingApproval {
  id: string;
  employeeName: string;
  type: string;
  detail: string;
  priority: string;
}

export interface RecentLeave {
  id: string;
  employeeName: string;
  leaveType: string;
  dateLabel: string;
  status: string;
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  employeeCount: number;
}

export interface CompanySettings {
  companyName: string;
  tradeLicense?: string | null;
  trn?: string | null;
  industry?: string | null;
  foundedYear?: number | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  hrEmail: string;
  payrollCurrency?: string | null;
  logoUrl?: string | null;
  timeZone?: string | null;
  taxNumberLabel?: string | null;
  registrationNumberLabel?: string | null;
}

export interface SaveCompanySettingsRequest {
  companyName: string;
  hrEmail: string;
  timeZone: string;
  tradeLicense?: string | null;
  trn?: string | null;
  industry?: string | null;
  foundedYear?: number | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  payrollCurrency?: string | null;
  logoUrl?: string | null;
  taxNumberLabel?: string | null;
  registrationNumberLabel?: string | null;
}

export interface TaskItem {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string | null;
  dueDate: string;
  dueLabel: string;
  status: string;
  priority: string;
  assignedBy?: string | null;
}

export interface PerformanceMetric {
  name: string;
  score: number;
}

export interface PerformanceFeedback {
  fromName: string;
  fromRole: string;
  message: string;
  dateLabel: string;
  rating: number;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  overallRating: number;
  goalsAchieved: number;
  goalsTotal: number;
  feedbackScore: number;
  rank: string;
  metrics: PerformanceMetric[];
  feedbacks: PerformanceFeedback[];
}

export interface ErpIntegration {
  id: string;
  name: string;
  description: string;
  status: string;
  lastSyncLabel: string;
  iconKey: string;
}

export interface ErpSyncLog {
  id: string;
  message: string;
  timeLabel: string;
  success: boolean;
}

export interface ErpOverview {
  connectedSystems: number;
  lastSyncLabel: string;
  syncErrors: number;
  recordsSynced: number;
  integrations: ErpIntegration[];
  logs: ErpSyncLog[];
}

export interface NotificationPreference {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface EmployeeDashboard {
  employeeId: string;
  fullName: string;
  initials: string;
  jobTitle: string;
  department: string;
  status: string;
  dateLabel: string;
  checkInLabel: string;
  attendanceSummary: AttendanceSummary;
  leaveBalances: LeaveBalance[];
  recentLeaves: RecentLeave[];
  announcements: Announcement[];
  upcomingHolidays: HolidayDto[];
  activity: Activity[];
  attendanceTrend: AttendanceTrendPoint[];
  workingHoursThisWeek: number;
}

export interface PayrollReportRow {
  month: string;
  employees: number;
  gross: number;
  allowances: number;
  deductions: number;
  net: number;
  status: string;
}

export interface AttendanceReportRow {
  employee: string;
  department: string;
  present: number;
  absent: number;
  late: number;
  averageHours: number;
  rating: string;
}

export interface LeaveReportRow {
  employee: string;
  annualUsed: number;
  sickUsed: number;
  emergencyUsed: number;
  unpaidUsed: number;
  balance: number;
}

export interface OvertimeReportRow {
  employee: string;
  hours: number;
  rate: string;
  amount: number;
  status: string;
}

export interface DesignationDto {
  id: string;
  name: string;
  grade?: string;
  departmentId?: string | null;
  department?: string | null;
  description?: string | null;
  employeeCount?: number;
}

export interface CompanyItemDto {
  id: string;
  name: string;
  code: string;
  brandName?: string;
  proprietor?: string;
  companyLogo?: string;
  contactEmail?: string;
  contactNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  timeZone?: string;
  registrationNumber?: string;
}

export interface BranchDto {
  id: string;
  name: string;
  location: string;
  managerName: string;
  employeeCount: number;
  isActive: boolean;
}

export interface HolidayDto {
  id: string;
  name: string;
  date: string;
  dayLabel: string;
  type: string;
}

export interface ShiftDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  dailyHours: number;
  workingDays: string;
}

export interface EmployeePunch {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  punchTime: string;
  punchType: string;
  note?: string | null;
  device?: string | null;
}

export interface EmployeePunchStatus {
  isCheckedIn: boolean;
  lastPunchTimeUtc?: string | null;
  serverTimeUtc: string;
  companyTimeZone: string;
  firstCheckInTime?: string | null;
  workedHoursToday: number;
  workedSecondsToday: number;
  currentCheckInTimeUtc?: string | null;
  todayPunches: EmployeePunch[];
  hasForgottenCheckOut: boolean;
  forgottenCheckOutDate?: string | null;
  regularizationMessage?: string | null;
}

export interface EnrolledFace {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  avatarUrl?: string | null;
  faceDescriptor: string;
  enrolledAtUtc?: string | null;
}

export interface EnrollFaceRequest {
  faceDescriptor: string;
  facePhotoUrl?: string | null;
}

export interface FacePunchRequest {
  employeeCode?: string | null;
  employeeId?: string | null;
  punchType?: string | null;
  confidence?: number | null;
  device?: string | null;
  snapshotBase64?: string | null;
}

export interface FacePunchResult {
  success: boolean;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  punchType: string;
  punchTime: string;
  status: string;
  message: string;
}

export interface AttendancePerson {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation?: string | null;
  checkInTime?: string | null;
  leaveReason?: string | null;
}

export interface TodayAttendanceOverview {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  onLeaveCount: number;
  lateCount: number;
  present: AttendancePerson[];
  absent: AttendancePerson[];
  onLeave: AttendancePerson[];
  late: AttendancePerson[];
}

export interface NoticeBoardItem {
  id: string;
  title: string;
  message: string;
  tag: string;
  severity: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  publishedAtUtc: string;
}

export interface CelebrationItem {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  type: string;
  dateLabel: string;
  avatarUrl?: string | null;
}

export interface DashboardTemplateData {
  todayAttendance: TodayAttendanceOverview;
  notices: NoticeBoardItem[];
  celebrations: CelebrationItem[];
  upcomingHolidays: HolidayDto[];
  myTasks: TaskItem[];
  pendingApprovals: PendingApproval[];
  attendanceGraph: AttendanceTrendPoint[];
  todayPunches: EmployeePunch[];
  leaveBalances: LeaveBalance[];
}

export interface ShiftdayDto {
  id: string;
  shiftTemplateId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isWeekOff: boolean;
  breakMinutes: number;
}

export interface ShiftTemplateDto {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  gracePeriodMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  isDefault: boolean;
  isNightShift: boolean;
  shiftdays: ShiftdayDto[];
}

export interface ShiftAssignmentDto {
  id: string;
  shiftTemplateId: string;
  shiftName: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
}

export interface RosterCell {
  date: string;
  status: string;
  shiftName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isWeekOff: boolean;
  isHoliday: boolean;
}

export interface RosterRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  days: RosterCell[];
}

export interface RosterMatrix {
  startDate: string;
  endDate: string;
  dates: string[];
  rows: RosterRow[];
}

export interface NavigationItem {
  id: string;
  title: string;
  route: string;
  icon: string;
  parentId?: string | null;
  orderIndex: number;
  badge?: string | null;
  children: NavigationItem[];
}

export interface RoleNavigation {
  id: string;
  roleId: string;
  roleName: string;
  navigationItemId: string;
  navigationTitle: string;
  navigationRoute: string;
  isFull: boolean;
  isView: boolean;
  isCreate: boolean;
  isEdit: boolean;
  isDelete: boolean;
}

export interface KeyStore {
  id: string;
  keyGroupId: string;
  key: string;
  value: string;
  subValue?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export type KeyStoreItem = KeyStore;

export interface KeyGroup {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  items: KeyStore[];
  isGeneric: boolean;
  isEnumLocked?: boolean;
}

export type KeyGroupItem = KeyGroup;

export interface Asset {
  id: string;
  assetTypeId: string;
  assetTypeName: string;
  assetCode: string;
  name: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  warrantyExpiryDate?: string | null;
  status: string;
  cost?: number | null;
  assignedToEmployeeName?: string | null;
  assignedToEmployeeId?: string | null;
}

export interface SupportTicket {
  id: string;
  supportTypeId: string;
  supportTypeName: string;
  employeeId: string;
  employeeName: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  submittedAtUtc: string;
  resolvedAtUtc?: string | null;
  resolutionNotes?: string | null;
}

// ── Multi-tenant company management (Super Admin) ──

export interface ProvisioningLog {
  step: string;
  succeeded: boolean;
  message?: string | null;
  occurredAtUtc: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  code: string;
  databaseName?: string | null;
  status: string;
  isDefault: boolean;
  adminFullName: string;
  adminEmail: string;
  contactName?: string | null;
  contactEmail?: string | null;
  timeZone?: string | null;
  createdAtUtc: string;
  provisionedAtUtc?: string | null;
  provisioningError?: string | null;
  invitationStatus: string;
  invitationSentAtUtc?: string | null;
  invitationError?: string | null;
}

export interface CompanyDetail extends CompanyListItem {
  suspendedAtUtc?: string | null;
  invitationEmail?: string | null;
  invitationAcceptedAtUtc?: string | null;
  provisioningLogs: ProvisioningLog[];
}

export interface CreateCompanyRequest {
  name: string;
  code?: string | null;
  adminFullName: string;
  adminEmail: string;
  contactName?: string | null;
  contactEmail?: string | null;
  timeZone?: string | null;
}

export interface UpdateCompanyRequest {
  name?: string | null;
  adminFullName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  timeZone?: string | null;
}

export interface CompanyProvisioningResult {
  companyId: string;
  status: string;
  databaseName?: string | null;
  databaseReady: boolean;
  adminCreated: boolean;
  invitationStatus: string;
  activationUrl?: string | null;
  error?: string | null;
}

export interface ResendInvitationResult {
  invitationStatus: string;
  activationUrl?: string | null;
  error?: string | null;
}

export interface ActivationInfo {
  valid: boolean;
  companyName?: string | null;
  companyCode?: string | null;
  adminEmail?: string | null;
  reason?: string | null;
}

export interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  userCount: number;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateRoleRequest {
  code: string;
  name: string;
  description?: string | null;
}

export interface NavigationItem {
  id: string;
  title: string;
  route: string;
  icon: string;
  parentId?: string | null;
  orderIndex: number;
  badge?: string | null;
  children: NavigationItem[];
  code?: string;
  isActive?: boolean;
}

export interface SaveNavigationItemRequest {
  id?: string | null;
  code: string;
  title: string;
  route: string;
  icon?: string | null;
  parentId?: string | null;
  orderIndex: number;
  badge?: string | null;
  isActive: boolean;
}

export interface ReorderNavigationItemRequest {
  id: string;
  orderIndex: number;
  parentId?: string | null;
}

export interface ReorderNavigationBatchRequest {
  items: ReorderNavigationItemRequest[];
}

export interface RoleNavigationPermission {
  id: string;
  roleId: string;
  roleName: string;
  navigationItemId: string;
  navigationTitle: string;
  navigationRoute: string;
  isFull: boolean;
  isView: boolean;
  isCreate: boolean;
  isEdit: boolean;
  isDelete: boolean;
}

export interface SaveRolePermissionItem {
  navigationItemId: string;
  isFull: boolean;
  isView: boolean;
  isCreate: boolean;
  isEdit: boolean;
  isDelete: boolean;
}

export interface SaveRolePermissionsRequest {
  roleId: string;
  permissions: SaveRolePermissionItem[];
}

export interface SaveKeyStoreRequest {
  id?: string | null;
  keyGroupId: string;
  key: string;
  value: string;
  subValue?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface SaveKeyGroupRequest {
  id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isGeneric: boolean;
  items?: SaveKeyStoreRequest[] | null;
}

export interface ReorderKeyStoresRequest {
  keyGroupId: string;
  storeIds: string[];
}

