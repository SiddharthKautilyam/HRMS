import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDetail } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { KeyGroupSelectComponent } from '../../shared/key-select.component';

interface DocRow {
  doc: string;
  type: string;
  issue: string;
  exp: string;
  s: string;
}

/**
 * My Profile (employee) — ported from pages/emp-profile.html. The original's
 * hand-rolled calendar widget is replaced with native date inputs.
 */
@Component({
  selector: 'app-emp-profile',
  imports: [CommonModule, IconDirective, SelectComponent, KeyGroupSelectComponent],
  template: `
    <!-- Banner -->
    <div
      style="background: var(--p-soft); border-radius: 16px; padding: 15px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; border: 1px solid var(--p-mid)"
    >
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
        <div style="position: relative">
          <input #avatarInput type="file" accept="image/*" (change)="onAvatarSelected($event)" style="display: none" />
          <div
            style="width: 72px; height: 72px; border-radius: 50%; background: var(--p); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; border: 3px solid var(--surface); box-shadow: 0 4px 16px rgba(37,99,235,.2); overflow: hidden"
          >
            @if (avatarUrl()) {
              <img [src]="avatarUrl()" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover" />
            } @else {
              {{ initials() }}
            }
          </div>
          <div
            (click)="avatarInput.click()"
            title="Upload photo"
            style="position: absolute; bottom: 2px; right: -4px; width: 22px; height: 22px; border-radius: 50%; background: var(--p); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--surface); box-shadow: 0 2px 6px rgba(37,99,235,.35)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
        </div>
        <div>
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--text); margin-bottom: 2px">{{ personal().fullName || 'Employee Profile' }}</div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px">{{ job().title }}{{ job().dept ? ' · ' + job().dept : '' }}{{ detail()?.employeeCode ? ' · ' + detail()?.employeeCode : '' }}</div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center">
            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--success-soft); color: var(--success); border: 1px solid rgba(34,197,94,.3)">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--success); display: inline-block"></span>Active
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--p-soft); color: var(--p); border: 1px solid var(--p-mid)">
              <span [appIcon]="'pin'"></span> Dubai, UAE
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--p-soft); color: var(--p); border: 1px solid var(--p-mid)">
              <span [appIcon]="'calendar2'"></span> Joined Mar 2022
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="ptabs">
      @for (t of tabs; track t.id) {
        <button class="ptab" [class.active]="tab() === t.id" (click)="tab.set(t.id)">
          <span [appIcon]="t.icon"></span> {{ t.label }}
        </button>
      }
    </div>

    <!-- PERSONAL -->
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
              <input class="form-control" value="EMP-1001" readonly style="background: var(--bg); color: var(--muted)" />
            </div>
            <div class="form-group">
              <label class="form-label">Job Title</label>
              <input class="form-control" [value]="job().title" (input)="patchJob('title', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <app-select [options]="deptOptions" [value]="job().dept" (valueChange)="patchJob('dept', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Reporting To</label>
              <app-select [options]="reportingOptions" [value]="job().reportsTo" (valueChange)="patchJob('reportsTo', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Join Date</label>
              <input class="form-control" type="date" [value]="job().joinDate" (input)="patchJob('joinDate', $any($event.target).value)" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Job info saved!')"><span [appIcon]="'check'"></span> Save</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- CONTACT -->
    @if (tab() === 'contact') {
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Contact Information</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-control" type="tel" [value]="contact().phone" (input)="patchContact('phone', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-control" type="email" [value]="contact().email" (input)="patchContact('email', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Emergency Contact Name</label>
              <input class="form-control" [value]="contact().emergencyName" (input)="patchContact('emergencyName', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Emergency Contact Phone</label>
              <input class="form-control" type="tel" [value]="contact().emergencyPhone" (input)="patchContact('emergencyPhone', $any($event.target).value)" />
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
              <label class="form-label">Country</label>
              <app-select [options]="countryOptions" [value]="contact().country" (valueChange)="patchContact('country', $event)" width="100%" />
            </div>
            <div class="form-footer">
              <button class="btn btn-outline btn-sm">Cancel</button>
              <button class="btn btn-primary btn-sm" (click)="save('Contact info saved!')"><span [appIcon]="'check'"></span> Save</button>
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

    <!-- BANK -->
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
              <app-select [options]="currencyOptions" [value]="bank().currency" (valueChange)="patchBank('currency', $event)" width="100%" />
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode</label>
              <app-key-select groupCode="PAYMENT_MODE" [value]="bank().paymentMode" (valueChange)="patchBank('paymentMode', $event)" width="100%" />
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
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--p)">$5,200</div>
              <div style="font-size: 13px; color: var(--muted)">Gross Monthly Salary</div>
            </div>
            @for (s of salaryStructure(); track s[0]) {
              <div style="display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border)">
                <span style="font-size: 13px; color: var(--muted)">{{ s[0] }}</span>
                <span style="font-size: 13px; font-weight: 700" [style.color]="s[2]">{{ s[1] }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- DOCUMENTS -->
    @if (tab() === 'docs') {
      <div class="card">
        <div class="card-header">
          <div class="card-title">My Documents</div>
          <button class="btn btn-primary btn-sm" (click)="ui.open('empUploadDocModal')"><span [appIcon]="'upload2'"></span> Upload</button>
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
                  <td><input class="form-control" type="date" [value]="r.issue" style="padding: 4px 8px; font-size: 12px" /></td>
                  <td><input class="form-control" type="date" [value]="r.exp" style="padding: 4px 8px; font-size: 12px" /></td>
                  <td><span class="badge badge-success">{{ r.s }}</span></td>
                  <td>
                    <div style="display: flex; gap: 4px">
                      <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="toast.show('Opening ' + r.doc)"><span [appIcon]="'eye'"></span></button>
                      <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span></button>
                      <button class="btn btn-ghost btn-sm" data-tooltip="Save" (click)="toast.show('Saved!')"><span [appIcon]="'check'"></span></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Upload Doc Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('empUploadDocModal')" (click)="ui.onOverlayClick($event, 'empUploadDocModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 14px; font-weight: 700">Upload Document</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('empUploadDocModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body" style="overflow: visible">
          <div class="form-group">
            <label class="form-label">Document Type</label>
            <app-select [options]="uploadTypeOptions" [value]="uploadType()" (valueChange)="uploadType.set($event)" width="100%" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
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
            <input #empFileInput type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" (change)="onDocFileSelected($event)" style="display: none" />
            <div
              style="border: 2px dashed var(--border); border-radius: var(--r); padding: 24px; text-align: center; cursor: pointer; transition: var(--t)"
              [style.borderColor]="selectedDocFile() ? 'var(--p)' : 'var(--border)'"
              [style.background]="selectedDocFile() ? 'var(--p-soft)' : 'transparent'"
              (click)="empFileInput.click()"
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
      .ptabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
        border-bottom: 2px solid var(--border);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .ptabs::-webkit-scrollbar {
        display: none;
      }
      .ptab {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px 14px;
        font-size: 14px;
        font-weight: 600;
        color: var(--muted);
        cursor: pointer;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
        transition: 0.2s;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .ptab:hover {
        color: var(--p);
      }
      .ptab.active {
        color: var(--p);
        border-bottom-color: var(--p);
      }
      .form-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }
      @media (max-width: 768px) {
        .grid-2 {
          grid-template-columns: 1fr !important;
        }
        .form-footer {
          flex-wrap: wrap;
        }
        .ptab {
          font-size: 12px;
        }
      }
    `,
  ],
})
export class EmpProfileComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly detail = signal<EmployeeDetail | null>(null);
  private readonly apiId = signal<string | null>(null);
  private departmentIds = new Map<string, string>();

  protected readonly avatarUrl = signal<string | null>(null);
  protected readonly selectedDocFile = signal<File | null>(null);
  protected readonly uploadIssueDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly uploadExpiryDate = signal('');
  protected readonly uploadingDoc = signal(false);

  protected initials(): string {
    const name = this.personal().fullName || this.detail()?.fullName || '';
    if (!name.trim()) return 'EP';
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        this.avatarUrl.set(res);
        this.toast.show('Profile photo updated!', 'success');
      };
      reader.readAsDataURL(file);
    }
  }

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
    this.ui.close('empUploadDocModal');
  }

  protected uploadDocument(): void {
    const employeeId = this.apiId();
    if (!employeeId) {
      this.toast.show('Your profile is still loading.', 'danger');
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

  ngOnInit(): void {
    this.api.departments().subscribe({
      next: (departments) => {
        this.departmentIds = new Map(departments.map((d) => [d.name, d.id]));
      },
      error: () => {
        /* API offline — department mapping stays empty. */
      },
    });

    this.load();
  }

  private load(): void {
    this.api.employeeMe().subscribe({
      next: (employee) => {
        this.detail.set(employee);
        this.apiId.set(employee.id);

        this.personal.set({
          fullName: employee.fullName,
          dob: employee.dateOfBirth ?? '',
          gender: employee.gender,
          nationality: employee.nationality ?? '',
          marital: employee.maritalStatus,
          blood: employee.bloodGroup ?? '',
        });

        this.job.set({
          title: employee.jobTitle,
          dept: employee.department,
          reportsTo: employee.reportingManager ?? '',
          joinDate: employee.joinDate,
        });

        this.contact.set({
          phone: employee.phone ?? '',
          email: employee.email,
          emergencyName: '',
          emergencyPhone: '',
          address: employee.address ?? '',
          city: employee.city ?? '',
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

        this.loadDocuments(employee.id);
      },
      error: () => {
        this.toast.show('Could not load your profile.', 'danger');
      },
    });
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
        /* API offline — no documents. */
      },
    });
  }

  protected save(message: string): void {
    const id = this.apiId();
    const detail = this.detail();
    if (!id || !detail) {
      this.toast.show('Your profile is still loading.', 'danger');
      return;
    }

    const personal = this.personal();
    const job = this.job();
    const contact = this.contact();
    const identity = this.identity();
    const bank = this.bank();

    const [firstName, ...rest] = personal.fullName.trim().split(' ');
    const lastName = rest.join(' ') || detail.lastName;

    this.api
      .updateEmployee(id, {
        firstName: firstName || detail.firstName,
        middleName: detail.middleName,
        lastName,
        email: contact.email || detail.email,
        phone: contact.phone,
        departmentId: this.departmentIds.get(job.dept) ?? detail.departmentId,
        designationId: detail.designationId,
        branchId: detail.branchId,
        reportingManagerId: null,
        jobTitle: job.title,
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
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNumber: bank.accountNo,
        iban: bank.iban,
        ifscCode: bank.ifsc,
        swiftCode: bank.swift,
        paymentMode: bank.paymentMode,
        wpsId: bank.wpsId,
        passportNumber: identity.passportNo,
        passportExpiry: this.toIso(identity.passportExp),
        visaNumber: identity.visaNo,
        visaExpiry: this.toIso(identity.visaExp),
        emiratesId: identity.emiratesId,
      })
      .subscribe({
        next: (updated) => {
          this.detail.set(updated);
          this.toast.show(message);
        },
        error: (error) => this.toast.show(error?.error?.title ?? 'Could not save your profile.', 'danger'),
      });
  }

  private toIso(value: string): string | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  protected readonly tabs = [
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'contact', label: 'Contact', icon: 'mail' },
    { id: 'bank', label: 'Bank', icon: 'payroll' },
    { id: 'docs', label: 'Documents', icon: 'documents' },
  ] as const;

  protected readonly tab = signal<'personal' | 'contact' | 'bank' | 'docs'>('personal');

  protected readonly personal = signal({
    fullName: '',
    dob: '',
    gender: 'Female',
    nationality: '',
    marital: '',
    blood: '',
  });

  protected readonly job = signal({
    title: '',
    dept: '',
    reportsTo: '',
    joinDate: '',
  });

  protected readonly contact = signal({
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    address: '',
    city: '',
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

  protected readonly salaryStructure = computed<[string, string, string][]>(() => {
    const employee = this.detail();
    if (!employee) return [];

    const money = (value: number) => `$${value.toLocaleString()}`;
    const gross =
      employee.basicSalary +
      employee.housingAllowance +
      employee.transportAllowance +
      employee.mobileAllowance +
      employee.otherAllowances;

    return [
      ['Basic Salary', money(employee.basicSalary), 'var(--text)'],
      ['Housing Allowance', money(employee.housingAllowance), 'var(--text)'],
      ['Transport Allowance', money(employee.transportAllowance), 'var(--text)'],
      ['Mobile Allowance', money(employee.mobileAllowance), 'var(--text)'],
      ['Other Allowances', money(employee.otherAllowances), 'var(--text)'],
      ['Gross Salary', money(gross), 'var(--success)'],
    ];
  });

  protected readonly docs = signal<DocRow[]>([]);

  protected readonly uploadType = signal('Passport');

  protected readonly genderOptions: SelectOption[] = [
    { v: 'Female', l: 'Female' },
    { v: 'Male', l: 'Male' },
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
  protected readonly deptOptions: SelectOption[] = ['Engineering', 'Finance', 'HR', 'Sales', 'Marketing', 'Design'].map((d) => ({ v: d, l: d }));
  protected readonly reportingOptions: SelectOption[] = [];
  protected readonly countryOptions: SelectOption[] = ['UAE', 'Saudi Arabia', 'Qatar', 'United Kingdom', 'United States', 'India'].map((c) => ({ v: c, l: c }));
  protected readonly bankOptions: SelectOption[] = [
    { v: 'Emirates NBD', l: 'Emirates NBD' },
    { v: 'First Abu Dhabi Bank', l: 'First Abu Dhabi Bank' },
    { v: 'ADCB', l: 'ADCB' },
    { v: 'HSBC', l: 'HSBC' },
    { v: 'Other', l: 'Other' },
  ];
  protected readonly currencyOptions: SelectOption[] = ['AED', 'USD', 'SAR', 'GBP'].map((c) => ({ v: c, l: c }));
  protected readonly paymentOptions: SelectOption[] = [
    { v: 'Bank Transfer', l: 'Bank Transfer' },
    { v: 'WPS', l: 'WPS' },
    { v: 'Cheque', l: 'Cheque' },
    { v: 'Cash', l: 'Cash' },
  ];
  protected readonly uploadTypeOptions: SelectOption[] = ['Passport', 'Visa', 'Work Permit', 'Emirates ID', 'Medical Insurance', 'Other'].map((t) => ({ v: t, l: t }));

  protected patchPersonal(key: 'fullName' | 'dob' | 'gender' | 'nationality' | 'marital' | 'blood', value: string): void {
    this.personal.update((p) => ({ ...p, [key]: value }));
  }

  protected patchJob(key: 'title' | 'dept' | 'reportsTo' | 'joinDate', value: string): void {
    this.job.update((j) => ({ ...j, [key]: value }));
  }

  protected patchContact(key: 'phone' | 'email' | 'emergencyName' | 'emergencyPhone' | 'address' | 'city' | 'country', value: string): void {
    this.contact.update((c) => ({ ...c, [key]: value }));
  }

  protected patchIdentity(key: 'passportNo' | 'passportExp' | 'visaNo' | 'visaExp' | 'emiratesId', value: string): void {
    this.identity.update((i) => ({ ...i, [key]: value }));
  }

  protected patchBank(key: 'bankName' | 'accountName' | 'accountNo' | 'iban' | 'ifsc' | 'swift' | 'currency' | 'paymentMode' | 'wpsId', value: string): void {
    this.bank.update((b) => ({ ...b, [key]: value }));
  }
}
