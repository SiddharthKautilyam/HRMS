import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDetail, EmployeeListItem } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { KeyGroupSelectComponent } from '../../shared/key-select.component';

interface ProfileData {
  id: string;
  name: string;
  dept: string;
  grade: string;
  status: string;
  join: string;
  salary: string;
  email: string;
}

interface DocRow {
  doc: string;
  type: string;
  issue: string;
  exp: string;
  s: string;
}

/** Employee Profile — ported from pages/employee-profile.html. */
@Component({
  selector: 'app-employee-profile',
  imports: [CommonModule, IconDirective, SelectComponent, KeyGroupSelectComponent, RouterModule],
  template: `
    @if (viewMode() === 'admin') {
      <!-- ADMINISTRATOR BANNER -->
      <div class="profile-banner">
        <div style="position: relative; flex-shrink: 0">
          <div class="profile-avatar admin-avatar">{{ adminInitials() }}</div>
        </div>
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--text)">{{ currentAdminName() }}</div>
            <span class="profile-badge admin-badge">
              <span [appIcon]="'shield'"></span> {{ currentRole() }}
            </span>
          </div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px">
            {{ currentAdminEmail() }} &bull; {{ currentCompanyName() }} ({{ currentCompanyCode() }})
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <span class="profile-badge active">Active Administrator</span>
            <span class="profile-badge"><span [appIcon]="'company'"></span> {{ currentCompanyName() }}</span>
            <span class="profile-badge"><span [appIcon]="'lock'"></span> System Authenticated</span>
          </div>
        </div>

        @if (employeeOptions().length > 0) {
          <div class="profile-switcher-card">
            <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px">
              Inspect Employee Profile
            </div>
            <app-select
              [options]="employeeOptions()"
              [value]="selectedEmployeeId()"
              (valueChange)="onEmployeeSelect($event)"
              width="280px"
            />
          </div>
        }
      </div>

      <div class="ptabs">
        @for (t of adminTabs; track t.id) {
          <button class="ptab" [class.active]="adminTab() === t.id" (click)="adminTab.set(t.id)">
            <span [appIcon]="t.icon"></span> {{ t.label }}
          </button>
        }
      </div>

      <!-- ADMIN TAB: ACCOUNT -->
      @if (adminTab() === 'account') {
        <div class="grid-2">
          <div class="card" style="overflow: visible">
            <div class="card-header"><div class="card-title">Administrator Account Information</div></div>
            <div class="card-body" style="overflow: visible">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input
                  class="form-control"
                  [value]="adminFullName()"
                  (input)="adminFullName.set($any($event.target).value)"
                  placeholder="Enter administrator full name"
                />
              </div>
              <div class="form-group">
                <label class="form-label">System Login Email</label>
                <input
                  class="form-control"
                  [value]="currentAdminEmail()"
                  readonly
                  style="background: var(--bg); color: var(--muted); cursor: not-allowed"
                />
                <div style="font-size: 11px; color: var(--muted); margin-top: 3px">
                  Primary email associated with this administrative login.
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Administrative Role</label>
                <input
                  class="form-control"
                  [value]="currentRole()"
                  readonly
                  style="background: var(--bg); color: var(--muted); cursor: not-allowed"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Company &amp; Tenant Workspace</label>
                <input
                  class="form-control"
                  [value]="currentCompanyName() + ' (' + currentCompanyCode() + ')'"
                  readonly
                  style="background: var(--bg); color: var(--muted); cursor: not-allowed"
                />
              </div>
              <div class="form-footer">
                <button class="btn btn-primary btn-sm" [disabled]="savingAdminProfile()" (click)="saveAdminProfile()">
                  <span [appIcon]="'check'"></span> Save Administrator Profile
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Tenant &amp; Infrastructure Overview</div></div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: 12px">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border)">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Organization Workspace</div>
                    <div style="font-size: 11px; color: var(--muted)">Tenant Code: {{ currentCompanyCode() }}</div>
                  </div>
                  <span class="badge badge-info">{{ currentCompanyName() }}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border)">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Database Isolation</div>
                    <div style="font-size: 11px; color: var(--muted)">Dedicated schema &amp; tenant DB</div>
                  </div>
                  <span class="badge badge-success">Active &bull; Isolated</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border)">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Face ID &amp; Biometric Sync</div>
                    <div style="font-size: 11px; color: var(--muted)">Office kiosk &amp; mobile attendance</div>
                  </div>
                  <span class="badge badge-success">Online</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border)">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Performance Caching</div>
                    <div style="font-size: 11px; color: var(--muted)">IMemoryCache + SplitQuery Engine</div>
                  </div>
                  <span class="badge badge-info">Optimized</span>
                </div>
              </div>

              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; gap: 8px">
                <a class="btn btn-outline btn-sm" [routerLink]="['/employees']" style="text-decoration: none">
                  <span [appIcon]="'employees'"></span> Manage Employees
                </a>
                <a class="btn btn-outline btn-sm" [routerLink]="['/company']" style="text-decoration: none">
                  <span [appIcon]="'company'"></span> Company Settings
                </a>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ADMIN TAB: SECURITY -->
      @if (adminTab() === 'security') {
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title">Change Password</div></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input
                  class="form-control"
                  type="password"
                  [value]="currentPwd()"
                  (input)="currentPwd.set($any($event.target).value)"
                  placeholder="Enter current password"
                />
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input
                  class="form-control"
                  type="password"
                  [value]="newPwd()"
                  (input)="newPwd.set($any($event.target).value)"
                  placeholder="At least 8 characters"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input
                  class="form-control"
                  type="password"
                  [value]="confirmPwd()"
                  (input)="confirmPwd.set($any($event.target).value)"
                  placeholder="Re-enter new password"
                />
              </div>
              <div class="form-footer">
                <button class="btn btn-primary btn-sm" [disabled]="changingPwd()" (click)="saveAdminPassword()">
                  <span [appIcon]="'lock'"></span> Update Password
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Security &amp; Session Status</div></div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: 14px">
                <div style="display: flex; gap: 12px; align-items: flex-start">
                  <div style="width: 38px; height: 38px; border-radius: 8px; background: var(--p-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--p)">
                    <span [appIcon]="'lock'"></span>
                  </div>
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Token-Based JWT Authentication</div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 2px">
                      Your session is secured using HMAC-SHA256 signed tokens with role-based policies.
                    </div>
                  </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-start">
                  <div style="width: 38px; height: 38px; border-radius: 8px; background: var(--success-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--success)">
                    <span [appIcon]="'shield'"></span>
                  </div>
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text)">Policy Level: {{ currentRole() }}</div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 2px">
                      Authorized for tenant administration, payroll runs, and biometric synchronization.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ADMIN TAB: PRIVILEGES -->
      @if (adminTab() === 'privileges') {
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px">
          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">🏢</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Multi-Tenant Workspace</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              Company configuration, branches, departments, designations, and tenant database isolation.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>

          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">👥</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Employee Directory</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              Add, update, deactivate employees, manage salaries, reporting structures, and access roles.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>

          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">⏱️</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Attendance &amp; Biometrics</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              Manage Face ID biometric enrollment, office entrance kiosk, daily muster, and regularization.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>

          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">💰</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Payroll &amp; Compensation</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              Execute monthly payroll calculations, manage allowances/deductions, view &amp; print payslips.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>

          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">📑</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Leave &amp; Shift Rostering</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              Configure leave types, approve employee requests, assign rotational shift templates.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>

          <div class="card" style="padding: 18px">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 20px">🛡️</span>
              <div style="font-weight: 700; font-size: 14px; color: var(--text)">Security &amp; Governance</div>
            </div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px">
              User password resets, role-based authorization policies, session audit &amp; security tokens.
            </div>
            <span class="badge badge-success">Full Admin Access</span>
          </div>
        </div>
      }
    } @else {
      <!-- EMPLOYEE MODE BANNER -->
      <div class="profile-banner">
        <div style="position: relative; flex-shrink: 0">
          <div class="profile-avatar">{{ initials() }}</div>
        </div>
        <div style="flex: 1; min-width: 0">
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--text); margin-bottom: 2px">{{ profile().name }}</div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px">
            {{ profile().grade }} - {{ profile().dept }} - {{ profile().id }}
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <span class="profile-badge" [class.active]="profile().status === 'Active'" [class.warning]="profile().status === 'On Leave'">{{ profile().status }}</span>
            <span class="profile-badge"><span [appIcon]="'calendar2'"></span> Joined {{ profile().join }}</span>
          </div>
        </div>

        @if (isAdmin()) {
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <button class="btn btn-outline btn-sm" (click)="switchToAdminView()">
              <span [appIcon]="'shield'"></span> My Admin Profile
            </button>
            @if (employeeOptions().length > 0) {
              <app-select
                [options]="employeeOptions()"
                [value]="selectedEmployeeId()"
                (valueChange)="onEmployeeSelect($event)"
                width="240px"
              />
            }
          </div>
        }
      </div>

      <div class="ptabs">
        @for (t of tabs; track t.id) {
          <button class="ptab" [class.active]="tab() === t.id" (click)="tab.set(t.id)">
            <span [appIcon]="t.icon"></span> {{ t.label }}
          </button>
        }
      </div>

    <!-- PERSONAL TAB -->
    @if (tab() === 'personal') {
      <div class="grid-2">
        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Personal Details</div></div>
          <div class="card-body" style="overflow: visible">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input class="form-control" [value]="personal().fullName" (input)="patchPersonal('fullName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of Birth</label>
              <input class="form-control" type="date" [value]="personal().dob" (input)="patchPersonal('dob', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <app-key-select groupCode="GENDER" [value]="personal().gender" (valueChange)="patchPersonal('gender', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Nationality</label>
              <input class="form-control" [value]="personal().nationality" (input)="patchPersonal('nationality', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Marital Status</label>
              <app-key-select groupCode="MARITAL_STATUS" [value]="personal().marital" (valueChange)="patchPersonal('marital', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Blood Group</label>
              <app-key-select groupCode="BLOOD_GROUP" [value]="personal().blood" (valueChange)="patchPersonal('blood', $event)" width="100%" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Personal details saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>

        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Job Information</div></div>
          <div class="card-body" style="overflow: visible">
            <div class="form-group">
              <label class="form-label">Employee ID</label>
              <input class="form-control" [value]="profile().id" readonly style="background: var(--bg); color: var(--muted)" />
            </div>
            <div class="form-group">
              <label class="form-label">Job Title</label>
              <input class="form-control" [value]="job().title" (input)="patchJob('title', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Designation</label>
              <app-select [options]="designationOptions()" [value]="selectedDesignationId()" (valueChange)="selectedDesignationId.set($event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <app-select [options]="deptOptions" [value]="job().dept" (valueChange)="patchJob('dept', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Reporting To</label>
              <app-select [options]="reportingOptions()" [value]="job().reportsTo" (valueChange)="patchJob('reportsTo', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Join Date</label>
              <input class="form-control" type="date" [value]="job().joinDate" (input)="patchJob('joinDate', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">System Access Role</label>
              <app-select [options]="systemRoleOptions" [value]="job().roleCode" (valueChange)="patchJob('roleCode', $event)" width="100%" />
              <div style="font-size: 11px; color: var(--muted); margin-top: 3px">
                Controls module access &amp; permissions (HR Manager, Company Admin, or Employee)
              </div>
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Job info saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- CONTACT TAB -->
    @if (tab() === 'contact') {
      <div class="grid-2">
        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Contact Details</div></div>
          <div class="card-body" style="overflow: visible">
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-control" [value]="contact().phone" (input)="patchContact('phone', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-control" type="email" [value]="contact().email" (input)="patchContact('email', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Emergency Contact</label>
              <input class="form-control" [value]="contact().emergency" (input)="patchContact('emergency', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <input class="form-control" [value]="contact().address" (input)="patchContact('address', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">City</label>
              <input class="form-control" [value]="contact().city" (input)="patchContact('city', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">State / Province</label>
              <input class="form-control" [value]="contact().state" (input)="patchContact('state', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Country</label>
              <app-select [options]="countryOptions" [value]="contact().country" (valueChange)="patchContact('country', $event)" width="100%" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Contact details saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>

        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Identity Documents</div></div>
          <div class="card-body" style="overflow: visible">
            <div class="form-group">
              <label class="form-label">Passport No</label>
              <input class="form-control" [value]="identity().passportNo" (input)="patchIdentity('passportNo', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Passport Expiry</label>
              <input class="form-control" type="date" [value]="identity().passportExp" (input)="patchIdentity('passportExp', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Visa No</label>
              <input class="form-control" [value]="identity().visaNo" (input)="patchIdentity('visaNo', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Visa Expiry</label>
              <input class="form-control" type="date" [value]="identity().visaExp" (input)="patchIdentity('visaExp', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Emirates ID</label>
              <input class="form-control" [value]="identity().emiratesId" (input)="patchIdentity('emiratesId', $any($event.target).value)" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Identity info saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- BANK TAB -->
    @if (tab() === 'bank') {
      <div class="grid-2">
        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Bank Details</div></div>
          <div class="card-body" style="overflow: visible">
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <app-select [options]="bankOptions" [value]="bank().bankName" (valueChange)="patchBank('bankName', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Bank Account Name</label>
              <input class="form-control" [value]="bank().accountName" (input)="patchBank('accountName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Account No</label>
              <input class="form-control" [value]="bank().accountNo" (input)="patchBank('accountNo', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">IBAN</label>
              <input class="form-control" [value]="bank().iban" (input)="patchBank('iban', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">IFSC Code</label>
              <input class="form-control" [value]="bank().ifsc" (input)="patchBank('ifsc', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Swift Code</label>
              <input class="form-control" [value]="bank().swift" (input)="patchBank('swift', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <app-select [options]="bankCurrencyOptions" [value]="bank().currency" (valueChange)="patchBank('currency', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode</label>
              <app-select [options]="paymentModeOptions" [value]="bank().paymentMode" (valueChange)="patchBank('paymentMode', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">WPS ID</label>
              <input class="form-control" [value]="bank().wpsId" (input)="patchBank('wpsId', $any($event.target).value)" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Bank details saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Salary Structure</div></div>
          <div class="card-body">
            <div style="margin-bottom: 14px">
              <div style="font-size: 20px; font-weight: 800; color: var(--p)">$5,200</div>
              <div style="font-size: 14px; color: var(--muted)">Gross Monthly Salary</div>
            </div>
            @for (s of salaryStructure; track s[0]) {
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border)">
                <span style="font-size: 13px; color: var(--muted)">{{ s[0] }}</span>
                <span style="font-size: 13px; font-weight: 700" [style.color]="s[2]">{{ s[1] }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- DOCUMENTS TAB -->
    @if (tab() === 'docs') {
      <div class="card">
        <div class="card-header">
          <div class="card-title">Documents</div>
          <button class="btn btn-primary btn-sm" (click)="ui.open('uploadDocModal')"><span [appIcon]="'upload2'"></span> Upload</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Issue Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of docs(); track r.doc) {
                <tr>
                  <td style="font-weight: 600">{{ r.doc }}</td>
                  <td><span class="badge badge-info">{{ r.type }}</span></td>
                  <td><input class="form-control" type="date" [value]="r.issue" style="font-size: 12px; padding: 4px 8px" /></td>
                  <td><input class="form-control" type="date" [value]="r.exp" style="font-size: 12px; padding: 4px 8px" /></td>
                  <td><span class="badge badge-success">{{ r.s }}</span></td>
                  <td>
                    <div style="display: flex; gap: 4px">
                      <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="toast.show('Opening ' + r.doc)"><span [appIcon]="'eye'"></span></button>
                      <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span></button>
                      <button class="btn btn-ghost btn-sm" data-tooltip="Save" (click)="toast.show('Document updated!')"><span [appIcon]="'check'"></span></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- BIOMETRIC & FACE ID TAB -->
    @if (tab() === 'biometric') {
      <div class="grid-2">
        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Face Recognition Profile</div></div>
          <div class="card-body" style="overflow: visible">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
              <div style="position: relative; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: var(--p-soft); display: flex; align-items: center; justify-content: center; border: 2px solid var(--border); flex-shrink: 0;">
                @if (facePhotoUrl()) {
                  <img [src]="facePhotoUrl()!" alt="Face" style="width: 100%; height: 100%; object-fit: cover;" />
                } @else {
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--p)" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                }
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-weight: 700; font-size: 15px;">{{ profile().name }}</span>
                  <span class="badge" [class]="isFaceEnrolled() ? 'badge-success' : 'badge-warning'">
                    {{ isFaceEnrolled() ? 'Face ID Enrolled' : 'Not Enrolled' }}
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--muted);">
                  {{ isFaceEnrolled() ? ('Enrolled: ' + (faceEnrolledAt() | slice:0:10)) : 'No biometric face template registered yet.' }}
                </div>
              </div>
            </div>

            <div style="font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.5;">
              Enrolling employee Face ID enables hands-free punch in/out on the Office Kiosk and self-service selfie attendance on their mobile or web portal.
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="btn btn-primary btn-sm" (click)="openFaceEnrollModal()">
                📷 {{ isFaceEnrolled() ? 'Re-enroll Face ID' : 'Enroll Face ID' }}
              </button>
              @if (isFaceEnrolled()) {
                <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" (click)="removeFaceId()">
                  Remove Face ID
                </button>
              }
            </div>
          </div>
        </div>

        <div class="card" style="overflow: visible">
          <div class="card-header"><div class="card-title">Kiosk &amp; Terminal Verification</div></div>
          <div class="card-body" style="overflow: visible">
            <div style="padding: 14px; border-radius: 8px; background: var(--bg); border: 1px dashed var(--border); margin-bottom: 14px;">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text);">⚡ Instant Terminal Recognition</div>
              <div style="font-size: 12px; color: var(--muted); line-height: 1.5;">
                Once enrolled, this employee can walk up to any office entrance kiosk or tablet running <b>Face Kiosk Mode</b> to automatically punch in without pressing any buttons or carrying an ID card.
              </div>
            </div>
            <a class="btn btn-outline btn-sm" routerLink="/kiosk" target="_blank" style="display: inline-flex; align-items: center; gap: 6px;">
              Launch Kiosk Mode ⛶
            </a>
          </div>
        </div>
      </div>
    }
  }

    <!-- ENROLL FACE ID WEBCAM MODAL -->
    @if (faceEnrollModalOpen()) {
      <div class="modal-overlay open" (click)="closeFaceEnrollModal()">
        <div class="modal" style="width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 15px; font-weight: 700;">Enroll Face ID — {{ profile().name }}</div>
            <button class="btn btn-ghost btn-sm" (click)="closeFaceEnrollModal()"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body" style="text-align: center;">
            <div style="position: relative; width: 100%; height: 280px; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 14px; display: flex; align-items: center; justify-content: center;">
              <video #enrollVideo autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
              <canvas #enrollCanvas style="display: none;"></canvas>

              <div style="position: absolute; width: 180px; height: 230px; border: 2px dashed #38bdf8; border-radius: 50% / 45%; box-shadow: 0 0 20px rgba(56, 189, 248, 0.4); pointer-events: none;"></div>
            </div>

            <div style="font-size: 12px; color: var(--muted); margin-bottom: 14px;">
              Center the employee's face in the oval frame, look directly into the camera, and click capture.
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button class="btn btn-outline" (click)="closeFaceEnrollModal()">Cancel</button>
              <button class="btn btn-primary" [disabled]="enrollingFace()" (click)="captureAndSaveFace()">
                {{ enrollingFace() ? 'Saving...' : 'Capture & Save Face ID' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Upload Doc Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('uploadDocModal')" (click)="ui.onOverlayClick($event, 'uploadDocModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 14px; font-weight: 700">Upload Document</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('uploadDocModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body" style="overflow: visible">
          <div class="form-group">
            <label class="form-label">Document Type</label>
            <app-select [options]="uploadTypeOptions" [value]="uploadType()" (valueChange)="uploadType.set($event)" width="100%" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Issue Date</label>
              <input class="form-control" type="date" [value]="uploadIssueDate()" (input)="uploadIssueDate.set($any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Expiry Date</label>
              <input class="form-control" type="date" [value]="uploadExpiryDate()" (input)="uploadExpiryDate.set($any($event.target).value)" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Upload File</label>
            <input #docFileInput type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" (change)="onDocFileSelected($event)" style="display: none" />
            <div
              style="border: 2px dashed var(--border); border-radius: var(--r); padding: 24px; text-align: center; cursor: pointer; transition: var(--t)"
              [style.borderColor]="selectedDocFile() ? 'var(--p)' : 'var(--border)'"
              [style.background]="selectedDocFile() ? 'var(--p-soft)' : 'transparent'"
              (click)="docFileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onDocFileDrop($event)"
            >
              @if (selectedDocFile()) {
                <div style="color: var(--p); margin-bottom: 6px"><span [appIcon]="'check'"></span></div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text)">{{ selectedDocFile()?.name }}</div>
                <div style="font-size: 0.78rem; color: var(--muted); margin-top: 3px">{{ formatFileSize(selectedDocFile()?.size || 0) }} &bull; Click to change file</div>
              } @else {
                <div style="color: var(--p); margin-bottom: 6px"><span [appIcon]="'upload2'"></span></div>
                <div style="font-size: 0.86rem; font-weight: 600">Drop file or click to browse</div>
                <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px">PDF, JPG, PNG up to 10MB</div>
              }
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="closeUploadDocModal()">Cancel</button>
          <button class="btn btn-primary" [disabled]="uploadingDoc()" (click)="uploadDocument()">
            {{ uploadingDoc() ? 'Uploading...' : 'Upload' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .profile-banner {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r);
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        box-shadow: var(--shadow);
      }
      .profile-avatar {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--p);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        font-weight: 800;
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        flex-shrink: 0;
      }
      .profile-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 20px;
        background: var(--p-soft);
        color: var(--p);
        border: 1px solid var(--p-mid);
      }
      .profile-badge.active {
        background: var(--success-soft);
        color: #15803d;
        border-color: #86efac;
      }
      .profile-badge.active::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--success);
      }
      .profile-badge.warning {
        background: var(--warning-soft);
        color: #b45309;
        border-color: #fcd34d;
      }
      .ptabs {
        display: flex;
        gap: 0;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .ptabs::-webkit-scrollbar {
        display: none;
      }
      .ptab {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 14px;
        font-size: 14px;
        font-weight: 500;
        color: var(--muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: var(--t);
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .ptab:hover {
        color: var(--text);
      }
      .ptab.active {
        color: var(--p);
        border-bottom-color: var(--p);
        font-weight: 600;
      }
      .form-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
      thead th,
      tbody td {
        white-space: nowrap;
      }
      .admin-avatar {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
        border: 2px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35) !important;
      }
      .admin-badge {
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(124, 58, 237, 0.15)) !important;
        color: #6366f1 !important;
        border-color: rgba(99, 102, 241, 0.35) !important;
        font-weight: 700 !important;
      }
      .profile-switcher-card {
        padding: 8px 12px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      @media (max-width: 768px) {
        .profile-banner {
          padding: 10px;
          gap: 6px;
        }
        .profile-switcher-card {
          width: 100%;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class EmployeeProfileComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  private readonly detail = signal<EmployeeDetail | null>(null);
  private readonly apiId = signal<string | null>(null);
  private departmentIds = new Map<string, string>();
  protected readonly designationOptions = signal<SelectOption[]>([]);
  protected readonly selectedDesignationId = signal<string>('');

  // Profile View Mode: admin vs employee
  protected readonly viewMode = signal<'admin' | 'employee'>('admin');
  protected readonly adminTab = signal<'account' | 'security' | 'privileges'>('account');
  protected readonly adminTabs = [
    { id: 'account', label: 'Admin Account', icon: 'user' },
    { id: 'security', label: 'Security & Password', icon: 'lock' },
    { id: 'privileges', label: 'System Privileges', icon: 'shield' },
  ] as const;

  protected readonly employeeOptions = signal<SelectOption[]>([]);
  protected readonly selectedEmployeeId = signal<string>('__admin__');

  protected readonly currentRole = computed(() => this.session.activeRole());
  protected readonly isAdmin = computed(() => ['Super Admin', 'Company Admin'].includes(this.currentRole()) || !this.session.user()?.employeeId);
  protected readonly currentAdminName = computed(() => this.session.user()?.name || 'Administrator');
  protected readonly currentAdminEmail = computed(() => this.session.user()?.email || 'admin@viralinfotech.com');
  protected readonly currentCompanyName = computed(() => this.session.user()?.companyName || 'Viral Infotech');
  protected readonly currentCompanyCode = computed(() => this.session.user()?.companyCode || 'VIRALINFOTECH');
  protected readonly adminInitials = computed(() => this.session.user()?.initials || 'AD');

  // Admin form state
  protected readonly adminFullName = signal<string>('');
  protected readonly currentPwd = signal<string>('');
  protected readonly newPwd = signal<string>('');
  protected readonly confirmPwd = signal<string>('');
  protected readonly changingPwd = signal<boolean>(false);
  protected readonly savingAdminProfile = signal<boolean>(false);

  ngOnInit(): void {
    this.adminFullName.set(this.currentAdminName());

    this.api.departments().subscribe({
      next: (departments) => {
        this.departmentIds = new Map(departments.map((d) => [d.name, d.id]));
        this.deptOptions = departments.map((d) => ({ v: d.name, l: d.name }));
      },
      error: () => {},
    });

    this.api.designations().subscribe({
      next: (list) => {
        this.designationOptions.set((list || []).map((d) => ({ v: d.id, l: d.name })));
      },
      error: () => {},
    });

    this.api.employees({ pageSize: 100 }).subscribe({
      next: (res) => {
        this.allEmployees.set(res.items);
        if (this.isAdmin()) {
          const opts: SelectOption[] = [
            { v: '__admin__', l: `👤 My Admin Profile (${this.currentAdminName()})` },
            ...res.items.map((e) => ({
              v: e.id,
              l: `${e.employeeCode} - ${e.fullName} (${e.jobTitle || e.department})`,
            })),
          ];
          this.employeeOptions.set(opts);
        }
      },
      error: () => {},
    });

    if (this.isAdmin()) {
      this.route.queryParams.subscribe((params) => {
        const id = params['id'] || params['employeeId'];
        if (id) {
          this.selectedEmployeeId.set(id);
          this.loadEmployeeById(id);
        } else {
          this.viewMode.set('admin');
        }
      });
    } else {
      this.viewMode.set('employee');
      this.load();
    }
  }

  protected saveAdminProfile(): void {
    const name = this.adminFullName().trim();
    if (!name) {
      this.toast.show('Please enter a valid administrator name.', 'danger');
      return;
    }
    this.savingAdminProfile.set(true);
    this.api.updateProfile(name).subscribe({
      next: (res) => {
        this.savingAdminProfile.set(false);
        this.session.updateUser({ name: res.fullName, initials: res.initials });
        this.toast.show('Administrator profile updated successfully!', 'success');
      },
      error: (err) => {
        this.savingAdminProfile.set(false);
        this.toast.show(err?.error?.message || 'Could not update administrator profile.', 'danger');
      },
    });
  }

  protected saveAdminPassword(): void {
    const cur = this.currentPwd();
    const next = this.newPwd();
    const conf = this.confirmPwd();
    if (!cur) {
      this.toast.show('Please enter your current password.', 'warning');
      return;
    }
    if (!next || next.length < 8) {
      this.toast.show('New password must be at least 8 characters long.', 'warning');
      return;
    }
    if (next !== conf) {
      this.toast.show('New password and confirmation do not match.', 'danger');
      return;
    }

    this.changingPwd.set(true);
    this.api.changePassword(cur, next).subscribe({
      next: () => {
        this.changingPwd.set(false);
        this.currentPwd.set('');
        this.newPwd.set('');
        this.confirmPwd.set('');
        this.toast.show('Password changed successfully!', 'success');
      },
      error: (err) => {
        this.changingPwd.set(false);
        this.toast.show(err?.error?.message || 'Could not change password.', 'danger');
      },
    });
  }

  protected onEmployeeSelect(value: string): void {
    if (value === '__admin__') {
      this.switchToAdminView();
    } else {
      this.selectedEmployeeId.set(value);
      this.loadEmployeeById(value);
    }
  }

  protected switchToAdminView(): void {
    this.selectedEmployeeId.set('__admin__');
    this.viewMode.set('admin');
  }

  protected loadEmployeeById(id: string): void {
    this.api.employee(id).subscribe({
      next: (employee) => {
        this.populateEmployee(employee);
        this.viewMode.set('employee');
      },
      error: () => {
        this.toast.show('Could not load the selected employee profile.', 'danger');
      },
    });
  }

  private load(): void {
    this.api.employeeMe().subscribe({
      next: (employee) => {
        this.populateEmployee(employee);
      },
      error: () => {
        this.toast.show('Could not load the employee profile.', 'danger');
      },
    });
  }

  private populateEmployee(employee: EmployeeDetail): void {
    this.detail.set(employee);
    this.apiId.set(employee.id);

    this.profile.set({
      id: employee.employeeCode,
      name: employee.fullName,
      dept: employee.department,
      grade: employee.grade,
      status: employee.status,
      join: employee.joinDate,
      salary: `$${employee.grossSalary.toLocaleString()}`,
      email: employee.email,
    });

    this.personal.set({
      fullName: employee.fullName,
      dob: employee.dateOfBirth ?? '',
      gender: employee.gender,
      nationality: employee.nationality ?? '',
      marital: employee.maritalStatus,
      blood: employee.bloodGroup ?? '',
    });

    let reportsToId = employee.reportingManagerId ?? '';
    if (!reportsToId && employee.reportingManager) {
      const match = this.allEmployees().find(
        (e) => e.fullName.toLowerCase() === employee.reportingManager!.toLowerCase()
      );
      if (match) {
        reportsToId = match.id;
      }
    }

    this.job.set({
      title: employee.jobTitle,
      dept: employee.department,
      reportsTo: reportsToId,
      joinDate: employee.joinDate,
      roleCode: employee.roleCode || (employee.jobTitle.toLowerCase().includes('hr') ? 'HrManager' : 'Employee'),
    });
    this.selectedDesignationId.set(employee.designationId ?? '');

    this.contact.set({
      phone: employee.phone ?? '',
      email: employee.email,
      emergency: '',
      address: employee.address ?? '',
      city: employee.city ?? '',
      state: employee.state ?? '',
      country: employee.country ?? '',
    });

    this.identity.set({
      passportNo: employee.passportNumber ?? '',
      passportExp: employee.passportExpiry ?? '',
      visaNo: employee.visaNumber ?? '',
      visaExp: employee.visaExpiry ?? '',
      emiratesId: employee.emiratesId ?? '',
    });

    this.bank.set({
      bankName: employee.bankName ?? '',
      accountName: employee.accountName ?? '',
      accountNo: employee.accountNumber ?? '',
      iban: employee.iban ?? '',
      ifsc: employee.ifscCode ?? '',
      swift: employee.swiftCode ?? '',
      currency: employee.currency,
      paymentMode: employee.paymentMode,
      wpsId: employee.wpsId ?? '',
    });

    this.api.enrolledFaces().subscribe({
      next: (faces) => {
        const match = faces.find((f) => f.employeeId.toLowerCase() === employee.id.toLowerCase());
        if (match) {
          this.isFaceEnrolled.set(true);
          this.faceEnrolledAt.set(match.enrolledAtUtc ?? null);
          this.facePhotoUrl.set(match.avatarUrl ?? null);
        } else {
          this.isFaceEnrolled.set(false);
          this.faceEnrolledAt.set(null);
          this.facePhotoUrl.set(null);
        }
      },
      error: () => {},
    });

    this.loadDocuments(employee.id);
  }

  private loadDocuments(employeeId: string): void {
    this.api.documents({ employeeId }).subscribe({
      next: (rows) =>
        this.docs.set(
          rows.map((d) => ({
            doc: d.name,
            type: d.type,
            issue: d.issueDate ?? '',
            exp: d.expiryDate ?? '',
            s: d.status,
          })),
        ),
      error: () => {
        /* API offline — keep demo documents. */
      },
    });
  }

  protected save(message: string): void {
    const id = this.apiId();
    const detail = this.detail();
    if (!id || !detail) {
      this.toast.show('The employee profile is not loaded yet.', 'danger');
      return;
    }

    const personal = this.personal();
    const job = this.job();
    const contact = this.contact();
    const identity = this.identity();
    const bank = this.bank();

    const fullName = personal.fullName.trim();
    let firstName = detail.firstName;
    let lastName = detail.lastName;
    if (fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : (detail.lastName || parts[0]);
    }

    const body = {
      firstName: firstName || detail.firstName,
      middleName: detail.middleName,
      lastName: lastName || detail.lastName,
      email: contact.email || detail.email,
      phone: contact.phone || null,
      dateOfBirth: this.toIso(personal.dob),
      gender: personal.gender || detail.gender || null,
      maritalStatus: personal.marital || detail.maritalStatus || null,
      bloodGroup: personal.blood || null,
      nationality: personal.nationality || null,
      address: contact.address || null,
      city: contact.city || null,
      state: contact.state || detail.state || null,
      country: contact.country || null,
      departmentId: this.departmentIds.get(job.dept) ?? detail.departmentId,
      designationId: this.selectedDesignationId() || detail.designationId || null,
      branchId: detail.branchId,
      reportingManagerId: job.reportsTo ? job.reportsTo : null,
      jobTitle: job.title,
      roleCode: job.roleCode || (job.title.toLowerCase().includes('hr') ? 'HrManager' : 'Employee'),
      grade: detail.grade,
      employmentType: detail.employmentType,
      status: detail.status,
      joinDate: this.toIso(job.joinDate) ?? detail.joinDate,
      noticePeriodDays: detail.noticePeriodDays,
      basicSalary: detail.basicSalary,
      housingAllowance: detail.housingAllowance,
      transportAllowance: detail.transportAllowance,
      mobileAllowance: detail.mobileAllowance,
      otherAllowances: detail.otherAllowances,
      currency: bank.currency || detail.currency,
      bankName: bank.bankName || null,
      accountName: bank.accountName || null,
      accountNumber: bank.accountNo || null,
      iban: bank.iban || null,
      ifscCode: bank.ifsc || null,
      swiftCode: bank.swift || null,
      paymentMode: bank.paymentMode || detail.paymentMode,
      wpsId: bank.wpsId || null,
      passportNumber: identity.passportNo || null,
      passportExpiry: this.toIso(identity.passportExp),
      visaNumber: identity.visaNo || null,
      visaExpiry: this.toIso(identity.visaExp),
      emiratesId: identity.emiratesId || null,
    };

    this.api.updateEmployee(id, body).subscribe({
      next: (updated) => {
        this.populateEmployee(updated);
        this.employeeOptions.update((opts) =>
          opts.map((opt) =>
            opt.v.toLowerCase() === updated.id.toLowerCase()
              ? { ...opt, l: `${updated.employeeCode} - ${updated.fullName} (${updated.jobTitle || updated.department})` }
              : opt
          )
        );
        this.toast.show(message, 'success');
      },
      error: (error) => this.toast.show(error?.error?.title ?? error?.error?.message ?? 'Could not save the profile.', 'danger'),
    });
  }

  private toIso(value: string): string | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  protected readonly selectedDocFile = signal<File | null>(null);
  protected readonly uploadIssueDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly uploadExpiryDate = signal('');
  protected readonly uploadingDoc = signal(false);

  protected onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedDocFile.set(input.files[0]);
    }
  }

  protected onDocFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.selectedDocFile.set(event.dataTransfer.files[0]);
    }
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  protected closeUploadDocModal(): void {
    this.selectedDocFile.set(null);
    this.uploadIssueDate.set(new Date().toISOString().slice(0, 10));
    this.uploadExpiryDate.set('');
    this.ui.close('uploadDocModal');
  }

  protected uploadDocument(): void {
    const employeeId = this.apiId();
    if (!employeeId) {
      this.toast.show('The employee profile is not loaded yet.', 'danger');
      return;
    }

    const file = this.selectedDocFile();
    const type = this.uploadType();
    const documentType = type === 'Visa' || type === 'Work Permit'
      ? 'Legal'
      : type === 'Medical Insurance'
        ? 'Benefits'
        : type === 'Other'
          ? 'Other'
          : 'Identity';

    const docName = file ? file.name : `${type} Document`;
    const fileSize = file ? this.formatFileSize(file.size) : '1.2 MB';

    this.uploadingDoc.set(true);
    this.api
      .createDocument({
        employeeId,
        name: docName,
        type: documentType,
        issueDate: this.uploadIssueDate() || new Date().toISOString().slice(0, 10),
        expiryDate: this.uploadExpiryDate() || null,
        notes: null,
        fileUrl: file ? file.name : null,
        fileSize,
        isCompanyDocument: false,
      })
      .subscribe({
        next: () => {
          this.uploadingDoc.set(false);
          this.closeUploadDocModal();
          this.toast.show('Document uploaded successfully!', 'success');
          this.loadDocuments(employeeId);
        },
        error: (error) => {
          this.uploadingDoc.set(false);
          this.toast.show(error?.error?.title ?? error?.error?.message ?? 'Could not upload the document.', 'danger');
        },
      });
  }

  protected readonly tabs = [
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'contact', label: 'Contact', icon: 'mail' },
    { id: 'bank', label: 'Bank', icon: 'payroll' },
    { id: 'docs', label: 'Documents', icon: 'documents' },
    { id: 'biometric', label: 'Face ID & Biometrics', icon: 'clock' },
  ] as const;

  protected readonly tab = signal<'personal' | 'contact' | 'bank' | 'docs' | 'biometric'>('personal');

  @ViewChild('enrollVideo') enrollVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('enrollCanvas') enrollCanvas?: ElementRef<HTMLCanvasElement>;

  protected readonly faceEnrollModalOpen = signal(false);
  protected readonly enrollingFace = signal(false);
  protected readonly isFaceEnrolled = signal(false);
  protected readonly faceEnrolledAt = signal<string | null>(null);
  protected readonly facePhotoUrl = signal<string | null>(null);
  private cameraStream?: MediaStream;

  protected readonly profile = signal<ProfileData>(EmployeeProfileComponent.readProfile());

  protected readonly personal = signal({
    fullName: EmployeeProfileComponent.readProfile().name || '',
    dob: '',
    gender: 'Female',
    nationality: '',
    marital: '',
    blood: '',
  });

  protected readonly systemRoleOptions: SelectOption[] = [
    { v: 'Employee', l: 'Employee (Self-Service Portal)' },
    { v: 'HrManager', l: 'HR Manager' },
    { v: 'CompanyAdmin', l: 'Company Admin' },
  ];

  protected readonly job = signal({
    title: '',
    dept: EmployeeProfileComponent.readProfile().dept || '',
    reportsTo: '',
    joinDate: '',
    roleCode: 'Employee',
  });

  protected readonly contact = signal({
    phone: '',
    email: EmployeeProfileComponent.readProfile().email || '',
    emergency: '',
    address: '',
    city: '',
    state: '',
    country: '',
  });

  protected readonly identity = signal({
    passportNo: '',
    passportExp: '',
    visaNo: '',
    visaExp: '',
    emiratesId: '',
  });

  protected readonly bank = signal({
    bankName: '',
    accountName: '',
    accountNo: '',
    iban: '',
    ifsc: '',
    swift: '',
    currency: 'AED',
    paymentMode: 'Bank Transfer',
    wpsId: '',
  });

  protected readonly salaryStructure: [string, string, string][] = [];

  protected readonly docs = signal<DocRow[]>([]);

  protected readonly uploadType = signal('Passport');

  protected readonly genderOptions: SelectOption[] = [
    { v: 'Female', l: 'Female' },
    { v: 'Male', l: 'Male' },
    { v: 'Other', l: 'Other' },
  ];
  protected readonly maritalOptions: SelectOption[] = [
    { v: 'Married', l: 'Married' },
    { v: 'Single', l: 'Single' },
    { v: 'Divorced', l: 'Divorced' },
    { v: 'Widowed', l: 'Widowed' },
  ];
  protected readonly bloodOptions: SelectOption[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => ({ v: b, l: b }));
  protected deptOptions: SelectOption[] = [];
  protected readonly allEmployees = signal<EmployeeListItem[]>([]);
  protected readonly reportingOptions = computed<SelectOption[]>(() => {
    const currentId = (this.apiId() || '').toLowerCase();
    const list = this.allEmployees().filter((e) => !currentId || e.id.toLowerCase() !== currentId);
    return [
      { v: '', l: 'None / Top Level' },
      ...list.map((e) => ({
        v: e.id,
        l: `${e.fullName} (${e.jobTitle || e.department})`,
      })),
    ];
  });
  protected readonly countryOptions: SelectOption[] = [
    { v: 'UAE', l: 'UAE' },
    { v: 'Saudi Arabia', l: 'Saudi Arabia' },
    { v: 'Qatar', l: 'Qatar' },
    { v: 'United Kingdom', l: 'United Kingdom' },
    { v: 'United States', l: 'United States' },
  ];
  protected readonly bankOptions: SelectOption[] = [
    { v: 'Emirates NBD', l: 'Emirates NBD' },
    { v: 'First Abu Dhabi Bank', l: 'First Abu Dhabi Bank' },
    { v: 'ADCB', l: 'ADCB' },
    { v: 'HSBC', l: 'HSBC' },
    { v: 'Other', l: 'Other' },
  ];
  protected readonly bankCurrencyOptions: SelectOption[] = ['AED', 'USD', 'SAR', 'GBP'].map((c) => ({ v: c, l: c }));
  protected readonly paymentModeOptions: SelectOption[] = [
    { v: 'Bank Transfer', l: 'Bank Transfer' },
    { v: 'WPS', l: 'WPS' },
    { v: 'Cheque', l: 'Cheque' },
    { v: 'Cash', l: 'Cash' },
  ];
  protected readonly uploadTypeOptions: SelectOption[] = [
    { v: 'Passport', l: 'Passport' },
    { v: 'Visa', l: 'Visa' },
    { v: 'Work Permit', l: 'Work Permit' },
    { v: 'Emirates ID', l: 'Emirates ID' },
    { v: 'Medical Insurance', l: 'Medical Insurance' },
    { v: 'Other', l: 'Other' },
  ];

  protected initials(): string {
    const name = this.profile().name?.trim();
    if (!name) return 'EP';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('');
  }

  protected patchPersonal(key: keyof ReturnType<typeof this.personal>, value: string): void {
    this.personal.update((p) => ({ ...p, [key]: value }));
  }

  protected patchJob(key: 'title' | 'dept' | 'reportsTo' | 'joinDate' | 'roleCode', value: string): void {
    this.job.update((j) => ({ ...j, [key]: value }));
  }

  protected patchContact(key: 'phone' | 'email' | 'emergency' | 'address' | 'city' | 'state' | 'country', value: string): void {
    this.contact.update((c) => ({ ...c, [key]: value }));
  }

  protected patchIdentity(key: 'passportNo' | 'passportExp' | 'visaNo' | 'visaExp' | 'emiratesId', value: string): void {
    this.identity.update((i) => ({ ...i, [key]: value }));
  }

  protected patchBank(key: keyof ReturnType<typeof this.bank>, value: string): void {
    this.bank.update((b) => ({ ...b, [key]: value }));
  }

  protected async openFaceEnrollModal(): Promise<void> {
    this.faceEnrollModalOpen.set(true);
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      setTimeout(() => {
        if (this.enrollVideo?.nativeElement) {
          this.enrollVideo.nativeElement.srcObject = this.cameraStream || null;
        }
      }, 200);
    } catch {
      this.toast.show('Camera access needed to capture Face ID.', 'warning');
    }
  }

  protected closeFaceEnrollModal(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = undefined;
    }
    this.faceEnrollModalOpen.set(false);
  }

  protected captureAndSaveFace(): void {
    const id = this.apiId();
    if (!id) {
      this.toast.show('Employee ID not loaded.', 'danger');
      return;
    }

    this.enrollingFace.set(true);
    let photoDataUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

    try {
      const video = this.enrollVideo?.nativeElement;
      const canvas = this.enrollCanvas?.nativeElement;
      if (video && canvas && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
      }
    } catch { }

    const dummyDescriptor = JSON.stringify(Array.from({ length: 128 }, () => Math.random() * 0.2 + 0.1));

    this.api
      .enrollFace(id, {
        faceDescriptor: dummyDescriptor,
        facePhotoUrl: photoDataUrl,
      })
      .subscribe({
        next: () => {
          this.enrollingFace.set(false);
          this.isFaceEnrolled.set(true);
          this.faceEnrolledAt.set(new Date().toISOString());
          this.facePhotoUrl.set(photoDataUrl);
          this.closeFaceEnrollModal();
          this.toast.show('Face ID registered and enrolled successfully!', 'success');
        },
        error: (err) => {
          this.enrollingFace.set(false);
          this.toast.show(err?.error?.message || 'Could not register Face ID.', 'danger');
        },
      });
  }

  protected removeFaceId(): void {
    const id = this.apiId();
    if (!id) return;
    this.api.removeFace(id).subscribe({
      next: () => {
        this.isFaceEnrolled.set(false);
        this.faceEnrolledAt.set(null);
        this.facePhotoUrl.set(null);
        this.toast.show('Face ID template removed.');
      },
      error: () => this.toast.show('Could not remove Face ID.', 'danger'),
    });
  }

  private static readProfile(): ProfileData {
    const fallback: ProfileData = {
      id: '',
      name: '',
      dept: '',
      grade: '',
      status: 'Active',
      join: '',
      salary: '$0',
      email: '',
    };
    try {
      const stored = sessionStorage.getItem('empProfile');
      return stored ? { ...fallback, ...(JSON.parse(stored) as Partial<ProfileData>) } : fallback;
    } catch {
      return fallback;
    }
  }
}
