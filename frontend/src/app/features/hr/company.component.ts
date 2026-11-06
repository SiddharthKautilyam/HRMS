import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import {
  CompanyDetail,
  CompanyListItem,
  CompanyProvisioningResult,
  CreateCompanyRequest,
  SaveCompanySettingsRequest,
  UpdateCompanyRequest,
} from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';

export type CompanyTab = 'directory' | 'profile' | 'departments' | 'designations' | 'holiday';

export interface CompanyRow {
  id: string;
  srNo: number;
  companyLogo: string;
  name: string;
  code: string;
  brandName?: string;
  proprietor: string;
  contactEmail?: string;
  contactNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  timeZone?: string;
  registrationNumber?: string;
}

export interface DepartmentRow {
  id: string;
  srNo: number;
  name: string;
  code: string;
  employeeCount: number;
  description?: string;
}

export interface DesignationRow {
  id: string;
  srNo: number;
  name: string;
  employeeCount: number;
  grade?: string;
  department?: string;
  description?: string;
}

export interface HolidayRow {
  id: string;
  srNo: number;
  name: string;
  date: string;
  dayLabel: string;
  type: string;
  description?: string;
}

function emptyTenantForm(): CreateCompanyRequest {
  return {
    name: '',
    code: '',
    adminFullName: '',
    adminEmail: '',
    contactName: '',
    contactEmail: '',
    timeZone: 'UTC',
  };
}

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="company-page">
      <!-- Top Title Bar -->
      <div class="flex justify-between items-center" style="margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div>
          <div class="page-title">{{ isSuperAdmin() ? 'Company & Tenant Management' : 'Company Management' }}</div>
          <div class="page-subtitle">
            {{ isSuperAdmin() 
                ? 'Create & manage tenant companies (each with dedicated database), plus organization structure' 
                : 'Configure organization structure, directory, departments, designations & corporate holidays' }}
          </div>
        </div>
        @if (isSuperAdmin() && activeTab() === 'directory') {
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="loadTenantCompanies()">
              <span [appIcon]="'sync'"></span> Refresh
            </button>
            <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="openCreateTenant()">
              <span [appIcon]="'plus'"></span> New Company
            </button>
          </div>
        }
      </div>

      <!-- Activation link banner for Super Admin -->
      @if (isSuperAdmin() && activationUrl()) {
        <div class="alert alert-warning" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <strong>Activation link (share with the company admin — email delivery is disabled in this environment)</strong>
            <button class="btn btn-ghost btn-sm" (click)="dismissActivationLink()"><span [appIcon]="'x'"></span></button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input class="form-control" type="text" [value]="activationUrl()!" readonly style="flex: 1; min-width: 260px;" />
            <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px;" (click)="copyActivationLink()">
              <span [appIcon]="'link'"></span> Copy
            </button>
          </div>
        </div>
      }

      <!-- Top Navigation Tabs (Directory/Companies, Departments, Designations, Holiday) -->
      <div class="card p-0" style="margin-bottom: 20px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border);">
        <div style="display: flex; gap: 4px; border-bottom: 1px solid var(--border); background: var(--surface); padding: 4px 16px 0 16px;">
          @for (tab of displayTabs(); track tab.id) {
            <button
              class="tab-btn"
              [class.active]="activeTab() === tab.id"
              (click)="selectTab(tab.id)"
              style="padding: 12px 22px; font-weight: 700; font-size: 13.5px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent; transition: all .15s;"
              [style.border-bottom-color]="activeTab() === tab.id ? 'var(--p)' : 'transparent'"
              [style.color]="activeTab() === tab.id ? 'var(--p)' : 'var(--muted)'"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      </div>

      <!-- Main Card Container -->
      <div class="card p-0" style="border-radius: 10px; overflow: hidden; border: 1px solid var(--border);">
        <!-- Card Header with Title and Filter/Plus buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 10px;">
          <h4 style="margin: 0; font-weight: 700; font-size: 16px; color: var(--text);">
            {{ currentHeaderTitle() }}
          </h4>

          @if (isSuperAdmin() && activeTab() === 'directory') {
            <!-- Super Admin Tenant Companies Search Header -->
            <div class="input-group" style="max-width: 280px;">
              <span class="input-icon" [appIcon]="'search'"></span>
              <input class="form-control" type="text" placeholder="Search name, code, email..." [(ngModel)]="tenantSearch" (keyup.enter)="loadTenantCompanies()" />
            </div>
          } @else if (activeTab() === 'profile') {
            @if (canEditCompany()) {
              <button class="btn btn-primary btn-sm" [disabled]="savingProfile()" (click)="saveCompanyProfile()" style="display: inline-flex; align-items: center; gap: 6px;">
                <span [appIcon]="'check'"></span> {{ savingProfile() ? 'Saving...' : 'Save Profile' }}
              </button>
            }
          } @else {
            <div style="display: flex; align-items: center; gap: 8px;">
              <button 
                class="action-icon-btn" 
                [class.active]="showFilterRow()" 
                (click)="showFilterRow.set(!showFilterRow())" 
                data-tooltip="Toggle Search Filters"
                style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: #1e293b; color: white; border-radius: 4px; border: none; cursor: pointer;"
              >
                <span [appIcon]="'filter'"></span>
              </button>
              @if (perms.canCreate('Company')) {
                <button 
                  class="action-icon-btn" 
                  (click)="openAddModal()" 
                  data-tooltip="Add New"
                  style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: #1e293b; color: white; border-radius: 4px; border: none; cursor: pointer;"
                >
                  <span [appIcon]="'plus'"></span>
                </button>
              }
            </div>
          }
        </div>

        <!-- TAB 1: SUPER ADMIN TENANT COMPANIES TABLE -->
        @if (activeTab() === 'directory' && isSuperAdmin()) {
          <div class="table-wrap" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Company</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Status</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Dedicated Database</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Administrator</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Invitation</th>
                  <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (tenantLoading()) {
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 32px; color: var(--muted);">Loading tenant companies…</td>
                  </tr>
                } @else if (tenantCompanies().length === 0) {
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 32px; color: var(--muted);">No companies yet. Create one to provision its dedicated database.</td>
                  </tr>
                } @else {
                  @for (c of tenantCompanies(); track c.id) {
                    <tr style="border-bottom: 1px solid var(--border);">
                      <td style="padding: 14px 16px;">
                        <div style="font-weight: 700; font-size: 14px; color: var(--text);">{{ c.name }}</div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                          <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700;">{{ c.code }}</span>
                          @if (c.isDefault) {
                            <span class="badge badge-info">Default</span>
                          }
                        </div>
                      </td>
                      <td style="padding: 14px 16px;">
                        <span class="badge" [ngClass]="statusBadge(c.status)">{{ c.status }}</span>
                      </td>
                      <td style="padding: 14px 16px; font-size: 13px; font-family: monospace; color: var(--muted);">
                        {{ c.databaseName || '—' }}
                      </td>
                      <td style="padding: 14px 16px;">
                        <div style="font-weight: 600; font-size: 13px;">{{ c.adminFullName }}</div>
                        <div style="font-size: 11px; color: var(--muted);">{{ c.adminEmail }}</div>
                      </td>
                      <td style="padding: 14px 16px;">
                        <span class="badge" [ngClass]="inviteBadge(c.invitationStatus)">{{ c.invitationStatus }}</span>
                      </td>
                      <td style="padding: 14px 16px; text-align: right;">
                        <div style="display: inline-flex; gap: 6px;">
                          <button class="tbl-btn" data-tooltip="Details & Logs" (click)="viewTenant(c)" [disabled]="busyTenantId() === c.id">
                            <span [appIcon]="'eye'"></span>
                          </button>
                          <button class="tbl-btn" data-tooltip="Edit Company" (click)="editTenant(c)" [disabled]="busyTenantId() === c.id">
                            <span [appIcon]="'edit'"></span>
                          </button>
                          <button class="tbl-btn" data-tooltip="Retry Provisioning" (click)="retryTenant(c)" [disabled]="busyTenantId() === c.id">
                            <span [appIcon]="'sync'"></span>
                          </button>
                          <button class="tbl-btn" data-tooltip="Resend Invitation" (click)="resendTenant(c)" [disabled]="busyTenantId() === c.id">
                            <span [appIcon]="'mail'"></span>
                          </button>
                          @if (!c.isDefault) {
                            <button
                              class="tbl-btn"
                              [class.danger]="c.status !== 'Suspended'"
                              [class.success]="c.status === 'Suspended'"
                              [attr.data-tooltip]="c.status === 'Suspended' ? 'Activate' : 'Suspend'"
                              (click)="toggleTenantStatus(c)"
                              [disabled]="busyTenantId() === c.id"
                            >
                              <span [appIcon]="c.status === 'Suspended' ? 'check' : 'lock'"></span>
                            </button>
                            <button
                              class="tbl-btn danger"
                              data-tooltip="Delete Company & Database"
                              (click)="confirmDeleteTenant(c)"
                              [disabled]="busyTenantId() === c.id"
                            >
                              <span [appIcon]="'trash'"></span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }

        <!-- TAB 1: COMPANY PROFILE (Non-SuperAdmin) -->
        @if (activeTab() === 'profile') {
          <div style="padding: 24px;">
            @if (loadingProfile()) {
              <div style="text-align: center; padding: 48px; color: var(--muted);">
                <div class="spinner-sm" style="width: 24px; height: 24px; margin: 0 auto 8px auto; border: 2px solid var(--border); border-top-color: var(--p); border-radius: 50%; animation: spin .8s linear infinite;"></div>
                <div>Loading company profile...</div>
              </div>
            } @else {
              <!-- Permission Notice if read-only -->
              @if (!canEditCompany()) {
                <div class="alert alert-info" style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                  <span [appIcon]="'info'"></span>
                  <span>You have read-only access to company settings. Only authorized administrators can modify these fields.</span>
                </div>
              }

              <!-- Logo & Identity Card -->
              <div class="card p-4" style="background: var(--bg); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 24px;">
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 14px; color: var(--text);">
                  Company Branding & Logo
                </div>
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                  <!-- Logo Preview Box -->
                  <div style="width: 120px; height: 120px; border-radius: 12px; background: var(--surface); border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                    @if (profileForm.logoUrl) {
                      <img [src]="profileForm.logoUrl" alt="Company Logo" style="max-width: 100%; max-height: 100%; object-fit: contain; padding: 8px;" />
                    } @else {
                      <div style="text-align: center; color: var(--muted);">
                        <span [appIcon]="'company'" style="font-size: 28px; display: block; margin-bottom: 4px;"></span>
                        <span style="font-size: 11px;">No Logo</span>
                      </div>
                    }
                  </div>

                  <!-- Logo Upload Actions -->
                  <div style="flex: 1; min-width: 240px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px;">
                      Brand Logo (PNG, JPEG, SVG, WebP)
                    </div>
                    <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
                      Max file size: 2MB. SVGs are automatically sanitized to prevent embedded scripts. Shown across sidebar, header, and login screen.
                    </div>
                    @if (canEditCompany()) {
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <label class="btn btn-primary btn-sm" [class.disabled]="uploadingLogo()" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                          <span [appIcon]="'upload'"></span>
                          {{ uploadingLogo() ? 'Uploading...' : 'Upload Logo' }}
                          <input type="file" (change)="onLogoSelected($event)" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display: none;" [disabled]="uploadingLogo()" />
                        </label>
                        @if (profileForm.logoUrl) {
                          <button type="button" class="btn btn-outline btn-sm text-danger" (click)="removeLogo()" [disabled]="uploadingLogo()">
                            <span [appIcon]="'trash'"></span> Remove
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Main Details Form -->
              <form (submit)="saveCompanyProfile()">
                <!-- Section 1: Required General Information -->
                <div style="font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--p); margin-bottom: 14px;">
                  General Information
                </div>
                <div class="row" style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
                  <div style="flex: 1; min-width: 260px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Company Name <span class="text-danger">*</span></label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.companyName" name="companyName" required [disabled]="!canEditCompany()" placeholder="e.g. Acme Corporation" />
                  </div>
                  <div style="flex: 1; min-width: 260px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Official HR Email <span class="text-danger">*</span></label>
                    <input class="form-control" type="email" [(ngModel)]="profileForm.hrEmail" name="hrEmail" required [disabled]="!canEditCompany()" placeholder="hr@acme.com" />
                  </div>
                  <div style="flex: 1; min-width: 220px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Time Zone <span class="text-danger">*</span></label>
                    <select class="form-control" [(ngModel)]="profileForm.timeZone" name="timeZone" required [disabled]="!canEditCompany()">
                      <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                      <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                      <option value="UTC">UTC (+00:00)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                    </select>
                  </div>
                </div>

                <!-- Section 2: Configurable Jurisdiction / Tax & Registration -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <div style="font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--p);">
                    Tax & Statutory Registration
                  </div>
                  <span class="badge badge-info" style="font-size: 11px;">Configurable Field Labels</span>
                </div>
                <div class="row" style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; background: rgba(37,99,235,0.03); padding: 16px; border-radius: 8px; border: 1px dashed rgba(37,99,235,0.2);">
                  <div style="flex: 1; min-width: 260px;">
                    <label class="form-label" style="font-weight: 600; font-size: 12px; color: var(--muted);">Tax Label (e.g. TRN / VAT / GSTIN / Tax ID)</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.taxNumberLabel" name="taxNumberLabel" [disabled]="!canEditCompany()" placeholder="e.g. TRN / VAT No." style="margin-bottom: 8px;" />
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">{{ profileForm.taxNumberLabel || 'Tax Number' }}</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.trn" name="trn" [disabled]="!canEditCompany()" placeholder="Enter registered tax number" />
                  </div>
                  <div style="flex: 1; min-width: 260px;">
                    <label class="form-label" style="font-weight: 600; font-size: 12px; color: var(--muted);">Registration Label (e.g. Trade License / CIN / Reg No.)</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.registrationNumberLabel" name="registrationNumberLabel" [disabled]="!canEditCompany()" placeholder="e.g. Trade License No." style="margin-bottom: 8px;" />
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">{{ profileForm.registrationNumberLabel || 'Registration Number' }}</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.tradeLicense" name="tradeLicense" [disabled]="!canEditCompany()" placeholder="Enter license / registration number" />
                  </div>
                </div>

                <!-- Section 3: Optional Contact & Location -->
                <div style="font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--p); margin-bottom: 14px;">
                  Contact & Location Details
                </div>
                <div class="row" style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
                  <div style="flex: 1; min-width: 220px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Phone Number</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.phone" name="phone" [disabled]="!canEditCompany()" placeholder="+971 4 123 4567" />
                  </div>
                  <div style="flex: 1; min-width: 220px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Website</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.website" name="website" [disabled]="!canEditCompany()" placeholder="https://example.com" />
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Industry</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.industry" name="industry" [disabled]="!canEditCompany()" placeholder="e.g. Information Technology" />
                  </div>
                  <div style="flex: 1; min-width: 140px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Payroll Currency</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.payrollCurrency" name="payrollCurrency" [disabled]="!canEditCompany()" placeholder="AED" />
                  </div>
                </div>
                <div class="row" style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
                  <div style="flex: 2; min-width: 260px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Address</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.address" name="address" [disabled]="!canEditCompany()" placeholder="Street, Building, Suite" />
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">City</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.city" name="city" [disabled]="!canEditCompany()" placeholder="e.g. Dubai" />
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <label class="form-label" style="font-weight: 600; font-size: 13px;">Country</label>
                    <input class="form-control" type="text" [(ngModel)]="profileForm.country" name="country" [disabled]="!canEditCompany()" placeholder="e.g. United Arab Emirates" />
                  </div>
                </div>

                <!-- Form Submit Button -->
                @if (canEditCompany()) {
                  <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <button type="submit" class="btn btn-primary" [disabled]="savingProfile()" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px;">
                      <span [appIcon]="'check'"></span>
                      {{ savingProfile() ? 'Saving Profile...' : 'Save Profile Changes' }}
                    </button>
                  </div>
                }
              </form>
            }
          </div>
        }

        <!-- TAB 2: DEPARTMENTS -->
        @if (activeTab() === 'departments') {
          <div class="table-wrap" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                  <th style="width: 80px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">SR No</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Name</th>
                  <th style="width: 180px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Employee Count</th>
                  <th style="width: 100px; padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Action</th>
                </tr>
                @if (showFilterRow()) {
                  <tr style="background: #fafafa; border-bottom: 1px solid var(--border);">
                    <th style="padding: 6px 16px;"></th>
                    <th style="padding: 6px 16px;">
                      <input 
                        type="text" 
                        class="form-control" 
                        placeholder="Search Department Name..." 
                        [(ngModel)]="deptFilterName"
                        style="width: 100%; font-size: 12px; padding: 6px 8px;"
                      />
                    </th>
                    <th style="padding: 6px 16px;"></th>
                    <th style="padding: 6px 16px; text-align: right;">
                      <button class="btn btn-ghost btn-sm" (click)="deptFilterName = ''" data-tooltip="Clear Filter">
                        <span [appIcon]="'x'"></span>
                      </button>
                    </th>
                  </tr>
                }
              </thead>
              <tbody>
                @for (d of paginatedDepartments(); track d.id) {
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 14px 16px; font-weight: 600; color: var(--muted);">{{ d.srNo }}</td>
                    <td style="padding: 14px 16px;">
                      <div style="font-weight: 700; font-size: 14px; color: var(--text);">{{ d.name }}</div>
                      @if (d.description) {
                        <div style="font-size: 12px; color: var(--muted);">{{ d.description }}</div>
                      }
                    </td>
                    <td style="padding: 14px 16px;">
                      <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700; padding: 4px 10px; border-radius: 6px;">
                        {{ d.employeeCount }}
                      </span>
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                      <div style="display: inline-flex; gap: 8px;">
                        @if (perms.canEdit('Company')) {
                          <button class="icon-edit-btn" (click)="openEditDepartment(d)" data-tooltip="Edit">
                            <span [appIcon]="'edit'"></span>
                          </button>
                        }
                        @if (perms.canDelete('Company')) {
                          <button class="icon-delete-btn" (click)="deleteDepartment(d.id)" data-tooltip="Delete">
                            <span [appIcon]="'trash'"></span>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" style="text-align: center; padding: 32px; color: var(--muted);">
                      No departments found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- TAB 3: DESIGNATIONS -->
        @if (activeTab() === 'designations') {
          <div class="table-wrap" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                  <th style="width: 80px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">SR No</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Name</th>
                  <th style="width: 180px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Employee Count</th>
                  <th style="width: 100px; padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Action</th>
                </tr>
                @if (showFilterRow()) {
                  <tr style="background: #fafafa; border-bottom: 1px solid var(--border);">
                    <th style="padding: 6px 16px;"></th>
                    <th style="padding: 6px 16px;">
                      <input 
                        type="text" 
                        class="form-control" 
                        placeholder="Search Designation Name..." 
                        [(ngModel)]="desigFilterName"
                        style="width: 100%; font-size: 12px; padding: 6px 8px;"
                      />
                    </th>
                    <th style="padding: 6px 16px;"></th>
                    <th style="padding: 6px 16px; text-align: right;">
                      <button class="btn btn-ghost btn-sm" (click)="desigFilterName = ''" data-tooltip="Clear Filter">
                        <span [appIcon]="'x'"></span>
                      </button>
                    </th>
                  </tr>
                }
              </thead>
              <tbody>
                @for (ds of paginatedDesignations(); track ds.id) {
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 14px 16px; font-weight: 600; color: var(--muted);">{{ ds.srNo }}</td>
                    <td style="padding: 14px 16px;">
                      <div style="font-weight: 700; font-size: 14px; color: var(--text);">{{ ds.name }}</div>
                      @if (ds.department) {
                        <div style="font-size: 12px; color: var(--muted);">Dept: {{ ds.department }}</div>
                      }
                    </td>
                    <td style="padding: 14px 16px;">
                      <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700; padding: 4px 10px; border-radius: 6px;">
                        {{ ds.employeeCount }}
                      </span>
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                      <div style="display: inline-flex; gap: 8px;">
                        @if (perms.canEdit('Company')) {
                          <button class="icon-edit-btn" (click)="openEditDesignation(ds)" data-tooltip="Edit">
                            <span [appIcon]="'edit'"></span>
                          </button>
                        }
                        @if (perms.canDelete('Company')) {
                          <button class="icon-delete-btn" (click)="deleteDesignation(ds.id)" data-tooltip="Delete">
                            <span [appIcon]="'trash'"></span>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" style="text-align: center; padding: 32px; color: var(--muted);">
                      No designations found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- TAB 4: HOLIDAY -->
        @if (activeTab() === 'holiday') {
          <div class="table-wrap" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                  <th style="width: 80px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">SR No</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Holiday Name</th>
                  <th style="width: 160px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Date</th>
                  <th style="width: 140px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Day</th>
                  <th style="width: 140px; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Type</th>
                  <th style="width: 100px; padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Action</th>
                </tr>
                @if (showFilterRow()) {
                  <tr style="background: #fafafa; border-bottom: 1px solid var(--border);">
                    <th style="padding: 6px 16px;"></th>
                    <th style="padding: 6px 16px;">
                      <input 
                        type="text" 
                        class="form-control" 
                        placeholder="Search Holiday Name..." 
                        [(ngModel)]="holidayFilterName"
                        style="width: 100%; font-size: 12px; padding: 6px 8px;"
                      />
                    </th>
                    <th style="padding: 6px 16px;" colspan="3"></th>
                    <th style="padding: 6px 16px; text-align: right;">
                      <button class="btn btn-ghost btn-sm" (click)="holidayFilterName = ''" data-tooltip="Clear Filter">
                        <span [appIcon]="'x'"></span>
                      </button>
                    </th>
                  </tr>
                }
              </thead>
              <tbody>
                @for (h of paginatedHolidays(); track h.id) {
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 14px 16px; font-weight: 600; color: var(--muted);">{{ h.srNo }}</td>
                    <td style="padding: 14px 16px; font-weight: 700; font-size: 14px; color: var(--text);">{{ h.name }}</td>
                    <td style="padding: 14px 16px; font-weight: 600; font-size: 13px;">{{ h.date }}</td>
                    <td style="padding: 14px 16px; color: var(--muted); font-size: 13px;">{{ h.dayLabel }}</td>
                    <td style="padding: 14px 16px;">
                      <span class="badge" [style.background]="h.type === 'Public' ? 'rgba(5, 150, 105, 0.15)' : 'var(--p-soft)'" [style.color]="h.type === 'Public' ? '#059669' : 'var(--p)'" style="font-weight: 700; padding: 4px 8px; border-radius: 6px;">
                        {{ h.type }}
                      </span>
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                      <div style="display: inline-flex; gap: 8px;">
                        @if (perms.canEdit('Company')) {
                          <button class="icon-edit-btn" (click)="openEditHoliday(h)" data-tooltip="Edit">
                            <span [appIcon]="'edit'"></span>
                          </button>
                        }
                        @if (perms.canDelete('Company')) {
                          <button class="icon-delete-btn" (click)="deleteHoliday(h.id)" data-tooltip="Delete">
                            <span [appIcon]="'trash'"></span>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 32px; color: var(--muted);">
                      No holidays found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- Table Footer / Pagination (Tabs 2, 3, 4 and non-SuperAdmin Tab 1) -->
        @if (!isSuperAdmin() || activeTab() !== 'directory') {
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted);">
              <span>Rows per page:</span>
              <select class="form-control" [(ngModel)]="pageSize" style="width: 70px; padding: 4px 8px; font-size: 12px;">
                <option [value]="5">5</option>
                <option [value]="10">10</option>
                <option [value]="25">25</option>
                <option [value]="50">50</option>
              </select>
              <span>Showing {{ currentStartIndex() + 1 }} - {{ currentEndIndex() }} of {{ currentTotalCount() }}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="btn btn-outline btn-sm" [disabled]="currentPage() === 1" (click)="currentPage.set(currentPage() - 1)">
                Previous
              </button>
              <span style="font-size: 13px; font-weight: 700; padding: 0 8px;">Page {{ currentPage() }}</span>
              <button class="btn btn-outline btn-sm" [disabled]="currentEndIndex() >= currentTotalCount()" (click)="currentPage.set(currentPage() + 1)">
                Next
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- MODAL: SUPER ADMIN NEW COMPANY (TENANT DATABASE PROVISIONING) -->
    @if (showCreateTenant()) {
      <div class="modal-overlay open" (click)="showCreateTenant.set(false)">
        <div class="modal" style="max-width: 560px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">New Company & Dedicated Database</div>
            <button class="btn btn-ghost btn-sm" (click)="showCreateTenant.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Company Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="tenantCreateForm.name" placeholder="e.g. Acme Widgets LLC" />
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Company Code</label>
                <input class="form-control" type="text" [(ngModel)]="tenantCreateForm.code" placeholder="Auto-generated" />
              </div>
              <div class="form-group">
                <label class="form-label">Time Zone</label>
                <input class="form-control" type="text" [(ngModel)]="tenantCreateForm.timeZone" placeholder="e.g. Asia/Dubai" />
              </div>
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Administrator Full Name <span style="color: var(--danger)">*</span></label>
                <input class="form-control" type="text" [(ngModel)]="tenantCreateForm.adminFullName" placeholder="e.g. Jane Doe" />
              </div>
              <div class="form-group">
                <label class="form-label">Administrator Email <span style="color: var(--danger)">*</span></label>
                <input class="form-control" type="email" [(ngModel)]="tenantCreateForm.adminEmail" placeholder="admin@example.com" />
              </div>
            </div>
            <div class="grid grid-2" style="gap: 12px;">
              <div class="form-group">
                <label class="form-label">Contact Name</label>
                <input class="form-control" type="text" [(ngModel)]="tenantCreateForm.contactName" placeholder="Optional" />
              </div>
              <div class="form-group">
                <label class="form-label">Contact Email</label>
                <input class="form-control" type="email" [(ngModel)]="tenantCreateForm.contactEmail" placeholder="Optional" />
              </div>
            </div>
            <div style="background: var(--p-soft); border-radius: 8px; padding: 12px; margin-top: 14px; font-size: 13px;">
              ⚡ A dedicated, isolated SQLite/Postgres database will automatically be provisioned with its own schema migrations for this company.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showCreateTenant.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveTenant()" [disabled]="savingTenant()">
              {{ savingTenant() ? 'Provisioning…' : 'Create & Provision Database' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: SUPER ADMIN EDIT TENANT COMPANY -->
    @if (showEditTenant()) {
      <div class="modal-overlay open" (click)="closeEditTenant()">
        <div class="modal" style="max-width: 560px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-size: 1.1rem; font-weight: 700;">Edit Company Details</div>
            <button class="btn btn-ghost btn-sm" (click)="closeEditTenant()"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Company Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="tenantEditForm.name" placeholder="e.g. Acme Widgets LLC" />
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Administrator Full Name <span style="color: var(--danger)">*</span></label>
              <input class="form-control" type="text" [(ngModel)]="tenantEditForm.adminFullName" placeholder="Full name" />
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Contact Name</label>
                <input class="form-control" type="text" [(ngModel)]="tenantEditForm.contactName" />
              </div>
              <div class="form-group">
                <label class="form-label">Contact Email</label>
                <input class="form-control" type="email" [(ngModel)]="tenantEditForm.contactEmail" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Time Zone</label>
              <input class="form-control" type="text" [(ngModel)]="tenantEditForm.timeZone" placeholder="e.g. Asia/Dubai" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeEditTenant()">Cancel</button>
            <button class="btn btn-primary" (click)="saveEditTenant()" [disabled]="savingTenant()">
              {{ savingTenant() ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: SUPER ADMIN TENANT DETAILS & PROVISIONING LOGS -->
    @if (showTenantDetail()) {
      @if (tenantDetail(); as d) {
        <div class="modal-overlay open" (click)="closeTenantDetail()">
          <div class="modal" style="max-width: 680px;" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div style="font-size: 1.1rem; font-weight: 700;">{{ d.name }} — Company Details</div>
              <button class="btn btn-ghost btn-sm" (click)="closeTenantDetail()"><span [appIcon]="'x'"></span></button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
              <div class="grid grid-2" style="gap: 12px; margin-bottom: 16px; background: var(--bg); padding: 14px; border-radius: 8px;">
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Company Code</div>
                  <div style="font-weight: 700; font-size: 13px;">{{ d.code }}</div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Status</div>
                  <div><span class="badge" [ngClass]="statusBadge(d.status)">{{ d.status }}</span></div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Dedicated Database</div>
                  <div style="font-family: monospace; font-size: 12px; color: var(--text);">{{ d.databaseName || '—' }}</div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Admin Email</div>
                  <div style="font-size: 13px;">{{ d.adminEmail }}</div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Invitation Status</div>
                  <div><span class="badge" [ngClass]="inviteBadge(d.invitationStatus)">{{ d.invitationStatus }}</span></div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Provisioned At</div>
                  <div style="font-size: 12px;">{{ d.provisionedAtUtc ? (d.provisionedAtUtc | date: 'medium') : '—' }}</div>
                </div>
              </div>

              @if (d.provisioningError) {
                <div class="alert alert-danger" style="font-size: 12px; margin-bottom: 16px;">
                  {{ d.provisioningError }}
                </div>
              }

              <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px; color: var(--text);">
                Provisioning Log
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Result</th>
                      <th>Message</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of d.provisioningLogs; track log.occurredAtUtc + log.step) {
                      <tr>
                        <td style="font-weight: 600; font-size: 13px;">{{ log.step }}</td>
                        <td>
                          <span class="badge" [ngClass]="log.succeeded ? 'badge-success' : 'badge-danger'">
                            {{ log.succeeded ? 'OK' : 'Failed' }}
                          </span>
                        </td>
                        <td style="font-size: 12px; color: var(--muted);">{{ log.message || '—' }}</td>
                        <td style="font-size: 12px; color: var(--muted);">{{ log.occurredAtUtc | date: 'short' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" style="text-align: center; color: var(--muted); padding: 16px;">No logs available.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" (click)="closeTenantDetail()">Close</button>
              <button class="btn btn-primary" (click)="resendDetail()" [disabled]="!d.databaseName">
                Resend Invitation
              </button>
            </div>
          </div>
        </div>
      }
    }

    <!-- MODAL: SUPER ADMIN DELETE TENANT CONFIRM -->
    @if (showDeleteTenantConfirm()) {
      @if (tenantToDelete(); as c) {
        <div class="modal-overlay open" (click)="cancelDeleteTenant()">
          <div class="modal" style="max-width: 480px;" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--danger);">Delete Company</div>
              <button class="btn btn-ghost btn-sm" (click)="cancelDeleteTenant()"><span [appIcon]="'x'"></span></button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom: 12px; font-size: 14px;">
                Are you sure you want to delete <strong>{{ c.name }}</strong> (<code>{{ c.code }}</code>)?
              </p>
              <div class="alert alert-danger" style="font-size: 12.5px; line-height: 1.4;">
                <strong>Warning:</strong> This will permanently delete the dedicated database
                <strong>{{ c.databaseName || 'associated' }}</strong> and all data inside it. This action cannot be undone.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" (click)="cancelDeleteTenant()">Cancel</button>
              <button class="btn btn-primary" style="background: var(--danger); border-color: var(--danger);" (click)="deleteTenantCompanyConfirmed()" [disabled]="savingTenant()">
                {{ savingTenant() ? 'Deleting…' : 'Delete Company & Database' }}
              </button>
            </div>
          </div>
        </div>
      }
    }

    <!-- MODAL: ADD / EDIT COMPANY (NON-SUPERADMIN DIRECTORY) -->
    @if (showCompanyModal()) {
      <div class="modal-overlay open" (click)="showCompanyModal.set(false)">
        <div class="modal" style="max-width: 600px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingCompanyId() ? 'Edit Company' : 'Add Company' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showCompanyModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div style="font-weight: 700; font-size: 12px; color: var(--muted); text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
              General Information
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Company Name *</label>
                <input class="form-control" [(ngModel)]="companyForm.name" placeholder="e.g. Firebird Technologies" />
              </div>
              <div class="form-group">
                <label class="form-label">Code *</label>
                <input class="form-control" [(ngModel)]="companyForm.code" placeholder="e.g. FIRD" />
              </div>
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Proprietor / Director</label>
                <input class="form-control" [(ngModel)]="companyForm.proprietor" placeholder="e.g. John Doe" />
              </div>
              <div class="form-group">
                <label class="form-label">Brand Name</label>
                <input class="form-control" [(ngModel)]="companyForm.brandName" placeholder="e.g. Firebird" />
              </div>
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Contact Email</label>
                <input class="form-control" type="email" [(ngModel)]="companyForm.contactEmail" placeholder="info@company.com" />
              </div>
              <div class="form-group">
                <label class="form-label">Contact Number</label>
                <input class="form-control" [(ngModel)]="companyForm.contactNumber" placeholder="+971 4 123 4567" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Address Line 1</label>
              <input class="form-control" [(ngModel)]="companyForm.addressLine1" placeholder="Building, Street name" />
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 16px;">
              <div class="form-group">
                <label class="form-label">Time Zone</label>
                <select class="form-control" [(ngModel)]="companyForm.timeZone">
                  <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
                  <option value="Europe/London">Europe/London (GMT +00:00)</option>
                  <option value="America/New_York">America/New_York (EST -05:00)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Registration Number</label>
                <input class="form-control" [(ngModel)]="companyForm.registrationNumber" placeholder="e.g. CR-9812450" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showCompanyModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveCompany()">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: ADD / EDIT DEPARTMENT -->
    @if (showDeptModal()) {
      <div class="modal-overlay open" (click)="showDeptModal.set(false)">
        <div class="modal" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingDeptId() ? 'Edit Department' : 'Add Department' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showDeptModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Department Name *</label>
              <input class="form-control" [(ngModel)]="deptForm.name" placeholder="e.g. Engineering, Sales, HR" />
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Code</label>
              <input class="form-control" [(ngModel)]="deptForm.code" placeholder="e.g. ENG, SLS, HR" />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" [(ngModel)]="deptForm.description" rows="3" placeholder="Department description..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showDeptModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveDepartment()">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: ADD / EDIT DESIGNATION -->
    @if (showDesigModal()) {
      <div class="modal-overlay open" (click)="showDesigModal.set(false)">
        <div class="modal" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingDesigId() ? 'Edit Designation' : 'Add Designation' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showDesigModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Designation Name *</label>
              <input class="form-control" [(ngModel)]="desigForm.name" placeholder="e.g. Senior Software Engineer" />
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Department</label>
              <select class="form-control" [(ngModel)]="desigForm.department">
                <option value="">Select Department</option>
                @for (d of departments(); track d.id) {
                  <option [value]="d.name">{{ d.name }}</option>
                }
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Grade / Level</label>
              <input class="form-control" [(ngModel)]="desigForm.grade" placeholder="e.g. L3, Senior, Specialist" />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" [(ngModel)]="desigForm.description" rows="2" placeholder="Responsibilities..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showDesigModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveDesignation()">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: ADD / EDIT HOLIDAY -->
    @if (showHolidayModal()) {
      <div class="modal-overlay open" (click)="showHolidayModal.set(false)">
        <div class="modal" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingHolidayId() ? 'Edit Holiday' : 'Add Holiday' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showHolidayModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Holiday Name *</label>
              <input class="form-control" [(ngModel)]="holidayForm.name" placeholder="e.g. Eid Al Fitr, New Year" />
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Date *</label>
              <input class="form-control" type="date" [(ngModel)]="holidayForm.date" />
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-control" [(ngModel)]="holidayForm.type">
                <option value="National">National / Public Holiday</option>
                <option value="Religious">Religious Holiday</option>
                <option value="Optional">Optional Holiday</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showHolidayModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveHoliday()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .icon-edit-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #10b981;
      border-radius: 4px;
      background: #f0fdf4;
      color: #059669;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all .15s;
    }
    .icon-edit-btn:hover {
      background: #10b981;
      color: white;
    }
    .icon-delete-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #ef4444;
      border-radius: 4px;
      background: #fef2f2;
      color: #dc2626;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all .15s;
    }
    .icon-delete-btn:hover {
      background: #ef4444;
      color: white;
    }
    .tab-btn:hover {
      color: var(--p) !important;
    }
    .tbl-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all .15s;
    }
    .tbl-btn:hover {
      border-color: var(--p);
      color: var(--p);
    }
    .tbl-btn.danger:hover {
      border-color: var(--danger);
      color: var(--danger);
      background: #fef2f2;
    }
    .tbl-btn.success:hover {
      border-color: #10b981;
      color: #059669;
      background: #f0fdf4;
    }
  `],
})
export class CompanyComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  protected readonly perms = inject(PermissionService);

  protected readonly isSuperAdmin = computed(() => this.session.activeRole() === 'Super Admin');

  protected readonly displayTabs = computed(() => {
    if (this.isSuperAdmin()) {
      return [
        { id: 'directory' as CompanyTab, label: 'Companies' },
        { id: 'departments' as CompanyTab, label: 'Departments' },
        { id: 'designations' as CompanyTab, label: 'Designations' },
        { id: 'holiday' as CompanyTab, label: 'Holiday' },
      ];
    }
    return [
      { id: 'profile' as CompanyTab, label: 'Company Profile' },
      { id: 'departments' as CompanyTab, label: 'Departments' },
      { id: 'designations' as CompanyTab, label: 'Designations' },
      { id: 'holiday' as CompanyTab, label: 'Holiday' },
    ];
  });

  protected readonly activeTab = signal<CompanyTab>('directory');
  protected readonly showFilterRow = signal(false);

  // Company Profile State (for tenant Admin & HR)
  protected readonly loadingProfile = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly uploadingLogo = signal(false);
  protected readonly canEditCompany = computed(() => this.perms.canEdit('Company'));

  protected profileForm: SaveCompanySettingsRequest = {
    companyName: '',
    hrEmail: '',
    timeZone: 'Asia/Dubai',
    tradeLicense: '',
    trn: '',
    industry: '',
    foundedYear: null,
    website: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    payrollCurrency: 'AED',
    logoUrl: null,
    taxNumberLabel: 'Tax Number (TRN/VAT)',
    registrationNumberLabel: 'Trade License / CIN',
  };

  // Pagination state (for non-SuperAdmin directory & tabs 2, 3, 4)
  protected pageSize = 10;
  protected readonly currentPage = signal(1);

  // Filter models
  protected companyFilterName = '';
  protected companyFilterProprietor = '';
  protected deptFilterName = '';
  protected desigFilterName = '';
  protected holidayFilterName = '';

  // Data signals
  protected readonly companies = signal<CompanyRow[]>([]);
  protected readonly departments = signal<DepartmentRow[]>([]);
  protected readonly designations = signal<DesignationRow[]>([]);
  protected readonly holidays = signal<HolidayRow[]>([]);

  // Super Admin Tenant Database State
  protected readonly tenantCompanies = signal<CompanyListItem[]>([]);
  protected readonly tenantLoading = signal(false);
  protected tenantSearch = '';
  protected readonly showCreateTenant = signal(false);
  protected readonly showEditTenant = signal(false);
  protected readonly showDeleteTenantConfirm = signal(false);
  protected readonly showTenantDetail = signal(false);
  protected readonly tenantDetail = signal<CompanyDetail | null>(null);
  protected readonly editingTenant = signal<CompanyListItem | null>(null);
  protected readonly tenantToDelete = signal<CompanyListItem | null>(null);
  protected readonly savingTenant = signal(false);
  protected readonly busyTenantId = signal<string | null>(null);
  protected readonly activationUrl = signal<string | null>(null);

  protected tenantCreateForm: CreateCompanyRequest = emptyTenantForm();
  protected tenantEditForm: UpdateCompanyRequest = {
    name: '',
    adminFullName: '',
    contactName: '',
    contactEmail: '',
    timeZone: '',
  };

  // Regular Company Modal signals
  protected readonly showCompanyModal = signal(false);
  protected readonly editingCompanyId = signal<string | null>(null);
  protected companyForm = {
    name: '',
    code: '',
    proprietor: '',
    brandName: '',
    contactEmail: '',
    contactNumber: '',
    addressLine1: '',
    addressLine2: '',
    timeZone: 'UTC',
    registrationNumber: '',
  };

  protected readonly showDeptModal = signal(false);
  protected readonly editingDeptId = signal<string | null>(null);
  protected deptForm = { name: '', code: '', description: '' };

  protected readonly showDesigModal = signal(false);
  protected readonly editingDesigId = signal<string | null>(null);
  protected desigForm = { name: '', grade: '', department: '', description: '' };

  protected readonly showHolidayModal = signal(false);
  protected readonly editingHolidayId = signal<string | null>(null);
  protected holidayForm = { name: '', date: '', type: 'National' };

  ngOnInit(): void {
    if (this.isSuperAdmin()) {
      this.activeTab.set('directory');
      this.loadTenantCompanies();
    } else {
      this.activeTab.set('profile');
      this.loadCompanyProfile();
    }
    this.loadBackendData();
  }

  protected selectTab(tab: CompanyTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    if (tab === 'directory' && this.isSuperAdmin()) {
      this.loadTenantCompanies();
    } else if (tab === 'profile' && !this.isSuperAdmin()) {
      this.loadCompanyProfile();
    }
  }

  protected currentHeaderTitle(): string {
    switch (this.activeTab()) {
      case 'directory': return 'Registered Companies & Databases';
      case 'profile': return 'Company Profile & Branding';
      case 'departments': return 'Departments';
      case 'designations': return 'Designations';
      case 'holiday': return 'Holiday';
    }
  }

  // --- Company Profile & Branding Methods (Tenant) ---
  protected loadCompanyProfile(): void {
    this.loadingProfile.set(true);
    this.api.company().subscribe({
      next: (data) => {
        this.loadingProfile.set(false);
        if (data) {
          this.profileForm = {
            companyName: data.companyName || '',
            hrEmail: data.hrEmail || '',
            timeZone: data.timeZone || 'UTC',
            tradeLicense: data.tradeLicense || '',
            trn: data.trn || '',
            industry: data.industry || '',
            foundedYear: data.foundedYear || null,
            website: data.website || '',
            address: data.address || '',
            city: data.city || '',
            country: data.country || '',
            phone: data.phone || '',
            payrollCurrency: data.payrollCurrency || 'AED',
            logoUrl: data.logoUrl || null,
            taxNumberLabel: data.taxNumberLabel || 'Tax Number (TRN/VAT)',
            registrationNumberLabel: data.registrationNumberLabel || 'Trade License / CIN',
          };
          if (data.logoUrl) {
            this.session.updateCompanyLogo(data.logoUrl);
          }
        }
      },
      error: () => {
        this.loadingProfile.set(false);
        this.toast.show('Could not load company profile settings.', 'danger');
      },
    });
  }

  protected saveCompanyProfile(): void {
    if (!this.canEditCompany()) {
      this.toast.show('You do not have permission to modify company settings.', 'danger');
      return;
    }
    if (!this.profileForm.companyName?.trim()) {
      this.toast.show('Company Name is required.', 'warning');
      return;
    }
    if (!this.profileForm.hrEmail?.trim() || !this.profileForm.hrEmail.includes('@')) {
      this.toast.show('A valid Company HR Email is required.', 'warning');
      return;
    }
    if (!this.profileForm.timeZone?.trim()) {
      this.toast.show('Time Zone is required.', 'warning');
      return;
    }

    this.savingProfile.set(true);
    this.api.updateCompany(this.profileForm).subscribe({
      next: (res) => {
        this.savingProfile.set(false);
        this.toast.show('Company profile and branding saved successfully!', 'success');
        if (res.logoUrl !== undefined) {
          this.session.updateCompanyLogo(res.logoUrl);
        }
        if (res.companyName) {
          this.session.updateUser({ companyName: res.companyName });
        }
      },
      error: (err) => {
        this.savingProfile.set(false);
        this.toast.show(err?.error?.title || 'Failed to save company profile.', 'danger');
      },
    });
  }

  protected onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    const maxSizeBytes = 2 * 1024 * 1024; // 2 MB

    if (!allowed.includes(file.type.toLowerCase())) {
      this.toast.show('Invalid file type. Only PNG, JPEG, SVG, and WebP logos are accepted.', 'danger');
      input.value = '';
      return;
    }

    if (file.size > maxSizeBytes) {
      this.toast.show('File is too large. Maximum logo size is 2 MB.', 'danger');
      input.value = '';
      return;
    }

    this.uploadingLogo.set(true);
    this.api.uploadCompanyLogo(file).subscribe({
      next: (res) => {
        this.uploadingLogo.set(false);
        this.profileForm.logoUrl = res.logoUrl;
        this.session.updateCompanyLogo(res.logoUrl);
        this.toast.show('Company logo uploaded and synchronized!', 'success');
        input.value = '';
      },
      error: (err) => {
        this.uploadingLogo.set(false);
        input.value = '';
        this.toast.show(err?.error?.title || 'Logo upload failed. Please ensure the file is a valid image.', 'danger');
      },
    });
  }

  protected removeLogo(): void {
    if (!this.canEditCompany()) return;
    this.profileForm.logoUrl = null;
    this.session.updateCompanyLogo(null);
  }

  // --- Super Admin Tenant Companies Methods ---
  protected loadTenantCompanies(): void {
    this.tenantLoading.set(true);
    this.api.tenantCompanies(this.tenantSearch).subscribe({
      next: (list) => {
        this.tenantCompanies.set(list || []);
        this.tenantLoading.set(false);
      },
      error: () => {
        this.tenantLoading.set(false);
        this.toast.show('Could not load tenant companies.', 'danger');
      },
    });
  }

  protected openCreateTenant(): void {
    this.tenantCreateForm = emptyTenantForm();
    this.showCreateTenant.set(true);
  }

  protected saveTenant(): void {
    if (!this.tenantCreateForm.name?.trim() || !this.tenantCreateForm.adminFullName?.trim() || !this.tenantCreateForm.adminEmail?.trim()) {
      this.toast.show('Company name, administrator name and email are required.', 'warning');
      return;
    }

    this.savingTenant.set(true);
    this.api.createTenantCompany(this.tenantCreateForm).subscribe({
      next: (result) => {
        this.savingTenant.set(false);
        this.showCreateTenant.set(false);
        this.handleProvisioningResult(result);
        this.loadTenantCompanies();
      },
      error: (error) => {
        this.savingTenant.set(false);
        this.toast.show(error?.error?.title ?? 'Could not create the company.', 'danger');
      },
    });
  }

  protected editTenant(company: CompanyListItem): void {
    this.editingTenant.set(company);
    this.tenantEditForm = {
      name: company.name,
      adminFullName: company.adminFullName,
      contactName: '',
      contactEmail: '',
      timeZone: '',
    };
    this.showEditTenant.set(true);

    this.api.tenantCompany(company.id).subscribe({
      next: (d) => {
        this.tenantEditForm = {
          name: d.name,
          adminFullName: d.adminFullName,
          contactName: d.contactName ?? '',
          contactEmail: d.contactEmail ?? '',
          timeZone: d.timeZone ?? '',
        };
      },
      error: () => {},
    });
  }

  protected closeEditTenant(): void {
    this.showEditTenant.set(false);
    this.editingTenant.set(null);
  }

  protected saveEditTenant(): void {
    const c = this.editingTenant();
    if (!c) return;
    if (!this.tenantEditForm.name?.trim() || !this.tenantEditForm.adminFullName?.trim()) {
      this.toast.show('Company name and administrator name are required.', 'warning');
      return;
    }

    this.savingTenant.set(true);
    this.api.updateTenantCompany(c.id, this.tenantEditForm).subscribe({
      next: () => {
        this.savingTenant.set(false);
        this.showEditTenant.set(false);
        this.editingTenant.set(null);
        this.toast.show('Company details updated successfully.', 'success');
        this.loadTenantCompanies();
      },
      error: (error) => {
        this.savingTenant.set(false);
        this.toast.show(error?.error?.title ?? 'Could not update the company.', 'danger');
      },
    });
  }

  protected confirmDeleteTenant(company: CompanyListItem): void {
    if (company.isDefault) {
      this.toast.show('The default company cannot be deleted.', 'warning');
      return;
    }
    this.tenantToDelete.set(company);
    this.showDeleteTenantConfirm.set(true);
  }

  protected cancelDeleteTenant(): void {
    this.tenantToDelete.set(null);
    this.showDeleteTenantConfirm.set(false);
  }

  protected deleteTenantCompanyConfirmed(): void {
    const c = this.tenantToDelete();
    if (!c) return;

    this.savingTenant.set(true);
    this.api.deleteTenantCompany(c.id).subscribe({
      next: () => {
        this.savingTenant.set(false);
        this.showDeleteTenantConfirm.set(false);
        this.tenantToDelete.set(null);
        this.toast.show(`Company "${c.name}" and dedicated database removed successfully.`, 'success');
        this.loadTenantCompanies();
      },
      error: (error) => {
        this.savingTenant.set(false);
        this.toast.show(error?.error?.title ?? 'Could not delete the company.', 'danger');
      },
    });
  }

  protected viewTenant(company: CompanyListItem): void {
    this.busyTenantId.set(company.id);
    this.api.tenantCompany(company.id).subscribe({
      next: (detail) => {
        this.busyTenantId.set(null);
        this.tenantDetail.set(detail);
        this.showTenantDetail.set(true);
      },
      error: () => {
        this.busyTenantId.set(null);
        this.toast.show('Could not load company details.', 'danger');
      },
    });
  }

  protected closeTenantDetail(): void {
    this.showTenantDetail.set(false);
    this.tenantDetail.set(null);
  }

  protected retryTenant(company: CompanyListItem): void {
    this.busyTenantId.set(company.id);
    this.api.retryProvisioning(company.id).subscribe({
      next: (result) => {
        this.busyTenantId.set(null);
        this.handleProvisioningResult(result);
        this.loadTenantCompanies();
      },
      error: (error) => {
        this.busyTenantId.set(null);
        this.toast.show(error?.error?.title ?? 'Retry failed.', 'danger');
      },
    });
  }

  protected resendTenant(company: { id: string; name?: string }): void {
    this.busyTenantId.set(company.id);
    this.api.resendInvitation(company.id).subscribe({
      next: (result) => {
        this.busyTenantId.set(null);
        this.loadTenantCompanies();
        if (result.activationUrl) {
          this.activationUrl.set(result.activationUrl);
          this.toast.show('Invitation reissued — copy the activation link below.', 'success');
        } else {
          this.toast.show(result.error ? `Email failed: ${result.error}` : 'Invitation sent.', 'warning');
        }
      },
      error: (error) => {
        this.busyTenantId.set(null);
        this.toast.show(error?.error?.title ?? 'Could not resend the invitation.', 'danger');
      },
    });
  }

  protected resendDetail(): void {
    const d = this.tenantDetail();
    if (!d) return;
    this.closeTenantDetail();
    this.resendTenant(d);
  }

  protected toggleTenantStatus(company: CompanyListItem): void {
    if (company.isDefault) {
      this.toast.show('The default company cannot be suspended.', 'warning');
      return;
    }

    const reactivating = company.status === 'Suspended';
    this.busyTenantId.set(company.id);
    const request = reactivating
      ? this.api.activateTenantCompany(company.id)
      : this.api.suspendTenantCompany(company.id);

    request.subscribe({
      next: () => {
        this.busyTenantId.set(null);
        this.toast.show(reactivating ? 'Company activated.' : 'Company suspended.', 'success');
        this.loadTenantCompanies();
      },
      error: (error) => {
        this.busyTenantId.set(null);
        this.toast.show(error?.error?.title ?? 'Action failed.', 'danger');
      },
    });
  }

  protected copyActivationLink(): void {
    const url = this.activationUrl();
    if (!url) return;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => this.toast.show('Activation link copied to clipboard.', 'success'))
      .catch(() => this.toast.show('Copy failed — select the link manually.', 'warning'));
  }

  protected dismissActivationLink(): void {
    this.activationUrl.set(null);
  }

  protected statusBadge(status: string): string {
    switch (status) {
      case 'Active': return 'badge-success';
      case 'Provisioning': return 'badge-warning';
      case 'Suspended': return 'badge-info';
      default: return 'badge-danger';
    }
  }

  protected inviteBadge(status: string): string {
    switch (status) {
      case 'Sent':
      case 'Accepted': return 'badge-success';
      case 'Pending': return 'badge-warning';
      case 'Failed': return 'badge-danger';
      default: return 'badge-info';
    }
  }

  private handleProvisioningResult(result: CompanyProvisioningResult): void {
    if (result.activationUrl) {
      this.activationUrl.set(result.activationUrl);
    }
    if (result.status === 'Failed' || result.error) {
      this.toast.show(`Provisioning failed: ${result.error ?? 'unknown error'}`, 'danger');
    } else {
      this.toast.show(`"${result.databaseName}" provisioned and ready.`, 'success');
    }
  }

  // --- Non-SuperAdmin Company Directory Filter & CRUD ---
  protected readonly filteredCompanies = computed(() => {
    return this.companies().filter((c) => {
      const matchName = !this.companyFilterName || c.name.toLowerCase().includes(this.companyFilterName.toLowerCase());
      const matchProp = !this.companyFilterProprietor || c.proprietor.toLowerCase().includes(this.companyFilterProprietor.toLowerCase());
      return matchName && matchProp;
    });
  });

  protected readonly filteredDepartments = computed(() => {
    return this.departments().filter((d) => {
      return !this.deptFilterName || d.name.toLowerCase().includes(this.deptFilterName.toLowerCase());
    });
  });

  protected readonly filteredDesignations = computed(() => {
    return this.designations().filter((ds) => {
      return !this.desigFilterName || ds.name.toLowerCase().includes(this.desigFilterName.toLowerCase());
    });
  });

  protected readonly filteredHolidays = computed(() => {
    return this.holidays().filter((h) => {
      return !this.holidayFilterName || h.name.toLowerCase().includes(this.holidayFilterName.toLowerCase());
    });
  });

  // Paginated slices
  protected readonly paginatedCompanies = computed(() => {
    const list = this.filteredCompanies();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  protected readonly paginatedDepartments = computed(() => {
    const list = this.filteredDepartments();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  protected readonly paginatedDesignations = computed(() => {
    const list = this.filteredDesignations();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  protected readonly paginatedHolidays = computed(() => {
    const list = this.filteredHolidays();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  protected currentTotalCount(): number {
    switch (this.activeTab()) {
      case 'directory': return this.filteredCompanies().length;
      case 'profile': return 1;
      case 'departments': return this.filteredDepartments().length;
      case 'designations': return this.filteredDesignations().length;
      case 'holiday': return this.filteredHolidays().length;
    }
  }

  protected currentStartIndex(): number {
    return (this.currentPage() - 1) * this.pageSize;
  }

  protected currentEndIndex(): number {
    const count = this.currentTotalCount();
    const end = this.currentStartIndex() + this.pageSize;
    return end > count ? count : end;
  }

  protected resetCompanyFilters(): void {
    this.companyFilterName = '';
    this.companyFilterProprietor = '';
  }

  protected openAddModal(): void {
    switch (this.activeTab()) {
      case 'directory':
        if (this.isSuperAdmin()) {
          this.openCreateTenant();
        } else {
          this.editingCompanyId.set(null);
          this.companyForm = {
            name: '',
            code: '',
            proprietor: '',
            brandName: '',
            contactEmail: '',
            contactNumber: '',
            addressLine1: '',
            addressLine2: '',
            timeZone: 'Asia/Dubai',
            registrationNumber: '',
          };
          this.showCompanyModal.set(true);
        }
        break;
      case 'departments':
        this.editingDeptId.set(null);
        this.deptForm = { name: '', code: '', description: '' };
        this.showDeptModal.set(true);
        break;
      case 'designations':
        this.editingDesigId.set(null);
        this.desigForm = { name: '', grade: '', department: '', description: '' };
        this.showDesigModal.set(true);
        break;
      case 'holiday':
        this.editingHolidayId.set(null);
        this.holidayForm = { name: '', date: new Date().toISOString().slice(0, 10), type: 'National' };
        this.showHolidayModal.set(true);
        break;
    }
  }

  // Company Actions (Non-Super Admin Directory)
  protected openEditCompany(c: CompanyRow): void {
    this.editingCompanyId.set(c.id);
    this.companyForm = {
      name: c.name,
      code: c.code,
      proprietor: c.proprietor,
      brandName: c.brandName || c.name,
      contactEmail: c.contactEmail || '',
      contactNumber: c.contactNumber || '',
      addressLine1: c.addressLine1 || '',
      addressLine2: c.addressLine2 || '',
      timeZone: c.timeZone || 'Asia/Dubai',
      registrationNumber: c.registrationNumber || '',
    };
    this.showCompanyModal.set(true);
  }

  protected saveCompany(): void {
    if (!this.companyForm.name || !this.companyForm.code) {
      this.toast.show('Please provide company name and code', 'danger');
      return;
    }
    const body = {
      companyName: this.companyForm.name.trim(),
      tradeLicense: this.companyForm.proprietor?.trim() || '',
      trn: this.companyForm.registrationNumber?.trim() || '',
      industry: '',
      foundedYear: 2024,
      website: '',
      address: this.companyForm.addressLine1?.trim() || '',
      city: '',
      country: '',
      phone: this.companyForm.contactNumber?.trim() || '',
      hrEmail: this.companyForm.contactEmail?.trim() || '',
      timeZone: this.companyForm.timeZone || 'Asia/Dubai',
      payrollCurrency: 'USD',
    };
    this.api.updateCompany(body).subscribe({
      next: () => {
        this.toast.show('Company settings saved successfully');
        this.loadBackendData();
        this.showCompanyModal.set(false);
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to update company settings', 'danger');
      },
    });
  }

  protected deleteCompany(id: string): void {
    if (!confirm('Are you sure you want to delete this company entry?')) {
      return;
    }
    this.api.deleteCompany(id).subscribe({
      next: () => {
        this.toast.show('Company entry removed');
        this.loadBackendData();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete company', 'danger');
      },
    });
  }

  // Department Actions
  protected openEditDepartment(d: DepartmentRow): void {
    this.editingDeptId.set(d.id);
    this.deptForm = { name: d.name, code: d.code, description: d.description || '' };
    this.showDeptModal.set(true);
  }

  protected saveDepartment(): void {
    if (!this.deptForm.name) {
      this.toast.show('Please enter department name', 'danger');
      return;
    }
    const name = this.deptForm.name.trim();
    const code = (this.deptForm.code || name.slice(0, 3)).trim().toUpperCase();
    const description = this.deptForm.description?.trim() || null;

    const editId = this.editingDeptId();
    if (editId && !editId.startsWith('d-')) {
      this.api.updateDepartment(editId, { name, code, description, isActive: true }).subscribe({
        next: () => {
          this.toast.show('Department updated successfully');
          this.loadBackendData();
          this.showDeptModal.set(false);
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to update department', 'danger');
        },
      });
    } else {
      this.api.createDepartment({ name, code, description, isActive: true }).subscribe({
        next: () => {
          this.toast.show('Department created successfully');
          this.loadBackendData();
          this.showDeptModal.set(false);
        },
        error: (err) => {
          this.toast.show(err?.error?.title ?? 'Failed to create department', 'danger');
        },
      });
    }
  }

  protected deleteDepartment(id: string): void {
    if (!confirm('Are you sure you want to delete this department?')) {
      return;
    }
    if (id.startsWith('d-')) {
      this.departments.update((list) => list.filter((d) => d.id !== id));
      this.toast.show('Department removed');
      return;
    }
    this.api.deleteDepartment(id).subscribe({
      next: () => {
        this.toast.show('Department deleted successfully');
        this.loadBackendData();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete department', 'danger');
      },
    });
  }

  // Designation Actions
  protected openEditDesignation(ds: DesignationRow): void {
    this.editingDesigId.set(ds.id);
    this.desigForm = {
      name: ds.name,
      grade: ds.grade || '',
      department: ds.department || '',
      description: ds.description || '',
    };
    this.showDesigModal.set(true);
  }

  protected saveDesignation(): void {
    if (!this.desigForm.name) {
      this.toast.show('Please enter designation name', 'danger');
      return;
    }
    const name = this.desigForm.name.trim();
    const grade = (this.desigForm.grade || 'L1').trim().slice(0, 10);
    const dept = this.departments().find((d) => d.name === this.desigForm.department);
    const departmentId = dept?.id && !dept.id.startsWith('d-') ? dept.id : null;
    const description = this.desigForm.description?.trim() || null;

    const editId = this.editingDesigId();
    const req$ = editId && !editId.startsWith('ds-')
      ? this.api.updateDesignation(editId, { name, grade, departmentId, description })
      : this.api.createDesignation({ name, grade, departmentId, description });

    req$.subscribe({
      next: () => {
        this.toast.show(editId && !editId.startsWith('ds-') ? 'Designation updated successfully' : 'Designation created successfully');
        this.loadBackendData();
        this.showDesigModal.set(false);
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to save designation', 'danger');
      },
    });
  }

  protected deleteDesignation(id: string): void {
    if (!confirm('Are you sure you want to delete this designation?')) {
      return;
    }
    if (id.startsWith('ds-')) {
      this.designations.update((list) => list.filter((ds) => ds.id !== id));
      this.toast.show('Designation removed');
      return;
    }
    this.api.deleteDesignation(id).subscribe({
      next: () => {
        this.toast.show('Designation removed');
        this.loadBackendData();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete designation', 'danger');
      },
    });
  }

  // Holiday Actions
  protected openEditHoliday(h: HolidayRow): void {
    this.editingHolidayId.set(h.id);
    this.holidayForm = { name: h.name, date: h.date, type: h.type };
    this.showHolidayModal.set(true);
  }

  protected saveHoliday(): void {
    if (!this.holidayForm.name || !this.holidayForm.date) {
      this.toast.show('Please enter holiday name and date', 'danger');
      return;
    }
    let type = this.holidayForm.type || 'National';
    if (type === 'Public' || type === 'Company') type = 'National';
    const body = {
      name: this.holidayForm.name.trim(),
      date: this.holidayForm.date,
      type,
    };

    const editId = this.editingHolidayId();
    const req$ = editId && !editId.startsWith('h-')
      ? this.api.updateHoliday(editId, body)
      : this.api.createHoliday(body);

    req$.subscribe({
      next: () => {
        this.toast.show(editId && !editId.startsWith('h-') ? 'Holiday updated successfully' : 'Holiday created successfully');
        this.loadBackendData();
        this.showHolidayModal.set(false);
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to save holiday', 'danger');
      },
    });
  }

  protected deleteHoliday(id: string): void {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }
    if (id.startsWith('h-')) {
      this.holidays.update((list) => list.filter((h) => h.id !== id));
      this.toast.show('Holiday removed');
      return;
    }
    this.api.deleteHoliday(id).subscribe({
      next: () => {
        this.toast.show('Holiday removed');
        this.loadBackendData();
      },
      error: (err) => {
        this.toast.show(err?.error?.title ?? 'Failed to delete holiday', 'danger');
      },
    });
  }

  private loadBackendData(): void {
    if (!this.isSuperAdmin()) {
      this.api.company().subscribe({
        next: (comp) => {
          if (comp) {
            this.companies.set([
              {
                id: 'curr-1',
                srNo: 1,
                companyLogo: '',
                name: comp.companyName || this.session.user()?.companyName || 'My Company',
                code: this.session.user()?.companyCode || 'COMP',
                brandName: comp.companyName,
                proprietor: comp.tradeLicense || 'Admin',
                contactEmail: comp.hrEmail || '',
                contactNumber: comp.phone || '',
                addressLine1: comp.address ? `${comp.address}, ${comp.city}` : '',
                timeZone: 'Asia/Dubai',
                registrationNumber: comp.trn || comp.tradeLicense || '',
              },
            ]);
          } else {
            this.companies.set([]);
          }
        },
        error: () => {},
      });
    }

    this.api.departments().subscribe({
      next: (list) => {
        this.departments.set(
          (list || []).map((d, i) => ({
            id: d.id,
            srNo: i + 1,
            name: d.name,
            code: d.code,
            employeeCount: d.employeeCount || 0,
            description: d.description || '',
          }))
        );
      },
      error: () => {},
    });

    this.api.designations().subscribe({
      next: (list) => {
        this.designations.set(
          (list || []).map((ds, i) => ({
            id: ds.id,
            srNo: i + 1,
            name: ds.name,
            employeeCount: ds.employeeCount || 0,
            grade: ds.grade,
            department: ds.department || '',
            description: ds.description || '',
          }))
        );
      },
      error: () => {},
    });

    this.api.holidays().subscribe({
      next: (list) => {
        this.holidays.set(
          (list || []).map((h, i) => ({
            id: h.id,
            srNo: i + 1,
            name: h.name,
            date: h.date,
            dayLabel: h.dayLabel,
            type: h.type,
          }))
        );
      },
      error: () => {},
    });
  }
}
