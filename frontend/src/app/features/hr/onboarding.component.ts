import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EnrolledFace } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { FaceRecognitionService } from '../../core/services/face-recognition.service';
import { ToastService } from '../../core/services/toast.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { KeyGroupSelectComponent } from '../../shared/key-select.component';

interface AccountItem {
  l: string;
  d: string;
  done: boolean;
}

/**
 * Employee Onboarding wizard — ported from pages/onboarding.html. Six steps
 * (Personal → Job → Salary → Documents → Account → Review) with a live stepper,
 * progress bar and a review screen. Bootstrap's grid is replaced by local CSS grid.
 */
@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, IconDirective, SelectComponent, KeyGroupSelectComponent],
  template: `
    <div style="margin-bottom: 16px">
      <div class="page-title">Employee Onboarding</div>
      <div class="page-subtitle">New hire setup wizard</div>
    </div>

    <!-- Stepper -->
    <div class="ob-stepper">
      @for (s of steps; track s.label; let i = $index) {
        <div class="ob-step" [class.done]="i < step()" [class.active]="i === step()">
          <div class="ob-circle">
            @if (i < step()) {
              <span [appIcon]="'check'"></span>
            } @else {
              {{ i + 1 }}
            }
          </div>
          <div class="ob-label">{{ s.label }}</div>
        </div>
      }
    </div>

    <!-- Progress -->
    <div class="progress" style="margin-bottom: 24px; height: 4px">
      <div class="progress-bar" [style.width.%]="progress()"></div>
    </div>

    <!-- Card -->
    <div class="ob-card">
      <div class="ob-card-header">
        <div class="ob-card-icon"><span [appIcon]="steps[step()].icon"></span></div>
        <div>
          <div class="ob-card-title">{{ step() === 0 ? 'Personal Details' : steps[step()].label }}</div>
          <div class="ob-card-sub">{{ subtitles[step()] }}</div>
        </div>
      </div>

      <div class="ob-card-body">
        <!-- STEP 0: PERSONAL -->
        @if (step() === 0) {
          <div class="photo-banner">
            <div class="photo-avatar" style="overflow: hidden;">
              @if (enrolledFacePhoto()) {
                <img [src]="enrolledFacePhoto()" style="width: 100%; height: 100%; object-fit: cover;" alt="Employee Face Photo" />
              } @else {
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--p)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text); margin-bottom: 2px">Profile Photo &amp; Face Biometrics</div>
              <div style="color: #6b7280; margin-bottom: 10px">
                {{ isFaceEnrolled() ? '✅ Face Biometrics Captured (Ready for instant Clock In & Login)' : 'Register facial biometric identity now for automated face recognition & attendance.' }}
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" (click)="openFaceModal()">
                  📸 {{ isFaceEnrolled() ? 'Re-scan Face ID' : 'Scan & Register Face ID' }}
                </button>
                <button type="button" class="btn btn-outline btn-sm" (click)="toast.show('Upload dialog opened')">Upload File</button>
              </div>
            </div>
          </div>

          <div class="ob-grid ob-grid-4">
            <div class="form-group">
              <label class="form-label">First Name<span class="req">*</span></label>
              <input class="form-control" placeholder="Alex" [value]="personal().firstName" (input)="patchP('firstName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Middle Name<span class="req">*</span></label>
              <input class="form-control" placeholder="Alex" [value]="personal().middleName" (input)="patchP('middleName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Last Name<span class="req">*</span></label>
              <input class="form-control" placeholder="Morgan" [value]="personal().lastName" (input)="patchP('lastName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address<span class="req">*</span></label>
              <input class="form-control" type="email" placeholder="alex.morgan@company.com" [value]="personal().email" (input)="patchP('email', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number<span class="req">*</span></label>
              <input class="form-control" placeholder="+1 (555) 123-4567" [value]="personal().phone" (input)="patchP('phone', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of Birth</label>
              <input class="form-control" type="date" [value]="personal().dob" (input)="patchP('dob', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <app-key-select groupCode="GENDER" [value]="personal().gender" (valueChange)="patchP('gender', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Marital Status</label>
              <app-key-select groupCode="MARITAL_STATUS" [value]="personal().maritalStatus" (valueChange)="patchP('maritalStatus', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Blood Group</label>
              <app-key-select groupCode="BLOOD_GROUP" [value]="personal().bloodGroup" (valueChange)="patchP('bloodGroup', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">City</label>
              <input class="form-control" placeholder="San Francisco" [value]="personal().city" (input)="patchP('city', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">State</label>
              <input class="form-control" placeholder="CA" [value]="personal().state" (input)="patchP('state', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Country</label>
              <input class="form-control" placeholder="USA" [value]="personal().country" (input)="patchP('country', $any($event.target).value)" />
            </div>
            <div class="form-group" style="grid-column: 1/-1">
              <label class="form-label">Residential Address</label>
              <textarea class="form-control" rows="3" placeholder="123 Innovation Drive, Apt 4B" [value]="personal().address" (input)="patchP('address', $any($event.target).value)"></textarea>
            </div>
          </div>
        }

        <!-- STEP 1: JOB -->
        @if (step() === 1) {
          <div class="ob-grid ob-grid-3">
            <div class="form-group">
              <label class="form-label">Job Title<span class="req">*</span></label>
              <input class="form-control" placeholder="Software Engineer" [value]="job().jobTitle" (input)="patchJ('jobTitle', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Designation</label>
              <app-select [options]="designationOptions()" [value]="job().designationId" (valueChange)="patchJ('designationId', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Department<span class="req">*</span></label>
              <app-select [options]="deptOptions()" [value]="job().department" (valueChange)="patchJ('department', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Grade</label>
              <app-key-select groupCode="GRADE_LEVEL" [value]="job().grade" (valueChange)="patchJ('grade', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Join Date<span class="req">*</span></label>
              <input class="form-control" type="date" [value]="job().joinDate" (input)="patchJ('joinDate', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Employment Type</label>
              <app-key-select groupCode="EMPLOYMENT_TYPE" [value]="job().employmentType" (valueChange)="patchJ('employmentType', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Reporting Manager</label>
              <app-select [options]="managerOptions()" [value]="job().reportingManager" (valueChange)="patchJ('reportingManager', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Work Location</label>
              <input class="form-control" placeholder="Dubai HQ" [value]="job().workLocation" (input)="patchJ('workLocation', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Shift</label>
              <app-select [options]="shiftOptions" [value]="job().shift" (valueChange)="patchJ('shift', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Notice Period</label>
              <input class="form-control" placeholder="30 days" [value]="job().noticePeriod" (input)="patchJ('noticePeriod', $any($event.target).value)" />
            </div>
          </div>
        }

        <!-- STEP 2: SALARY -->
        @if (step() === 2) {
          <div class="ob-grid ob-grid-3">
            <div class="form-group">
              <label class="form-label">Basic Salary<span class="req">*</span></label>
              <input class="form-control" placeholder="$0.00" [value]="salary().basicSalary" (input)="patchS('basicSalary', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Housing Allowance</label>
              <input class="form-control" placeholder="$0.00" [value]="salary().housingAllowance" (input)="patchS('housingAllowance', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Transport Allowance</label>
              <input class="form-control" placeholder="$0.00" [value]="salary().transportAllowance" (input)="patchS('transportAllowance', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Allowance</label>
              <input class="form-control" placeholder="$0.00" [value]="salary().mobileAllowance" (input)="patchS('mobileAllowance', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Other Allowances</label>
              <input class="form-control" placeholder="$0.00" [value]="salary().otherAllowances" (input)="patchS('otherAllowances', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode</label>
              <app-key-select groupCode="PAYMENT_MODE" [value]="salary().paymentMode" (valueChange)="patchS('paymentMode', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input class="form-control" placeholder="Emirates NBD" [value]="salary().bankName" (input)="patchS('bankName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Account Number</label>
              <input class="form-control" placeholder="1234567890" [value]="salary().accountNumber" (input)="patchS('accountNumber', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">IBAN</label>
              <input class="form-control" placeholder="AE07 0331 2345 6789 0123 456" [value]="salary().iban" (input)="patchS('iban', $any($event.target).value)" />
            </div>
          </div>
        }

        <!-- STEP 3: DOCUMENTS -->
        @if (step() === 3) {
          <div style="display: flex; flex-direction: column">
            @for (d of docNames; track d) {
              <div class="doc-row">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0">
                  <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 8px; background: var(--p-soft); display: flex; align-items: center; justify-content: center; color: var(--p)">
                    <span [appIcon]="'documents'"></span>
                  </div>
                  <div style="min-width: 0">
                    <div class="doc-label" style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ d }}</div>
                    <div class="doc-label" style="color: var(--muted); white-space: nowrap">PDF, JPG up to 10MB</div>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm doc-upload-btn" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0" (click)="uploadDoc(d)">
                  <span [appIcon]="'upload2'"></span>
                  <span class="doc-upload-text">{{ uploaded().has(d) ? 'Uploaded' : 'Upload' }}</span>
                </button>
              </div>
            }
          </div>
        }

        <!-- STEP 4: ACCOUNT -->
        @if (step() === 4) {
          <div style="display: flex; flex-direction: column; gap: 16px">
            <div style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; padding: 18px">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px">
                <span [appIcon]="'lock'" style="color: var(--p)"></span> Employee Portal Login Credentials
              </div>
              <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px">
                Configure login access so the employee can immediately log in to their dedicated portal.
              </div>

              <div class="ob-grid ob-grid-3">
                <div class="form-group">
                  <label class="form-label">Login Email<span class="req">*</span></label>
                  <input
                    class="form-control"
                    [value]="personal().email"
                    readonly
                    style="background: var(--bg); cursor: not-allowed; font-weight: 500"
                    placeholder="email@company.com"
                  />
                  <div style="font-size: 11px; color: var(--muted); margin-top: 4px">Auto-filled from personal details</div>
                </div>

                <div class="form-group">
                  <label class="form-label">Account Password<span class="req">*</span></label>
                  <div style="position: relative; display: flex; align-items: center">
                    <input
                      class="form-control"
                      [type]="showPassword() ? 'text' : 'password'"
                      placeholder="Enter minimum 6 characters"
                      [value]="accountForm().password"
                      (input)="patchAccount('password', $any($event.target).value)"
                      style="padding-right: 40px"
                    />
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      style="position: absolute; right: 4px; padding: 4px 6px; color: var(--muted); height: 28px"
                      (click)="showPassword.set(!showPassword())"
                      [title]="showPassword() ? 'Hide password' : 'Show password'"
                    >
                      <span [appIcon]="showPassword() ? 'eye' : 'lock'"></span>
                    </button>
                  </div>
                  <div style="font-size: 11px; color: var(--muted); margin-top: 4px">Employee will use this password to sign in</div>
                </div>

                <div class="form-group">
                  <label class="form-label">System Role<span class="req">*</span></label>
                  <app-select
                    [options]="roleOptions"
                    [value]="accountForm().role"
                    (valueChange)="patchAccount('role', $event)"
                    width="100%"
                  />
                  <div style="font-size: 11px; color: var(--muted); margin-top: 4px">Grants employee access permissions</div>
                </div>
              </div>
            </div>

            <!-- Face Biometric Authentication (Add Face) Card -->
            <div style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; padding: 18px">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--text)">
                  <span [appIcon]="'camera'" style="color: var(--p)"></span> Face ID Biometric Authentication
                </div>
                @if (isFaceEnrolled()) {
                  <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 4px 10px; font-size: 12px">
                    <span [appIcon]="'check'"></span> Face ID Enrolled
                  </span>
                } @else {
                  <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 4px 10px; font-size: 12px">
                    Pending Face Registration
                  </span>
                }
              </div>

              <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5">
                Register employee facial biometrics to enable 1-second passwordless sign-in and automated facial Clock In / Clock Out.
              </div>

              @if (isFaceEnrolled()) {
                <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap">
                  <div style="display: flex; align-items: center; gap: 14px">
                    @if (enrolledFacePhoto()) {
                      <img [src]="enrolledFacePhoto()" alt="Enrolled Face" style="width: 58px; height: 58px; border-radius: 12px; object-fit: cover; border: 2.5px solid var(--success); box-shadow: 0 4px 12px rgba(16,185,129,0.25)" />
                    } @else {
                      <div style="width: 58px; height: 58px; border-radius: 12px; background: rgba(16,185,129,0.15); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 24px">
                        <span [appIcon]="'shield'"></span>
                      </div>
                    }
                    <div>
                      <div style="font-size: 13.5px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px">
                        <span>Biometric Descriptor Ready</span>
                        <span style="font-size: 11px; background: rgba(16,185,129,0.15); color: var(--success); padding: 2px 8px; border-radius: 4px; font-weight: 600">128D Neural AI</span>
                      </div>
                      <div style="font-size: 12px; color: var(--muted); margin-top: 3px">
                        Facial signature verified &amp; ready for instant attendance punching and secure portal login.
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 10px">
                    <button type="button" class="btn btn-outline btn-sm" (click)="openFaceModal()" style="display: inline-flex; align-items: center; gap: 6px">
                      <span [appIcon]="'camera'"></span> Re-scan Face
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="removeEnrolledFace()" style="color: var(--danger); display: inline-flex; align-items: center; gap: 6px">
                      <span [appIcon]="'trash'"></span> Remove
                    </button>
                  </div>
                </div>
              } @else {
                <div style="background: var(--bg); border: 1.5px dashed var(--border); border-radius: 8px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap">
                  <div style="display: flex; align-items: center; gap: 14px">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--p-soft); color: var(--p); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
                      <span [appIcon]="'camera'"></span>
                    </div>
                    <div>
                      <div style="font-size: 13.5px; font-weight: 600; color: var(--text)">No Face Biometrics Enrolled</div>
                      <div style="font-size: 12px; color: var(--muted); margin-top: 2px">
                        Capture the employee's face using webcam to enable touchless Face ID verification.
                      </div>
                    </div>
                  </div>

                  <button type="button" class="btn btn-primary" (click)="openFaceModal()" style="display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(59,130,246,0.25)">
                    <span [appIcon]="'camera'"></span> 📸 Add Face
                  </button>
                </div>
              }
            </div>

            <!-- Provisioning Checklist -->
            <div style="display: flex; flex-direction: column; gap: 8px">
              <div style="font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 2px">Provisioning Checklist</div>
              <div class="sys-row done">
                <div style="display: flex; align-items: center; gap: 10px">
                  <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(5,150,105,.1); color: var(--success)">
                    <span [appIcon]="'check'"></span>
                  </div>
                  <div>
                    <div class="sys-label" style="font-weight: 600">Company Email Identity</div>
                    <div class="sys-label" style="color: var(--muted)">{{ personal().email || 'Pending personal details' }}</div>
                  </div>
                </div>
                <span class="badge badge-success" style="display: flex; align-items: center; gap: 4px">✓ Ready</span>
              </div>

              <div class="sys-row" [class.done]="systemAccessDone()">
                <div style="display: flex; align-items: center; gap: 10px">
                  <div
                    style="width: 32px; height: 32px; min-width: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center"
                    [style.background]="systemAccessDone() ? 'rgba(5,150,105,.1)' : 'var(--p-soft)'"
                    [style.color]="systemAccessDone() ? 'var(--success)' : 'var(--p)'"
                  >
                    <span [appIcon]="systemAccessDone() ? 'check' : 'lock'"></span>
                  </div>
                  <div>
                    <div class="sys-label" style="font-weight: 600">HRMS Portal Access</div>
                    <div class="sys-label" style="color: var(--muted)">
                      {{ systemAccessDone() ? 'Password configured (' + accountForm().role + ' role)' : 'Password required to enable login' }}
                    </div>
                  </div>
                </div>
                <span class="badge" [class]="systemAccessDone() ? 'badge-success' : 'badge-warning'" style="display: flex; align-items: center; gap: 4px">
                  {{ systemAccessDone() ? '✓ Ready' : 'Password Needed' }}
                </span>
              </div>

              <div class="sys-row" [class.done]="isFaceEnrolled()">
                <div style="display: flex; align-items: center; gap: 10px">
                  <div
                    style="width: 32px; height: 32px; min-width: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center"
                    [style.background]="isFaceEnrolled() ? 'rgba(5,150,105,.1)' : 'var(--p-soft)'"
                    [style.color]="isFaceEnrolled() ? 'var(--success)' : 'var(--p)'"
                  >
                    <span [appIcon]="isFaceEnrolled() ? 'check' : 'shield'"></span>
                  </div>
                  <div>
                    <div class="sys-label" style="font-weight: 600">Face Biometric Identity</div>
                    <div class="sys-label" style="color: var(--muted)">
                      {{ isFaceEnrolled() ? '128D Deep AI Embedding active for automated Login & Clock In/Out' : 'Webcam scan required for biometric attendance' }}
                    </div>
                  </div>
                </div>
                @if (isFaceEnrolled()) {
                  <span class="badge badge-success" style="display: flex; align-items: center; gap: 4px">✓ Enrolled</span>
                } @else {
                  <button type="button" class="btn btn-outline btn-sm" (click)="openFaceModal()">📸 Add Face</button>
                }
              </div>

              <div class="sys-row">
                <div style="display: flex; align-items: center; gap: 10px">
                  <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--p-soft); color: var(--p)">
                    <span [appIcon]="'settings'"></span>
                  </div>
                  <div>
                    <div class="sys-label" style="font-weight: 600">IT Equipment</div>
                    <div class="sys-label" style="color: var(--muted)">Assign workstation and hardware during first day</div>
                  </div>
                </div>
                <span class="badge badge-warning">On-site</span>
              </div>
            </div>
          </div>
        }

        <!-- STEP 5: REVIEW / SUCCESS -->
        @if (step() === 5) {
          @if (submitted()) {
            <div class="review-card" style="text-align: center; padding: 48px 20px">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--p); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #fff">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 8px">Onboarding Complete!</div>
              <div style="color: var(--muted); margin-bottom: 6px">
                <strong>{{ reviewName() }}</strong> has been successfully registered.
              </div>
              <div style="color: var(--text); font-weight: 600; margin-bottom: 4px">
                Login Account Active: <span style="color: var(--p)">{{ reviewEmail() }}</span>
              </div>
              <div style="color: var(--muted); font-size: 13px; margin-bottom: 28px">
                The employee can now immediately sign in at the login page using their email and the configured password.
              </div>
              <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap">
                <button class="btn btn-outline" (click)="restart()">Onboard Another</button>
                <button class="btn btn-primary" (click)="goEmployees()">View Employees Directory</button>
              </div>
            </div>
          } @else {
            <div style="display: flex; flex-direction: column; gap: 10px">
              <div style="border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden">
                <div style="background: var(--p-soft); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between">
                  <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text)">
                    <span [appIcon]="'user'"></span> Personal Information
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="step.set(0)">Edit</button>
                </div>
                <div class="ob-grid ob-grid-3" style="padding: 11px">
                  @for (f of personalReview; track f[1]) {
                    <div>
                      <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">{{ f[0] }}</div>
                      <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ value(personal()[f[1]]) }}</div>
                    </div>
                  }
                  <div style="grid-column: 1/-1">
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">Residential Address</div>
                    <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ value(personal().address) }}</div>
                  </div>
                </div>
              </div>

              <div style="border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden">
                <div style="background: var(--p-soft); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between">
                  <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text)">
                    <span [appIcon]="'employees'"></span> Job Details
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="step.set(1)">Edit</button>
                </div>
                <div class="ob-grid ob-grid-3" style="padding: 11px">
                  @for (f of jobReview; track f[1]) {
                    <div>
                      <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">{{ f[0] }}</div>
                      <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ value(job()[f[1]]) }}</div>
                    </div>
                  }
                </div>
              </div>

              <div style="border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden">
                <div style="background: var(--p-soft); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between">
                  <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text)">
                    <span [appIcon]="'payroll'"></span> Salary &amp; Bank
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="step.set(2)">Edit</button>
                </div>
                <div class="ob-grid ob-grid-3" style="padding: 11px">
                  @for (f of salaryReview; track f[1]) {
                    <div>
                      <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">{{ f[0] }}</div>
                      <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ value(salary()[f[1]]) }}</div>
                    </div>
                  }
                </div>
              </div>

              <div style="border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden">
                <div style="background: var(--p-soft); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between">
                  <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text)">
                    <span [appIcon]="'documents'"></span> Documents
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="step.set(3)">Edit</button>
                </div>
                <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px">
                  @for (name of docNames; track name) {
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
                      <div style="display: flex; align-items: center; gap: 8px">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: var(--p-soft); display: flex; align-items: center; justify-content: center; color: var(--p); flex-shrink: 0">
                          <span [appIcon]="'documents'"></span>
                        </div>
                        <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ name }}</div>
                      </div>
                      <span class="badge" [class]="uploaded().has(name) ? 'badge-success' : 'badge-warning'">
                        {{ uploaded().has(name) ? '✓ Uploaded' : 'Pending' }}
                      </span>
                    </div>
                  }
                </div>
              </div>

              <div style="border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden">
                <div style="background: var(--p-soft); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between">
                  <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text)">
                    <span [appIcon]="'lock'"></span> Account &amp; Login Access
                  </div>
                  <button class="btn btn-outline btn-sm" (click)="step.set(4)">Edit</button>
                </div>
                <div class="ob-grid ob-grid-3" style="padding: 12px">
                  <div>
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">Login Email</div>
                    <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ value(personal().email) }}</div>
                  </div>
                  <div>
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">Initial Password</div>
                    <div style="font-size: 13px; font-weight: 600; color: var(--text)">
                      {{ accountForm().password ? '•••••••• (' + accountForm().password.length + ' chars)' : 'Not set' }}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">System Role</div>
                    <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ accountForm().role }}</div>
                  </div>
                  <div>
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 2px">Face Biometrics</div>
                    <div style="font-size: 13px; font-weight: 700;" [style.color]="isFaceEnrolled() ? 'var(--success)' : 'var(--warning)'">
                      {{ isFaceEnrolled() ? '✅ Enrolled (128D AI Biometric)' : '⚠️ Not enrolled' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </div>

      @if (step() < 5 || !submitted()) {
        <div class="ob-card-footer">
          <div style="font-size: 13px; color: var(--muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ subtitles[step()] }}
          </div>
          <div style="display: flex; gap: 10px; flex-shrink: 0">
            @if (step() > 0) {
              <button class="btn btn-outline" style="display: flex; align-items: center; gap: 6px" (click)="back()">
                <span [appIcon]="'chevron'"></span> Back
              </button>
            }
            <button class="btn btn-primary" style="display: flex; align-items: center; gap: 6px" (click)="next()">
              {{ step() === 5 ? 'Submit & Complete' : 'Next' }} <span [appIcon]="'arrow_right'"></span>
            </button>
          </div>
        </div>
      }
    </div>

    <!-- Onboarding Face Enrollment Modal -->
    @if (showFaceModal()) {
      <div class="face-modal-backdrop" (click)="closeFaceModal()">
        <div class="face-modal-card" (click)="$event.stopPropagation()">
          <div class="face-modal-header">
            <div class="face-header-icon">
              <span [appIcon]="'shield'"></span>
            </div>
            <div class="face-header-info">
              <h3 class="face-header-title">📸 Onboarding Face Registration</h3>
              <div class="face-header-sub">
                <span>{{ personal().firstName || 'New' }} {{ personal().lastName || 'Hire' }}</span>
                <span class="emp-badge">Biometric Enrollment</span>
              </div>
            </div>
            <button class="face-close-btn" (click)="closeFaceModal()"><span [appIcon]="'x'"></span></button>
          </div>

          <div class="face-viewport-wrap">
            <div class="face-viewport">
              <video #obFaceVideo class="face-video" playsinline muted autoplay [class.active]="cameraActive()"></video>
              <canvas #obFaceCanvas class="face-canvas"></canvas>

              @if (!cameraActive() || faceService.loadingModels()) {
                <div class="face-camera-loading">
                  <div class="face-spinner"></div>
                  <div class="face-loading-text">
                    {{ faceService.loadingModels() ? 'Loading AI Face Neural Networks…' : 'Starting camera feed…' }}
                  </div>
                </div>
              }

              <div class="face-hud-reticle" [class.scanning]="faceCapturing()" [class.matched]="isFaceEnrolled()">
                <div class="reticle-corner tl"></div>
                <div class="reticle-corner tr"></div>
                <div class="reticle-corner bl"></div>
                <div class="reticle-corner br"></div>
                <div class="reticle-laser" [class.active]="faceCapturing()"></div>
              </div>
            </div>
          </div>

          <div class="face-status-banner">
            <div class="status-text">{{ faceModalMsg() }}</div>
          </div>

          <div class="face-modal-footer">
            <button class="btn btn-outline" (click)="closeFaceModal()">Cancel</button>
            <button
              class="btn btn-primary"
              style="flex: 1"
              [disabled]="faceCapturing() || !cameraActive()"
              (click)="captureFaceBiometrics()"
            >
              @if (faceCapturing()) {
                <span class="face-spinner-sm"></span> Analyzing &amp; Enrolling…
              } @else {
                📸 Capture &amp; Enroll Face ID
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .ob-stepper {
        display: flex;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .ob-step {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        position: relative;
      }
      .ob-step:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 17px;
        left: calc(50% + 22px);
        right: calc(-50% + 22px);
        height: 2px;
        background: var(--border);
        z-index: 0;
        transition: background 0.3s;
      }
      .ob-step.done:not(:last-child)::after {
        background: var(--p);
      }
      .ob-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.82rem;
        font-weight: 700;
        border: 2px solid var(--border);
        background: var(--surface);
        color: var(--muted);
        z-index: 1;
        transition: all 0.3s;
        position: relative;
      }
      .ob-step.done .ob-circle {
        background: var(--p);
        border-color: var(--p);
        color: #fff;
      }
      .ob-step.active .ob-circle {
        background: var(--surface);
        border-color: var(--p);
        color: var(--p);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
      }
      .ob-label {
        font-size: 13px;
        font-weight: 600;
        margin-top: 6px;
        color: var(--muted);
        text-align: center;
        white-space: nowrap;
      }
      .ob-step.active .ob-label {
        color: var(--p);
        font-weight: 700;
      }
      .ob-step.done .ob-label {
        color: var(--text);
      }
      .ob-card {
        background: var(--surface);
        border-radius: 10px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .ob-card-header {
        padding: 10px 15px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 16px;
        background: var(--p-soft);
      }
      .ob-card-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: var(--p);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        flex-shrink: 0;
      }
      .ob-card-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text);
      }
      .ob-card-sub {
        font-size: 13px;
        color: var(--muted);
        margin-top: 2px;
      }
      .ob-card-body {
        padding: 15px;
        max-height: calc(100vh - 372px);
        overflow-y: auto;
      }
      .ob-card-footer {
        padding: 10px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--bg);
      }
      .photo-banner {
        background: var(--p-soft);
        border-radius: 14px;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
      }
      .photo-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid var(--p-mid);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .req {
        color: #ef4444;
        margin-left: 2px;
      }
      .doc-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        transition: 0.2s;
        gap: 8px;
        margin-bottom: 8px;
      }
      .doc-row:hover {
        border-color: var(--p);
        background: rgba(37, 99, 235, 0.02);
      }
      .sys-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        gap: 8px;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        margin-bottom: 8px;
      }
      .sys-label,
      .doc-label {
        font-size: 13px;
      }
      .sys-row.done {
        border-color: rgba(5, 150, 105, 0.3);
        background: rgba(5, 150, 105, 0.03);
      }
      .form-group {
        margin-bottom: 0;
      }
      .ob-grid {
        display: grid;
        gap: 12px;
      }
      .ob-grid-3 {
        grid-template-columns: repeat(3, 1fr);
      }
      .ob-grid-4 {
        grid-template-columns: repeat(4, 1fr);
      }
      @media (max-width: 1200px) {
        .ob-grid-4 {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 900px) {
        .ob-grid-3,
        .ob-grid-4 {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 768px) {
        .ob-card-body {
          max-height: calc(100vh - 340px);
        }
      }
      @media (max-width: 600px) {
        .ob-label {
          font-size: 12px;
        }
        .ob-circle {
          width: 28px;
          height: 28px;
          font-size: 12px;
        }
        .ob-step:not(:last-child)::after {
          top: 13px;
          left: calc(50% + 16px);
          right: calc(-50% + 16px);
        }
        .ob-card-header {
          gap: 10px;
        }
        .ob-card-title {
          font-size: 0.9rem;
        }
        .ob-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
        }
        .photo-banner {
          padding: 14px;
          gap: 12px;
        }
      }
      @media (max-width: 480px) {
        .ob-grid-3,
        .ob-grid-4 {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 400px) {
        .ob-label {
          display: none;
        }
        .ob-circle {
          width: 26px;
          height: 26px;
        }
        .ob-step:not(:last-child)::after {
          top: 12px;
          left: calc(50% + 14px);
          right: calc(-50% + 14px);
        }
        .ob-card-body {
          padding: 10px;
        }
        .face-modal-backdrop {
          position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center;
          background: rgba(8, 12, 24, 0.85); backdrop-filter: blur(12px); padding: 16px;
        }
        .face-modal-card {
          width: 100%; max-width: 480px; background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 18px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8); overflow: hidden; color: #f8fafc;
        }
        .face-modal-header {
          padding: 16px 20px 12px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .face-header-icon {
          width: 40px; height: 40px; border-radius: 10px; background: rgba(37,99,235,0.2);
          display: flex; align-items: center; justify-content: center; color: #60a5fa;
        }
        .face-header-info { flex: 1; }
        .face-header-title { font-size: 15px; font-weight: 700; color: #fff; margin: 0; }
        .face-header-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .face-close-btn {
          width: 30px; height: 30px; border-radius: 6px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer;
        }
        .face-viewport-wrap { padding: 14px 18px; background: #0b1120; }
        .face-viewport {
          position: relative; width: 100%; height: 260px; border-radius: 12px; overflow: hidden; background: #020617;
        }
        .face-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block; }
        .face-canvas { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; z-index: 2; }
        .face-camera-loading {
          position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(2,6,23,0.92); gap: 8px; font-size: 12px; color: #e2e8f0;
        }
        .face-spinner { width: 32px; height: 32px; border: 3px solid rgba(59,130,246,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .face-spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .face-hud-reticle {
          position: absolute; top: 12%; left: 20%; right: 20%; bottom: 18%; border: 1.5px dashed rgba(59,130,246,0.5);
          border-radius: 20px; pointer-events: none; z-index: 3;
        }
        .reticle-corner { position: absolute; width: 12px; height: 12px; border: 2.5px solid #60a5fa; }
        .reticle-corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; border-top-left-radius: 6px; }
        .reticle-corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; border-top-right-radius: 6px; }
        .reticle-corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; border-bottom-left-radius: 6px; }
        .reticle-corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; border-bottom-right-radius: 6px; }
        .reticle-laser {
          position: absolute; left: 0; right: 0; height: 2px; background: #38bdf8; box-shadow: 0 0 10px #38bdf8; opacity: 0;
        }
        .reticle-laser.active { opacity: 1; animation: laserSweep 1.5s ease-in-out infinite alternate; }
        .face-status-banner {
          margin: 10px 18px; padding: 8px 12px; border-radius: 8px; background: rgba(30,41,59,0.7);
          border: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #cbd5e1;
        }
        .face-modal-footer {
          padding: 12px 18px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 10px;
        }
      }
    `,
  ],
})
export class OnboardingComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);
  protected readonly faceService = inject(FaceRecognitionService);

  @ViewChild('obFaceVideo') private obFaceVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('obFaceCanvas') private obFaceCanvasRef?: ElementRef<HTMLCanvasElement>;
  private obMediaStream?: MediaStream;

  protected readonly showFaceModal = signal(false);
  protected readonly cameraActive = signal(false);
  protected readonly faceCapturing = signal(false);
  protected readonly enrolledFaceDescriptor = signal<number[] | null>(null);
  protected readonly enrolledFacePhoto = signal<string | null>(null);
  protected readonly isFaceEnrolled = computed(() => this.enrolledFaceDescriptor() !== null);
  protected readonly faceModalMsg = signal('Align face within the frame and click Capture Face');

  private departmentIds = new Map<string, string>();
  protected readonly deptOptions = signal<SelectOption[]>([]);
  protected readonly designationOptions = signal<SelectOption[]>([]);

  ngOnInit(): void {
    this.api.departments().subscribe({
      next: (departments) => {
        const list = departments || [];
        this.departmentIds = new Map(list.map((d) => [d.name, d.id]));
        const opts = list.map((d) => ({ v: d.name, l: d.name }));
        this.deptOptions.set(opts.length > 0 ? opts : [{ v: 'General', l: 'General' }]);
        if (list.length > 0) {
          const current = this.job().department;
          const chosen = this.departmentIds.has(current) ? current : list[0].name;
          this.job.update((job) => ({ ...job, department: chosen }));
        }
      },
      error: () => {
        this.deptOptions.set([{ v: 'General', l: 'General' }]);
      },
    });

    this.api.designations().subscribe({
      next: (list) => {
        const opts = (list || []).map((d) => ({ v: d.id, l: d.name }));
        this.designationOptions.set(opts);
        if (opts.length > 0 && !this.job().designationId) {
          this.job.update((j) => ({ ...j, designationId: opts[0].v }));
        }
      },
      error: () => this.designationOptions.set([]),
    });

    this.api.employees({ pageSize: 100 }).subscribe({
      next: (res) => {
        const emps = (res.items || []).map((e) => ({
          v: e.fullName,
          l: e.fullName,
        }));
        this.managerOptions.set(emps);
      },
      error: () => {},
    });
  }

  protected readonly steps = [
    { label: 'Personal', icon: 'user' },
    { label: 'Job Details', icon: 'employees' },
    { label: 'Salary', icon: 'payroll' },
    { label: 'Documents', icon: 'documents' },
    { label: 'Account', icon: 'lock' },
    { label: 'Review', icon: 'check' },
  ];

  protected readonly subtitles = [
    "Enter the employee's basic personal information.",
    'Job role, department and reporting details.',
    'Compensation, salary and allowances.',
    'Upload required identity and legal documents.',
    'Create system login and access credentials.',
    'Review all information before submitting.',
  ];

  protected readonly docNames = ['Passport', 'Visa / Work Permit', 'Emirates ID', 'Educational Certificates', 'Medical Insurance'];

  protected readonly step = signal(0);
  protected readonly submitted = signal(false);
  protected readonly uploaded = signal<Set<string>>(new Set());

  protected readonly progress = computed(() => Math.round((this.step() / (this.steps.length - 1)) * 100));

  protected readonly personal = signal({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Male',
    maritalStatus: 'Married',
    bloodGroup: 'O+',
    city: '',
    state: '',
    country: '',
    address: '',
  });

  protected readonly job = signal({
    jobTitle: '',
    designationId: '',
    department: 'Engineering',
    grade: 'L3',
    joinDate: '',
    employmentType: 'Full-time',
    reportingManager: '',
    workLocation: '',
    shift: 'Morning (9AM - 6PM)',
    noticePeriod: '',
  });

  protected readonly salary = signal({
    basicSalary: '',
    housingAllowance: '',
    transportAllowance: '',
    mobileAllowance: '',
    otherAllowances: '',
    paymentMode: 'Bank Transfer',
    bankName: '',
    accountNumber: '',
    iban: '',
  });

  protected readonly accountForm = signal({
    password: '',
    role: 'Employee',
  });
  protected readonly showPassword = signal(false);

  protected readonly roleOptions: SelectOption[] = [
    { v: 'Employee', l: 'Employee (Self-Service Portal)' },
    { v: 'HrManager', l: 'HR Manager' },
    { v: 'CompanyAdmin', l: 'Company Admin' },
  ];

  protected readonly systemAccessDone = computed(() => this.accountForm().password.trim().length >= 6);

  protected patchAccount(key: 'password' | 'role', value: string): void {
    this.accountForm.update((a) => ({ ...a, [key]: value }));
  }

  protected readonly account: AccountItem[] = [
    { l: 'Email Account', d: 'Work email will be created automatically', done: true },
    { l: 'System Access', d: 'ERP & HRMS login credentials', done: true },
    { l: 'Face Enrollment', d: 'Register face ID at reception', done: false },
    { l: 'IT Equipment', d: 'Laptop & accessories assigned', done: false },
  ];

  protected readonly personalReview: [string, keyof ReturnType<typeof this.personal>][] = [
    ['First Name', 'firstName'],
    ['Middle Name', 'middleName'],
    ['Last Name', 'lastName'],
    ['Email', 'email'],
    ['Phone', 'phone'],
    ['Date of Birth', 'dob'],
    ['Gender', 'gender'],
    ['Marital Status', 'maritalStatus'],
    ['Blood Group', 'bloodGroup'],
    ['City', 'city'],
    ['State', 'state'],
    ['Country', 'country'],
  ];

  protected readonly jobReview: [string, keyof ReturnType<typeof this.job>][] = [
    ['Job Title', 'jobTitle'],
    ['Department', 'department'],
    ['Grade', 'grade'],
    ['Join Date', 'joinDate'],
    ['Employment Type', 'employmentType'],
    ['Reporting Manager', 'reportingManager'],
    ['Work Location', 'workLocation'],
    ['Shift', 'shift'],
    ['Notice Period', 'noticePeriod'],
  ];

  protected readonly salaryReview: [string, keyof ReturnType<typeof this.salary>][] = [
    ['Basic Salary', 'basicSalary'],
    ['Housing Allowance', 'housingAllowance'],
    ['Transport Allowance', 'transportAllowance'],
    ['Mobile Allowance', 'mobileAllowance'],
    ['Other Allowances', 'otherAllowances'],
    ['Payment Mode', 'paymentMode'],
    ['Bank Name', 'bankName'],
    ['Account Number', 'accountNumber'],
    ['IBAN', 'iban'],
  ];

  protected readonly genderOptions: SelectOption[] = [
    { v: 'Male', l: 'Male' },
    { v: 'Female', l: 'Female' },
    { v: 'Other', l: 'Other' },
    { v: 'Prefer not to say', l: 'Prefer not to say' },
  ];
  protected readonly maritalOptions: SelectOption[] = [
    { v: 'Married', l: 'Married' },
    { v: 'Single', l: 'Single' },
    { v: 'Divorced', l: 'Divorced' },
    { v: 'Widowed', l: 'Widowed' },
  ];
  protected readonly bloodOptions: SelectOption[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => ({ v: b, l: b }));
  protected readonly gradeOptions: SelectOption[] = ['L3', 'L4', 'L5'].map((g) => ({ v: g, l: g }));
  protected readonly employmentOptions: SelectOption[] = [
    { v: 'Full-time', l: 'Full-time' },
    { v: 'Part-time', l: 'Part-time' },
    { v: 'Contract', l: 'Contract' },
  ];
  protected readonly managerOptions = signal<SelectOption[]>([]);
  protected readonly shiftOptions: SelectOption[] = [
    { v: 'Morning (9AM - 6PM)', l: 'Morning (9AM - 6PM)' },
    { v: 'Evening', l: 'Evening' },
    { v: 'Night', l: 'Night' },
  ];
  protected readonly paymentOptions: SelectOption[] = [
    { v: 'Bank Transfer', l: 'Bank Transfer' },
    { v: 'Cheque', l: 'Cheque' },
    { v: 'Cash', l: 'Cash' },
  ];

  protected readonly reviewName = computed(() => {
    const p = this.personal();
    return `${this.value(p.firstName, 'Employee')} ${this.value(p.lastName, '')}`.trim();
  });

  protected readonly reviewEmail = computed(() => this.value(this.personal().email, 'the registered email'));

  protected value(v: string, fallback = '—'): string {
    return v && v.trim() ? v.trim() : fallback;
  }

  protected patchP(key: keyof ReturnType<typeof this.personal>, value: string): void {
    this.personal.update((p) => ({ ...p, [key]: value }));
  }

  protected patchJ(key: keyof ReturnType<typeof this.job>, value: string): void {
    this.job.update((j) => ({ ...j, [key]: value }));
    if ((key === 'department' || key === 'jobTitle') && /\bhr\b|human resources/i.test(value)) {
      if (this.accountForm().role === 'Employee') {
        this.accountForm.update((a) => ({ ...a, role: 'HrManager' }));
      }
    }
  }

  protected patchS(key: keyof ReturnType<typeof this.salary>, value: string): void {
    this.salary.update((s) => ({ ...s, [key]: value }));
  }

  protected uploadDoc(name: string): void {
    this.uploaded.update((set) => new Set(set).add(name));
    this.toast.show(`${name} uploaded!`);
  }

  protected next(): void {
    if (this.step() === 0) {
      const p = this.personal();
      if (!p.firstName.trim() || !p.lastName.trim() || !p.email.trim()) {
        this.toast.show('First name, last name and email are required.', 'danger');
        return;
      }
    }
    if (this.step() === 4) {
      const pw = this.accountForm().password.trim();
      if (!pw) {
        this.toast.show('Please enter a password so the employee can log in.', 'danger');
        return;
      }
      if (pw.length < 6) {
        this.toast.show('Password must be at least 6 characters.', 'danger');
        return;
      }
    }

    if (this.step() < 5) {
      this.step.update((s) => s + 1);
    } else {
      this.submit();
    }
  }

  private submit(): void {
    const personal = this.personal();
    const job = this.job();

    if (!personal.firstName.trim() || !personal.lastName.trim() || !personal.email.trim()) {
      this.toast.show('First name, last name and email are required.', 'danger');
      this.step.set(0);
      return;
    }

    let departmentId = this.departmentIds.get(job.department);

    if (!departmentId) {
      for (const [key, val] of this.departmentIds.entries()) {
        if (
          key.toLowerCase() === job.department.toLowerCase() ||
          (job.department.toLowerCase() === 'hr' && key.toLowerCase().includes('resource')) ||
          (job.department.toLowerCase().includes('resource') && key.toLowerCase() === 'hr')
        ) {
          departmentId = val;
          break;
        }
      }
    }

    if (!departmentId && this.departmentIds.size > 0) {
      departmentId = this.departmentIds.values().next().value;
    }

    if (!departmentId) {
      const deptName = job.department?.trim() || 'General';
      this.api.createDepartment({ name: deptName, code: deptName.slice(0, 3).toUpperCase() }).subscribe({
        next: (created) => {
          this.departmentIds.set(created.name, created.id);
          this.deptOptions.update((prev) => [...prev, { v: created.name, l: created.name }]);
          this.sendEmployeePayload(created.id);
        },
        error: () => {
          this.toast.show('Please create a department under Company -> Departments first.', 'warning');
        },
      });
      return;
    }

    this.sendEmployeePayload(departmentId);
  }

  private sendEmployeePayload(departmentId: string): void {
    const personal = this.personal();
    const job = this.job();
    const salary = this.salary();
    const account = this.accountForm();

    const body = {
      firstName: personal.firstName.trim(),
      middleName: personal.middleName.trim() || null,
      lastName: personal.lastName.trim(),
      email: personal.email.trim(),
      phone: personal.phone.trim() || null,
      departmentId,
      designationId: job.designationId || null,
      branchId: null,
      shiftId: null,
      reportingManagerId: null,
      jobTitle: job.jobTitle.trim() || 'Employee',
      grade: job.grade || 'L3',
      employmentType: this.employmentType(job.employmentType),
      joinDate: this.toIso(job.joinDate) ?? new Date().toISOString().slice(0, 10),
      basicSalary: this.numeric(salary.basicSalary),
      housingAllowance: this.numeric(salary.housingAllowance),
      transportAllowance: this.numeric(salary.transportAllowance),
      mobileAllowance: this.numeric(salary.mobileAllowance),
      otherAllowances: this.numeric(salary.otherAllowances),
      currency: 'USD',
      dateOfBirth: this.toIso(personal.dob),
      gender: this.mapGender(personal.gender),
      maritalStatus: personal.maritalStatus,
      bloodGroup: personal.bloodGroup || null,
      address: personal.address.trim() || null,
      city: personal.city.trim() || null,
      state: personal.state.trim() || null,
      country: personal.country.trim() || null,
      bankName: salary.bankName.trim() || null,
      accountName: `${personal.firstName} ${personal.lastName}`.trim() || null,
      accountNumber: salary.accountNumber.trim() || null,
      iban: salary.iban.trim() || null,
      paymentMode: this.paymentMode(salary.paymentMode),
      password: account.password.trim() || 'Emp@12345',
      roleCode: account.role || 'Employee',
    };

    this.api.createEmployee(body).subscribe({
      next: (created) => {
        const empId = created?.id || personal.email;
        const empCode = created?.employeeCode || empId;
        const fullName = `${personal.firstName} ${personal.lastName}`.trim();

        if (this.enrolledFaceDescriptor()) {
          const descriptorStr = JSON.stringify(this.enrolledFaceDescriptor());
          const photo = this.enrolledFacePhoto() || '';

          const record: EnrolledFace = {
            employeeId: empId,
            employeeCode: empCode,
            fullName,
            department: job.department,
            avatarUrl: photo,
            faceDescriptor: descriptorStr,
          };

          try {
            localStorage.setItem('hrms_face_' + empId, JSON.stringify(record));
            localStorage.setItem('hrms_face_' + empCode.toLowerCase(), JSON.stringify(record));
            localStorage.setItem('hrms_face_' + fullName.toLowerCase(), JSON.stringify(record));
            localStorage.setItem('hrms_face_' + personal.email.toLowerCase(), JSON.stringify(record));
          } catch {}

          this.api.enrollFace(empId, {
            faceDescriptor: descriptorStr,
            facePhotoUrl: photo,
          }).subscribe({ next: () => {}, error: () => {} });
        }

        this.submitted.set(true);
        this.toast.show('Employee onboarded with biometric Face ID!', 'success');
      },
      error: (error) => {
        const msg = error?.error?.errors
          ? Object.values(error.error.errors).flat().join(' ')
          : (error?.error?.detail ?? error?.error?.message ?? error?.error?.title ?? 'Could not onboard the employee.');
        this.toast.show(msg, 'danger');
      },
    });
  }

  private mapGender(value: string): string {
    switch (value) {
      case 'Prefer not to say':
        return 'PreferNotToSay';
      case 'Female':
        return 'Female';
      case 'Other':
        return 'Other';
      default:
        return 'Male';
    }
  }

  private employmentType(value: string): string {
    const v = (value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (v.includes('part')) return 'PartTime';
    if (v.includes('contract')) return 'Contract';
    if (v.includes('intern')) return 'Intern';
    if (v.includes('probation')) return 'Probation';
    return 'FullTime';
  }

  private paymentMode(value: string): string {
    const v = (value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (v.includes('cash')) return 'Cash';
    if (v.includes('cheque') || v.includes('check')) return 'Cheque';
    if (v.includes('wps')) return 'Wps';
    return 'BankTransfer';
  }

  private numeric(value: string): number {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toIso(value: string): string | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected restart(): void {
    this.step.set(0);
    this.submitted.set(false);
    this.uploaded.set(new Set());
    this.accountForm.set({ password: '', role: 'Employee' });
  }

  protected goEmployees(): void {
    void this.router.navigateByUrl('/employees');
  }

  ngOnDestroy(): void {
    this.stopFaceCamera();
  }

  protected openFaceModal(): void {
    this.faceModalMsg.set('Position face in reticle and click Capture Face');
    this.showFaceModal.set(true);
    setTimeout(() => void this.startFaceCamera(), 200);
  }

  protected closeFaceModal(): void {
    this.stopFaceCamera();
    this.showFaceModal.set(false);
  }

  protected removeEnrolledFace(): void {
    this.enrolledFaceDescriptor.set(null);
    this.enrolledFacePhoto.set(null);
    this.toast.show('Face registration removed', 'info');
  }

  private async startFaceCamera(): Promise<void> {
    try {
      this.stopFaceCamera();
      await this.faceService.loadModels();

      this.obMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.obFaceVideoRef?.nativeElement;
      if (!video) return;

      video.srcObject = this.obMediaStream;
      try {
        await video.play();
      } catch {}

      this.cameraActive.set(true);
    } catch (err) {
      console.warn('Camera blocked in onboarding:', err);
      this.cameraActive.set(false);
      this.faceModalMsg.set('Camera access denied or unavailable in your browser.');
    }
  }

  private stopFaceCamera(): void {
    if (this.obMediaStream) {
      this.obMediaStream.getTracks().forEach((t) => t.stop());
      this.obMediaStream = undefined;
    }
    const video = this.obFaceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
    this.cameraActive.set(false);
  }

  protected async captureFaceBiometrics(): Promise<void> {
    if (!this.cameraActive() || !this.obFaceVideoRef?.nativeElement) return;

    this.faceCapturing.set(true);
    this.faceModalMsg.set('Analyzing facial biometrics and extracting 128D AI descriptor…');

    const video = this.obFaceVideoRef.nativeElement;
    const canvas = this.obFaceCanvasRef?.nativeElement;

    // Collect 3 samples for centroid
    const samples: number[][] = [];
    let snapshot = '';
    for (let i = 0; i < 3; i++) {
      const scan = await this.faceService.detectFace(video, canvas);
      if (scan.hasFace && scan.descriptor) {
        samples.push(scan.descriptor);
        if (scan.snapshot) snapshot = scan.snapshot;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 120));
    }

    this.faceCapturing.set(false);

    if (samples.length === 0) {
      this.faceModalMsg.set('❌ No face detected by AI model. Look directly into camera.');
      this.toast.show('No face detected. Please face the camera.', 'warning');
      return;
    }

    const finalDescriptor = new Array(128).fill(0);
    for (const s of samples) {
      for (let j = 0; j < 128; j++) finalDescriptor[j] += s[j] / samples.length;
    }
    let norm = 0;
    for (let j = 0; j < 128; j++) norm += finalDescriptor[j] * finalDescriptor[j];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let j = 0; j < 128; j++) finalDescriptor[j] /= norm;
    }

    this.enrolledFaceDescriptor.set(finalDescriptor);
    if (snapshot) this.enrolledFacePhoto.set(snapshot);

    this.faceModalMsg.set('✅ Face Biometrics Captured (128D Deep Neural Embedding)!');
    this.toast.show('Face biometrics registered for onboarding!', 'success');

    setTimeout(() => {
      this.closeFaceModal();
    }, 700);
  }
}
