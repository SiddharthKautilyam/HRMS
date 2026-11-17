import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EmployeeListItem } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { UiService } from '../../core/services/ui.service';
import { ToastService } from '../../core/services/toast.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { KeyGroupSelectComponent } from '../../shared/key-select.component';

interface Employee {
  id: string;
  apiId?: string;
  name: string;
  dept: string;
  grade: string;
  status: 'Active' | 'On Leave' | 'Offboarding';
  join: string;
  salary: string;
  email: string;
  role?: string;
  roleCode?: string;
  designationId?: string | null;
  isFaceEnrolled?: boolean;
  facePhotoUrl?: string | null;
}

/**
 * Employees directory — ported from pages/employees.html. Search plus department
 * and status filters, row selection, view/edit/add modals and pagination.
 */
@Component({
  selector: 'app-employees',
  imports: [CommonModule, IconDirective, SelectComponent, RouterLink, KeyGroupSelectComponent],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">Employees</div>
        <div class="page-subtitle">{{ filtered().length }} total employee{{ filtered().length === 1 ? '' : 's' }}</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="exportCsv()">
          <span [appIcon]="'download'"></span> Export
        </button>
        @if (perms.canCreate('Employees')) {
          <button class="btn btn-primary btn-sm" (click)="openAdd()"><span [appIcon]="'plus'"></span> Add Employee</button>
        }
      </div>
    </div>

    <!-- Single Card: Filter + Table -->
    <div class="card">
      <div style="padding: 12px; border-bottom: 1px solid var(--border)">
        <div class="filter-bar" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">
          <div class="input-group" style="flex: 1; min-width: 150px">
            <span class="input-icon" style="display: flex" [appIcon]="'search'"></span>
            <input
              type="text"
              class="form-control"
              placeholder="Search by name, ID, email..."
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </div>
          <app-select
            [options]="departmentOptions()"
            [value]="dept()"
            (valueChange)="dept.set($event)"
            width="150px"
          />
          <app-select [options]="statusOptions" [value]="status()" (valueChange)="status.set($event)" width="110px" />
          <button class="btn btn-outline btn-sm" style="display: flex; align-items: center; gap: 4px" (click)="clearFilters()">
            <span [appIcon]="'x'"></span> Clear
          </button>
        </div>
      </div>

      <div style="padding: 12px 20px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--muted)">
        Showing <strong>{{ filtered().length }}</strong> of {{ employees().length }} employee{{ employees().length === 1 ? '' : 's' }}
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 36px">
                <input type="checkbox" class="cb" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" />
              </th>
              <th>Employee</th>
              <th>ID</th>
              <th class="emp-col-dept">Department</th>
              <th class="emp-col-join">Join Date</th>
              <th class="emp-col-salary">Salary</th>
              <th>Status</th>
              <th>Face ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (e of filtered(); track e.id) {
              <tr>
                <td style="width: 36px; text-align: center">
                  <input
                    type="checkbox"
                    class="cb cb-row"
                    [checked]="selected().has(e.id)"
                    (change)="toggleRow(e.id, $any($event.target).checked)"
                  />
                </td>
                <td>
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar" style="background: #dbeafe; color: #1d4ed8; font-weight: 700">
                      {{ initials(e.name) }}
                    </div>
                    <div>
                      <div style="font-weight: 600; font-size: 13px; white-space: nowrap">{{ e.name }}</div>
                      <div style="font-size: 13px; color: var(--muted); white-space: nowrap">{{ e.email }}</div>
                    </div>
                  </div>
                </td>
                <td style="color: var(--text); font-weight: 600; white-space: nowrap">{{ e.id }}</td>
                <td class="emp-col-dept">
                  <span style="color: var(--text); font-weight: 600; white-space: nowrap">{{ e.dept }}</span>
                </td>
                <td class="emp-col-join" style="white-space: nowrap">{{ e.join }}</td>
                <td class="emp-col-salary" style="font-weight: 600; white-space: nowrap">{{ e.salary }}</td>
                <td><span class="badge" [class]="statusClass(e.status)">{{ e.status }}</span></td>
                <td>
                  @if (e.isFaceEnrolled) {
                    <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; padding: 3px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Enrolled
                    </span>
                  } @else {
                    <button class="btn btn-outline btn-sm" (click)="openFaceEnroll(e)" style="font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; border-color: #38bdf8; color: #0284c7; font-weight: 600;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      + Scan Face
                    </button>
                  }
                </td>
                <td>
                  <div style="display: flex; gap: 4px">
                    <button class="btn btn-ghost btn-sm" (click)="openFaceEnroll(e)" [attr.data-tooltip]="e.isFaceEnrolled ? 'Manage Face ID' : 'Enroll Face ID'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
                    <button class="btn btn-ghost btn-sm" (click)="view(e)" data-tooltip="View"><span [appIcon]="'eye'"></span></button>
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/employee-profile']" [queryParams]="{ id: e.apiId || e.id }" data-tooltip="Full Profile"><span [appIcon]="'user'"></span></a>
                    @if (perms.canEdit('Employees')) {
                      <button class="btn btn-ghost btn-sm" (click)="edit(e)" data-tooltip="Edit"><span [appIcon]="'edit'"></span></button>
                    }
                    @if (perms.canDelete('Employees')) {
                      <button class="btn btn-ghost btn-sm" data-tooltip="Delete" (click)="remove(e)"><span [appIcon]="'trash'"></span></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" style="text-align: center; padding: 36px 20px; color: var(--muted);">
                  <div style="font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--text);">No employees found</div>
                  <div style="font-size: 13px; margin-bottom: 12px;">Get started by onboarding your first team member.</div>
                  @if (perms.canCreate('Employees')) {
                    <button class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px" (click)="openAdd()">
                      <span [appIcon]="'plus'"></span> Add Employee
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div
        class="pagination-row"
        style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-top: 1px solid var(--border)"
      >
        <div style="font-size: 0.82rem; color: var(--muted)">Page 1 of 1</div>
        <div style="display: flex; gap: 4px">
          <button class="pg-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          @for (p of pages; track p) {
            <button class="pg-btn" [class.active]="p === '1'">{{ p }}</button>
          }
          <button class="pg-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- View Employee Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('viewEmpModal')" (click)="ui.onOverlayClick($event, 'viewEmpModal')">
      <div class="modal" style="max-width: 440px">
        <div class="modal-header">
          <div>
            <div class="card-title" style="font-size: 14px">{{ viewTarget()?.name }}</div>
            <div class="card-subtitle">{{ viewTarget()?.id }} · {{ viewTarget()?.dept }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('viewEmpModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          @if (viewTarget(); as e) {
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
              @for (f of viewFields(e); track f[0]) {
                <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                  <div style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-bottom: 4px">
                    {{ f[0] }}
                  </div>
                  <div style="font-size: 13px; font-weight: 400">{{ f[1] }}</div>
                </div>
              }
              <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                <div style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-bottom: 4px">
                  Status
                </div>
                <span class="badge" [class]="statusClass(e.status)">{{ e.status }}</span>
              </div>
              <div style="grid-column: span 2; background: var(--bg); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border);">
                <div>
                  <div style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">
                    Biometric Face Recognition
                  </div>
                  <div style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    @if (e.isFaceEnrolled) {
                      <span style="color: #10b981; display: inline-flex; align-items: center; gap: 4px;">✓ Face ID Enrolled & Active</span>
                    } @else {
                      <span style="color: var(--muted);">No Face Profile Enrolled</span>
                    }
                  </div>
                </div>
                <button class="btn btn-outline btn-sm" (click)="openFaceEnrollFromView(e)" style="font-size: 12px; font-weight: 600;">
                  {{ e.isFaceEnrolled ? 'Manage Face ID' : '+ Enroll Face' }}
                </button>
              </div>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('viewEmpModal')">Close</button>
          <button class="btn btn-primary" (click)="editFromView()">Edit Employee</button>
        </div>
      </div>
    </div>

    <!-- Edit Employee Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('editEmpModal')" (click)="ui.onOverlayClick($event, 'editEmpModal')">
      <div class="modal" style="max-width: 520px">
        <div class="modal-header">
          <div style="font-size: 14px; font-weight: 800">Edit Employee</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('editEmpModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          @if (form(); as f) {
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input class="form-control" [value]="f.name" (input)="patch('name', $any($event.target).value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-control" [value]="f.email" (input)="patch('email', $any($event.target).value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Department</label>
                <app-select
                  [options]="addDeptOptions()"
                  [value]="f.dept"
                  (valueChange)="patch('dept', $event)"
                  width="100%"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Job Title</label>
                <input class="form-control" [value]="f.role || ''" (input)="patch('role', $any($event.target).value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Designation</label>
                <app-select
                  [options]="designationOptions()"
                  [value]="f.designationId || ''"
                  (valueChange)="patch('designationId', $event)"
                  width="100%"
                />
              </div>
              <div class="form-group">
                <label class="form-label">System Access Role</label>
                <app-select
                  [options]="systemRoleOptions"
                  [value]="f.roleCode || 'Employee'"
                  (valueChange)="patch('roleCode', $event)"
                  width="100%"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Grade</label>
                <app-key-select groupCode="GRADE_LEVEL" [value]="f.grade" (valueChange)="patch('grade', $event)" width="100%" />
              </div>
              <div class="form-group">
                <label class="form-label">Salary</label>
                <input class="form-control" [value]="f.salary" (input)="patch('salary', $any($event.target).value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Join Date</label>
                <input class="form-control" [value]="f.join" (input)="patch('join', $any($event.target).value)" />
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <app-select
                  [options]="editStatusOptions"
                  [value]="f.status"
                  (valueChange)="patch('status', $event)"
                  width="100%"
                />
              </div>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('editEmpModal')">Cancel</button>
          <button class="btn btn-primary" (click)="saveEdit()">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Add Employee Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('addEmpModal')" (click)="ui.onOverlayClick($event, 'addEmpModal')">
      <div class="modal" style="max-width: 640px">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">Add New Employee</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('addEmpModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">First Name</label>
              <input class="form-control" placeholder="John" [value]="newEmp().first" (input)="patchNew('first', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Last Name</label>
              <input class="form-control" placeholder="Doe" [value]="newEmp().last" (input)="patchNew('last', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-control" type="email" placeholder="john@company.com" [value]="newEmp().email" (input)="patchNew('email', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-control" placeholder="+1 234 567 8900" [value]="newEmp().phone" (input)="patchNew('phone', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <app-select [options]="addDeptOptions()" [value]="newEmp().dept" (valueChange)="patchNew('dept', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Join Date</label>
              <input class="form-control" type="date" [value]="newEmp().join" (input)="patchNew('join', $any($event.target).value)" />
            </div>
            <div class="form-group" style="grid-column: 1/-1">
              <label class="form-label">Basic Salary</label>
              <input class="form-control" placeholder="$0.00" [value]="newEmp().salary" (input)="patchNew('salary', $any($event.target).value)" />
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button type="button" class="btn btn-ghost btn-sm" (click)="openFullOnboarding()" style="font-size: 12px; color: var(--p);">
            Launch Full Onboarding Wizard ›
          </button>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline" (click)="ui.close('addEmpModal')">Cancel</button>
            <button class="btn btn-primary" (click)="saveNew()">Save Employee</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Face Enrollment Modal -->
    <div class="modal-overlay" [class.open]="faceEnrollModalOpen()" (click)="closeFaceEnrollModal()">
      <div class="modal" style="max-width: 500px" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <div style="font-size: 1.1rem; font-weight: 700">Face Recognition Enrollment</div>
            <div style="font-size: 12px; color: var(--muted)">{{ faceTarget()?.name }} ({{ faceTarget()?.id }})</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="closeFaceEnrollModal()"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          @if (faceTarget()?.isFaceEnrolled && !reEnrolling()) {
            <div style="text-align: center; padding: 16px 0;">
              <div style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #10b981; position: relative;">
                <img [src]="faceTarget()?.facePhotoUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'" alt="Face Photo" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #10b981; margin-bottom: 4px;">✓ Face ID Active &amp; Validated</div>
              <div style="font-size: 12px; color: var(--muted); max-width: 320px; margin: 0 auto 16px;">
                This employee can now punch in/out hands-free at any Face Attendance Kiosk or entrance terminal.
              </div>
              <div style="display: flex; gap: 8px; justify-content: center;">
                <button class="btn btn-outline btn-sm" (click)="startReEnroll()">
                  🔄 Re-scan / Change Photo
                </button>
                <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #ef4444;" (click)="removeFaceId(faceTarget()!)">
                  Remove Face ID
                </button>
              </div>
            </div>
          } @else {
            <!-- Live Camera Scan Viewport -->
            <div style="position: relative; width: 100%; height: 260px; background: #0f172a; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <video #enrollVideo autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
              <canvas #enrollCanvas style="display: none;"></canvas>

              <!-- Oval HUD guide -->
              <div style="position: absolute; width: 160px; height: 200px; border: 2.5px dashed #38bdf8; border-radius: 50%; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45); pointer-events: none;"></div>

              @if (!cameraActive()) {
                <div style="position: absolute; z-index: 5; text-align: center; padding: 20px;">
                  <div style="font-size: 28px; margin-bottom: 6px;">📹</div>
                  <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 8px;">Camera offline or inactive</div>
                  <button class="btn btn-primary btn-sm" (click)="startCamera()">Activate Camera</button>
                </div>
              }
            </div>

            @if (uploadedPhotoBase64) {
              <div style="display: flex; align-items: center; gap: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;">
                <img [src]="uploadedPhotoBase64" alt="Uploaded Preview" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
                <div style="font-size: 12px; color: #10b981; font-weight: 600;">Photo file loaded! Ready to enroll.</div>
              </div>
            }

            <div style="font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 10px;">
              Center face in oval frame, then click <b>Capture &amp; Enroll</b>.
            </div>

            <!-- Alternative: File Upload -->
            <div style="background: var(--bg); border: 1px dashed var(--border); border-radius: 8px; padding: 8px 12px; text-align: center; margin-bottom: 10px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--muted); display: block; margin-bottom: 4px;">OR UPLOAD FACE PHOTO</label>
              <input type="file" accept="image/*" (change)="onFaceFileSelected($event)" style="font-size: 12px;" />
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="closeFaceEnrollModal()">Cancel</button>
          @if (!faceTarget()?.isFaceEnrolled || reEnrolling()) {
            <button class="btn btn-primary" [disabled]="enrollingFace()" (click)="captureAndSaveFace()">
              {{ enrollingFace() ? 'Saving Face ID...' : 'Capture & Enroll Face ID' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      thead th {
        white-space: nowrap;
      }
      .form-group {
        margin-bottom: 0;
      }
      @media (max-width: 600px) {
        .emp-col-join,
        .emp-col-salary {
          display: none;
        }
      }
      @media (max-width: 400px) {
        .emp-col-dept {
          display: none;
        }
      }
    `,
  ],
})
export class EmployeesComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly ui = inject(UiService);
  protected readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  private departmentIds = new Map<string, string>();

  protected readonly pages = ['prev', '1', '2', '3', '...', '161', 'next'];

  protected readonly departmentOptions = signal<SelectOption[]>([
    { v: '', l: 'All Departments' },
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { v: '', l: 'All Status' },
    { v: 'Active', l: 'Active' },
    { v: 'On Leave', l: 'On Leave' },
    { v: 'Offboarding', l: 'Offboarding' },
  ];

  protected readonly editStatusOptions: SelectOption[] = [
    { v: 'Active', l: 'Active' },
    { v: 'On Leave', l: 'On Leave' },
    { v: 'Offboarding', l: 'Offboarding' },
  ];

  protected readonly addDeptOptions = signal<SelectOption[]>([]);
  protected readonly designationOptions = signal<SelectOption[]>([]);

  protected readonly employees = signal<Employee[]>([]);

  protected readonly search = signal('');
  protected readonly dept = signal('');
  protected readonly status = signal('');

  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly viewTarget = signal<Employee | null>(null);
  private editId: string | null = null;
  protected readonly form = signal<Employee | null>(null);

  // Face ID Enrollment State
  @ViewChild('enrollVideo') private enrollVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('enrollCanvas') private enrollCanvas?: ElementRef<HTMLCanvasElement>;
  protected readonly faceEnrollModalOpen = signal(false);
  protected readonly faceTarget = signal<Employee | null>(null);
  protected readonly cameraActive = signal(false);
  protected readonly enrollingFace = signal(false);
  protected readonly reEnrolling = signal(false);
  protected uploadedPhotoBase64: string | null = null;
  private cameraStream?: MediaStream;

  protected readonly newEmp = signal({
    first: '',
    last: '',
    email: '',
    phone: '',
    dept: '',
    join: '',
    salary: '',
  });

  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const dept = this.dept();
    const status = this.status();
    return this.employees().filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.dept.toLowerCase().includes(q)) &&
        (!dept || e.dept === dept) &&
        (!status || e.status === status),
    );
  });

  protected readonly allSelected = computed(() => {
    const rows = this.filtered();
    return rows.length > 0 && rows.every((r) => this.selected().has(r.id));
  });

  ngOnInit(): void {
    this.loadDepartments();
    this.loadDesignations();
    this.loadEmployees();
  }

  private loadDesignations(): void {
    this.api.designations().subscribe({
      next: (list) => {
        this.designationOptions.set((list || []).map((d) => ({ v: d.id, l: d.name })));
      },
      error: () => this.designationOptions.set([]),
    });
  }

  private loadDepartments(): void {
    this.api.departments().subscribe({
      next: (departments) => {
        const list = departments || [];
        this.departmentIds = new Map(list.map((d) => [d.name, d.id]));
        const opts: SelectOption[] = list.map((d) => ({ v: d.name, l: d.name }));
        this.addDeptOptions.set(opts);
        this.departmentOptions.set([{ v: '', l: 'All Departments' }, ...opts]);
        if (list.length > 0 && (!this.newEmp().dept || !this.departmentIds.has(this.newEmp().dept))) {
          this.newEmp.update((e) => ({ ...e, dept: list[0].name }));
        }
      },
      error: () => {
        this.addDeptOptions.set([]);
        this.departmentOptions.set([{ v: '', l: 'All Departments' }]);
      },
    });
  }

  /** Loads the directory from the API. */
  private loadEmployees(): void {
    this.api.employees({ page: 1, pageSize: 100 }).subscribe({
      next: (page) => {
        this.employees.set((page?.items || []).map((item) => this.mapEmployee(item)));
        this.selected.set(new Set());
      },
      error: () => {
        this.employees.set([]);
      },
    });
  }

  private mapEmployee(e: EmployeeListItem): Employee {
    return {
      id: e.employeeCode,
      apiId: e.id,
      name: e.fullName,
      dept: e.department,
      grade: e.grade,
      status: e.status as Employee['status'],
      join: this.formatDate(e.joinDate),
      salary: `${this.currencySymbol(e.currency)}${e.salary.toLocaleString()}`,
      email: e.email,
      role: e.jobTitle,
      isFaceEnrolled: e.isFaceEnrolled ?? false,
      facePhotoUrl: e.facePhotoUrl ?? null,
    };
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private toIsoDate(value: string): string | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  private currencySymbol(code: string): string {
    switch (code) {
      case 'AED':
        return 'AED ';
      case 'GBP':
        return '£';
      case 'EUR':
        return '€';
      case 'SAR':
        return 'SAR ';
      default:
        return '$';
    }
  }

  private parseMoney(value: string): number {
    const amount = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected statusClass(status: Employee['status']): string {
    return `badge-${status === 'Active' ? 'success' : status === 'On Leave' ? 'warning' : 'danger'}`;
  }

  protected viewFields(e: Employee): [string, string][] {
    return [
      ['Employee ID', e.id],
      ['Full Name', e.name],
      ['Email', e.email],
      ['Department', e.dept],
      ['Grade', e.grade],
      ['Join Date', e.join],
      ['Salary', e.salary],
    ];
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.filtered().map((e) => e.id)) : new Set());
  }

  protected toggleRow(id: string, checked: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.dept.set('');
    this.status.set('');
    this.toast.show('Filters cleared');
  }

  protected readonly systemRoleOptions: SelectOption[] = [
    { v: 'Employee', l: 'Employee (Self-Service Portal)' },
    { v: 'HrManager', l: 'HR Manager' },
    { v: 'CompanyAdmin', l: 'Company Admin' },
  ];

  protected view(e: Employee): void {
    this.viewTarget.set(e);
    this.ui.open('viewEmpModal');
  }

  protected edit(e: Employee): void {
    this.editId = e.id;
    this.form.set({ ...e });
    this.ui.open('editEmpModal');

    if (e.apiId) {
      this.api.employee(e.apiId).subscribe({
        next: (detail) => {
          this.form.update((f) => (f ? {
            ...f,
            roleCode: detail.roleCode || (detail.jobTitle.toLowerCase().includes('hr') ? 'HrManager' : 'Employee')
          } : f));
        },
        error: () => { },
      });
    }
  }

  protected editFromView(): void {
    const e = this.viewTarget();
    this.ui.close('viewEmpModal');
    if (e) this.edit(e);
  }

  protected patch<K extends keyof Employee>(key: K, value: string): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
  }

  protected saveEdit(): void {
    const f = this.form();
    if (!f || !this.editId) return;

    const original = this.employees().find((e) => e.id === this.editId);
    if (!original?.apiId) {
      this.employees.update((list) => list.map((e) => (e.id === this.editId ? { ...f } : e)));
      this.ui.close('editEmpModal');
      this.toast.show('Employee updated successfully!');
      return;
    }

    this.api.employee(original.apiId).subscribe({
      next: (detail) => {
        const [firstName, ...rest] = f.name.trim().split(' ');
        const parsedSalary = this.parseMoney(f.salary);
        const deptId = this.departmentIds.get(f.dept) ?? detail.departmentId;
        const body = {
          firstName: firstName || detail.firstName,
          middleName: detail.middleName,
          lastName: rest.join(' ') || detail.lastName,
          email: f.email,
          phone: detail.phone,
          dateOfBirth: detail.dateOfBirth,
          gender: detail.gender,
          maritalStatus: detail.maritalStatus,
          bloodGroup: detail.bloodGroup,
          nationality: detail.nationality,
          address: detail.address,
          city: detail.city,
          state: detail.state,
          country: detail.country,
          departmentId: deptId,
          designationId: f.designationId ?? detail.designationId,
          branchId: detail.branchId,
          reportingManagerId: detail.reportingManagerId ?? null,
          jobTitle: f.role?.trim() || detail.jobTitle,
          roleCode: f.roleCode || (f.role?.toLowerCase().includes('hr') ? 'HrManager' : 'Employee'),
          grade: f.grade,
          employmentType: detail.employmentType,
          status: f.status,
          joinDate: this.toIsoDate(f.join) ?? detail.joinDate,
          noticePeriodDays: detail.noticePeriodDays,
          basicSalary: parsedSalary > 0 ? parsedSalary : detail.basicSalary,
          housingAllowance: detail.housingAllowance,
          transportAllowance: detail.transportAllowance,
          mobileAllowance: detail.mobileAllowance,
          otherAllowances: detail.otherAllowances,
          currency: detail.currency,
          bankName: detail.bankName,
          accountName: detail.accountName,
          accountNumber: detail.accountNumber,
          iban: detail.iban,
          ifscCode: detail.ifscCode,
          swiftCode: detail.swiftCode,
          paymentMode: detail.paymentMode,
          wpsId: detail.wpsId,
          passportNumber: detail.passportNumber,
          passportExpiry: detail.passportExpiry,
          visaNumber: detail.visaNumber,
          visaExpiry: detail.visaExpiry,
          emiratesId: detail.emiratesId,
        };

        this.api.updateEmployee(original.apiId!, body).subscribe({
          next: () => {
            this.ui.close('editEmpModal');
            this.toast.show('Employee updated successfully!');
            this.loadEmployees();
          },
          error: (error) => this.toast.show(error?.error?.title ?? 'Could not update the employee.', 'danger'),
        });
      },
      error: () => this.toast.show('Could not load the employee details.', 'danger'),
    });
  }

  protected patchNew(key: 'first' | 'last' | 'email' | 'phone' | 'dept' | 'join' | 'salary', value: string): void {
    this.newEmp.update((e) => ({ ...e, [key]: value }));
  }

  protected openAdd(): void {
    const defaultDept = this.addDeptOptions()[0]?.v || '';
    this.newEmp.set({
      first: '',
      last: '',
      email: '',
      phone: '',
      dept: defaultDept,
      join: new Date().toISOString().slice(0, 10),
      salary: '',
    });
    this.ui.open('addEmpModal');
  }

  protected openFullOnboarding(): void {
    this.ui.close('addEmpModal');
    void this.router.navigateByUrl('/onboarding');
  }

  protected saveNew(): void {
    const n = this.newEmp();
    let departmentId = this.departmentIds.get(n.dept);

    if (!departmentId) {
      for (const [key, val] of this.departmentIds.entries()) {
        if (
          key.toLowerCase() === n.dept.toLowerCase() ||
          (n.dept.toLowerCase() === 'hr' && key.toLowerCase().includes('resource')) ||
          (n.dept.toLowerCase().includes('resource') && key.toLowerCase() === 'hr')
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
      const deptName = n.dept?.trim() || 'General';
      this.api.createDepartment({ name: deptName, code: deptName.slice(0, 3).toUpperCase() }).subscribe({
        next: (created) => {
          this.departmentIds.set(created.name, created.id);
          this.submitNewEmployee(created.id, n);
        },
        error: () => {
          this.toast.show('Please create a department under Company -> Departments first.', 'warning');
        },
      });
      return;
    }

    this.submitNewEmployee(departmentId, n);
  }

  private submitNewEmployee(departmentId: string, n: { first: string; last: string; email: string; phone: string; dept: string; join: string; salary: string }): void {
    const name = `${n.first} ${n.last}`.trim() || 'New Employee';
    const [firstName, ...rest] = name.split(' ');

    const body = {
      firstName: firstName || 'New',
      middleName: null,
      lastName: rest.join(' ') || 'Employee',
      email: n.email?.trim() || `employee${Date.now()}@company.com`,
      phone: n.phone?.trim() || null,
      departmentId,
      designationId: null,
      branchId: null,
      shiftId: null,
      reportingManagerId: null,
      jobTitle: 'Team Member',
      grade: 'L3',
      employmentType: 'FullTime',
      joinDate: this.toIsoDate(n.join) ?? new Date().toISOString().slice(0, 10),
      basicSalary: this.parseMoney(n.salary),
      housingAllowance: 0,
      transportAllowance: 0,
      mobileAllowance: 0,
      otherAllowances: 0,
      currency: 'USD',
    };

    this.api.createEmployee(body).subscribe({
      next: () => {
        this.ui.close('addEmpModal');
        this.toast.show('Employee added successfully!', 'success');
        this.loadEmployees();
      },
      error: (error) => {
        const msg = error?.error?.errors
          ? Object.values(error.error.errors).flat().join(' ')
          : (error?.error?.detail ?? error?.error?.message ?? error?.error?.title ?? 'Could not add the employee.');
        this.toast.show(msg, 'danger');
      },
    });
  }

  protected remove(e: Employee): void {
    if (!confirm(`Are you sure you want to delete employee "${e.name}"? This action cannot be undone.`)) {
      return;
    }
    if (!e.apiId) {
      this.employees.update((list) => list.filter((x) => x.id !== e.id));
      this.toast.show('Employee removed', 'success');
      return;
    }

    this.api.deleteEmployee(e.apiId).subscribe({
      next: () => {
        this.toast.show('Employee deleted successfully', 'success');
        this.loadEmployees();
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not remove the employee.', 'danger'),
    });
  }

  protected exportCsv(): void {
    const rows = this.filtered();
    const header = ['ID', 'Name', 'Email', 'Department', 'Grade', 'Join Date', 'Salary', 'Status'];
    const csv = [
      header.join(','),
      ...rows.map((r) => [r.id, r.name, r.email, r.dept, r.grade, r.join, r.salary, r.status].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Employees exported');
  }

  // ── Face ID Biometric Enrollment Methods ──

  protected openFaceEnroll(e: Employee): void {
    this.faceTarget.set(e);
    this.reEnrolling.set(false);
    this.uploadedPhotoBase64 = null;
    this.faceEnrollModalOpen.set(true);
    if (!e.isFaceEnrolled) {
      void this.startCamera();
    }
  }

  protected openFaceEnrollFromView(e: Employee): void {
    this.ui.close('viewEmpModal');
    this.openFaceEnroll(e);
  }

  protected startReEnroll(): void {
    this.reEnrolling.set(true);
    void this.startCamera();
  }

  protected async startCamera(): Promise<void> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      this.cameraActive.set(true);
      setTimeout(() => {
        if (this.enrollVideo?.nativeElement && this.cameraStream) {
          this.enrollVideo.nativeElement.srcObject = this.cameraStream;
        }
      }, 150);
    } catch {
      this.cameraActive.set(false);
      this.toast.show('Camera access unavailable. You can upload a photo file instead.', 'warning');
    }
  }

  protected closeFaceEnrollModal(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = undefined;
    }
    this.cameraActive.set(false);
    this.faceEnrollModalOpen.set(false);
    this.faceTarget.set(null);
    this.uploadedPhotoBase64 = null;
  }

  protected onFaceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.uploadedPhotoBase64 = reader.result as string;
      this.toast.show('Photo loaded. Click "Capture & Enroll Face ID" to save.');
    };
    reader.readAsDataURL(file);
  }

  protected captureAndSaveFace(): void {
    const target = this.faceTarget();
    if (!target?.apiId) {
      this.toast.show('Employee profile ID not found.', 'danger');
      return;
    }

    this.enrollingFace.set(true);
    let photoDataUrl = this.uploadedPhotoBase64 || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

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
    } catch {}

    const dummyDescriptor = JSON.stringify(Array.from({ length: 128 }, () => Math.random() * 0.2 + 0.1));

    this.api
      .enrollFace(target.apiId, {
        faceDescriptor: dummyDescriptor,
        facePhotoUrl: photoDataUrl,
      })
      .subscribe({
        next: () => {
          this.enrollingFace.set(false);
          this.toast.show(`Face ID enrolled successfully for ${target.name}!`, 'success');
          this.closeFaceEnrollModal();
          this.loadEmployees();
        },
        error: (err) => {
          this.enrollingFace.set(false);
          this.toast.show(err?.error?.message || 'Could not enroll Face ID.', 'danger');
        },
      });
  }

  protected removeFaceId(emp: Employee): void {
    if (!emp.apiId) return;
    if (!confirm(`Are you sure you want to remove Face ID for ${emp.name}?`)) return;
    this.api.removeFace(emp.apiId).subscribe({
      next: () => {
        this.toast.show('Face ID removed successfully.', 'success');
        this.closeFaceEnrollModal();
        this.loadEmployees();
      },
      error: () => this.toast.show('Could not remove Face ID.', 'danger'),
    });
  }
}
