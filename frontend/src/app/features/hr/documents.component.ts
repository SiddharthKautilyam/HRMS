import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface DocumentRow {
  id?: string;
  n: string;
  doc: string;
  t: string;
  iss: string;
  exp: string;
  days: number;
  s: 'Critical' | 'Warning' | 'Valid' | 'Expired';
  fileUrl?: string | null;
  fileSize?: string | null;
}

/** Document Management — ported from pages/documents.html. */
@Component({
  selector: 'app-documents',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div class="page-header-row">
      <div>
        <div class="page-title">Document Management</div>
        <div class="page-subtitle">Upload, track and manage employee documents</div>
      </div>
      <button class="btn btn-primary btn-sm" (click)="ui.open('uploadModal')"><span [appIcon]="'plus'"></span> Upload Document</button>
    </div>

    <div class="grid-4" style="margin-bottom: 16px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.bg" [style.color]="k.c"><span [appIcon]="'documents'"></span></div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">All Documents</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <input class="form-control" placeholder="Search..." style="width: 200px" [value]="search()" (input)="search.set($any($event.target).value)" />
          <app-select [options]="typeOptions" [value]="type()" (valueChange)="type.set($event)" width="140px" />
          <app-select [options]="statusOptions" [value]="status()" (valueChange)="status.set($event)" width="120px" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="docs-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Document</th>
              <th>Type</th>
              <th>Issue Date</th>
              <th>Expiry</th>
              <th>Days Left</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.n + r.doc) {
              <tr>
                <td>
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p)">{{ initials(r.n) }}</div>
                    <span style="font-weight: 600">{{ r.n }}</span>
                  </div>
                </td>
                <td style="font-weight: 600">{{ r.doc }}</td>
                <td><span class="badge badge-info">{{ r.t }}</span></td>
                <td style="color: var(--muted)">{{ r.iss }}</td>
                <td>{{ r.exp }}</td>
                <td><span style="font-weight: 700; color: var(--text)">{{ formatDaysLeft(r.days, r.exp) }}</span></td>
                <td><span class="badge" [class]="docClass(r.s)">{{ r.s }}</span></td>
                <td>
                  <div style="display: flex; gap: 4px">
                    <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="view(r)"><span [appIcon]="'eye'"></span></button>
                    <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="downloadDocument(r)"><span [appIcon]="'download'"></span></button>
                    <button class="btn btn-ghost btn-sm" data-tooltip="Remove" style="color: var(--danger)" (click)="removeDocument(r)"><span [appIcon]="'trash'"></span></button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" style="text-align: center; padding: 24px; color: var(--muted);">
                  No documents found. Click "Upload Document" to add one.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Doc View Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('docViewModal')" (click)="ui.onOverlayClick($event, 'docViewModal')">
      <div class="modal" style="max-width: 650px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <div>
            <div class="card-title" style="font-size: 15px; font-weight: 700;">{{ viewTarget()?.doc }} — Details</div>
            <div class="card-subtitle">{{ viewTarget()?.n }} · {{ viewTarget()?.t }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('docViewModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body" style="overflow-y: auto; max-height: calc(90vh - 130px);">
          @if (viewTarget(); as r) {
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
              @for (f of viewFields(r); track f[0]) {
                <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                  <div style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px">
                    {{ f[0] }}
                  </div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text)">{{ f[1] }}</div>
                </div>
              }
            </div>
            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg); border-radius: 8px">
              <span style="font-size: 12px; font-weight: 700">Status</span>
              <span class="badge" [class]="docClass(r.s)">{{ r.s }}</span>
            </div>

            <!-- Uploaded Document Preview Area -->
            <div style="margin-top: 14px; border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: var(--surface);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em;">
                  Document File Preview
                </span>
                <a [href]="resolveFileUrl(r)" target="_blank" class="btn btn-ghost btn-sm" style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                  Open Original ↗
                </a>
              </div>

              @if (isImage(r)) {
                <div style="text-align: center; background: var(--bg); border-radius: 6px; padding: 12px; min-height: 200px; display: flex; align-items: center; justify-content: center;">
                  <img 
                    [src]="resolveFileUrl(r)" 
                    [alt]="r.doc" 
                    style="max-height: 320px; max-width: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);"
                    (error)="onImgError($event, r)"
                  />
                </div>
              } @else if (isPdf(r)) {
                <div style="background: var(--bg); border-radius: 6px; overflow: hidden; height: 350px;">
                  <iframe [src]="safePdfUrl(r)" style="width: 100%; height: 100%; border: none;"></iframe>
                </div>
              } @else {
                <div style="text-align: center; background: var(--bg); border-radius: 6px; padding: 24px;">
                  <div style="color: var(--p); font-size: 32px; margin-bottom: 6px;"><span [appIcon]="'documents'"></span></div>
                  <div style="font-weight: 700; font-size: 14px; color: var(--text);">{{ r.doc }}</div>
                  <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">{{ r.fileSize || 'Standard document' }} &bull; Ready to view and download</div>
                </div>
              }
            </div>
          }
        </div>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button class="btn btn-outline" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3); display: flex; align-items: center; gap: 6px;" (click)="removeDocument(viewTarget())">
            <span [appIcon]="'trash'"></span> Remove
          </button>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline" (click)="ui.close('docViewModal')">Close</button>
            <button class="btn btn-primary" style="display: flex; align-items: center; gap: 6px" (click)="downloadDocument(viewTarget())">
              <span [appIcon]="'download'"></span> Download
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div class="modal-overlay" [class.open]="ui.isOpen('uploadModal')" (click)="ui.onOverlayClick($event, 'uploadModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 1rem; font-weight: 600">Upload Document</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('uploadModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Employee</label>
            <app-select [options]="employeeOptions()" [value]="uploadEmployee()" (valueChange)="uploadEmployee.set($event)" width="100%" />
          </div>
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
            <input #fileInput type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" (change)="onFileSelected($event)" style="display: none" />
            <div
              style="border: 2px dashed var(--border); border-radius: var(--r); padding: 24px; text-align: center; cursor: pointer; transition: var(--t)"
              [style.borderColor]="selectedFile() ? 'var(--p)' : 'var(--border)'"
              [style.background]="selectedFile() ? 'var(--p-soft)' : 'transparent'"
              (click)="fileInput.click()"
              (dragover)="$event.preventDefault()"
              (drop)="onFileDrop($event)"
            >
              @if (selectedFile()) {
                <div style="color: var(--p); margin-bottom: 6px"><span [appIcon]="'check'"></span></div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text)">{{ selectedFile()?.name }}</div>
                <div style="font-size: 0.78rem; color: var(--muted); margin-top: 3px">{{ formatFileSize(selectedFile()?.size || 0) }} &bull; Click to change file</div>
              } @else {
                <div style="color: var(--p); margin-bottom: 8px"><span [appIcon]="'upload2'"></span></div>
                <div style="font-size: 0.86rem; font-weight: 600">Drop files here or click to browse</div>
                <div style="font-size: 0.86rem; color: var(--muted); margin-top: 4px">PDF, JPG, PNG up to 10MB</div>
              }
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="closeUploadModal()">Cancel</button>
          <button class="btn btn-primary" [disabled]="uploading()" (click)="submitUpload()">
            {{ uploading() ? 'Uploading...' : 'Upload' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      thead th,
      .docs-table td,
      .docs-table .table-avatar span,
      .docs-table .badge {
        white-space: nowrap;
      }
      @media (max-width: 768px) {
        .docs-table th:nth-child(3),
        .docs-table td:nth-child(3),
        .docs-table th:nth-child(4),
        .docs-table td:nth-child(4),
        .docs-table th:nth-child(5),
        .docs-table td:nth-child(5),
        .docs-table th:nth-child(6),
        .docs-table td:nth-child(6) {
          display: none;
        }
      }
      @media (max-width: 480px) {
        .docs-table th:nth-child(7),
        .docs-table td:nth-child(7) {
          display: none;
        }
      }
    `,
  ],
})
export class DocumentsComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly kpis = signal([
    { l: 'Total Documents', v: '0', c: 'var(--p)', bg: 'var(--p-soft)' },
    { l: 'Expiring Soon', v: '0', c: 'var(--warning)', bg: 'var(--warning-soft)' },
    { l: 'Expired', v: '0', c: 'var(--danger)', bg: 'var(--danger-soft)' },
    { l: 'Valid', v: '0', c: 'var(--success)', bg: 'var(--success-soft)' },
  ]);

  protected readonly typeOptions: SelectOption[] = [
    { v: '', l: 'All Types' },
    { v: 'Identity', l: 'Identity' },
    { v: 'Legal', l: 'Legal' },
    { v: 'Employment', l: 'Employment' },
    { v: 'Benefits', l: 'Benefits' },
    { v: 'Other', l: 'Company Policies' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { v: '', l: 'All Status' },
    { v: 'Valid', l: 'Valid' },
    { v: 'Warning', l: 'Expiring' },
    { v: 'Critical', l: 'Critical' },
    { v: 'Expired', l: 'Expired' },
  ];

  protected readonly employeeOptions = signal<SelectOption[]>([]);

  protected readonly uploadTypeOptions: SelectOption[] = [
    { v: 'Passport', l: 'Passport' },
    { v: 'Visa', l: 'Visa' },
    { v: 'Work Permit', l: 'Work Permit' },
    { v: 'Emirates ID', l: 'Emirates ID' },
    { v: 'Insurance', l: 'Insurance' },
  ];

  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly status = signal('');
  protected readonly uploadEmployee = signal('');
  protected readonly uploadType = signal('Passport');
  protected readonly uploadIssueDate = signal('');
  protected readonly uploadExpiryDate = signal('');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly viewTarget = signal<DocumentRow | null>(null);

  private employeeMap = new Map<string, string>();

  protected readonly rows = signal<DocumentRow[]>([]);

  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const t = this.type();
    const s = this.status();
    return this.rows().filter(
      (r) => (!q || r.n.toLowerCase().includes(q) || r.doc.toLowerCase().includes(q)) && (!t || r.t === t) && (!s || r.s === s),
    );
  });

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
    }
  }

  protected onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.selectedFile.set(event.dataTransfer.files[0]);
    }
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  protected closeUploadModal(): void {
    this.selectedFile.set(null);
    this.uploadIssueDate.set('');
    this.uploadExpiryDate.set('');
    this.ui.close('uploadModal');
  }

  protected submitUpload(): void {
    const file = this.selectedFile();
    const type = this.uploadType();
    const empName = this.uploadEmployee();
    const empId = this.employeeMap.get(empName);

    const documentType = type === 'Visa' || type === 'Work Permit'
      ? 'Legal'
      : type === 'Insurance'
        ? 'Benefits'
        : 'Identity';

    const docName = file ? file.name : `${type} Document`;
    const fileSize = file ? this.formatFileSize(file.size) : '1.2 MB';

    this.uploading.set(true);

    if (file) {
      // 1. Physically upload the file to backend storage
      this.api.uploadFile(file).subscribe({
        next: (uploadRes) => {
          // 2. Save metadata + permanent fileUrl in database
          this.api
            .createDocument({
              employeeId: empId || null,
              name: docName,
              type: documentType,
              issueDate: this.uploadIssueDate() || new Date().toISOString().slice(0, 10),
              expiryDate: this.uploadExpiryDate() || null,
              notes: null,
              fileUrl: uploadRes.url,
              fileSize: uploadRes.size || fileSize,
              isCompanyDocument: !empId,
            })
            .subscribe({
              next: () => {
                this.uploading.set(false);
                this.closeUploadModal();
                this.toast.show('Document uploaded and saved successfully!', 'success');
                this.loadDocuments();
                this.loadSummary();
              },
              error: (err) => {
                this.uploading.set(false);
                this.toast.show(err?.error?.message || 'Could not save document record.', 'danger');
              },
            });
        },
        error: (err) => {
          this.uploading.set(false);
          this.toast.show(err?.error?.message || 'File upload failed.', 'danger');
        },
      });
    } else {
      this.api
        .createDocument({
          employeeId: empId || null,
          name: docName,
          type: documentType,
          issueDate: this.uploadIssueDate() || new Date().toISOString().slice(0, 10),
          expiryDate: this.uploadExpiryDate() || null,
          notes: null,
          fileUrl: null,
          fileSize,
          isCompanyDocument: !empId,
        })
        .subscribe({
          next: () => {
            this.uploading.set(false);
            this.closeUploadModal();
            this.toast.show('Document record created!', 'success');
            this.loadDocuments();
            this.loadSummary();
          },
          error: (err) => {
            this.uploading.set(false);
            this.toast.show(err?.error?.message || 'Could not create document.', 'danger');
          },
        });
    }
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadDocuments();
    this.loadEmployees();
  }

  private loadEmployees(): void {
    this.api.employees({ pageSize: 100 }).subscribe({
      next: (res) => {
        this.employeeMap = new Map((res.items || []).map((e) => [e.fullName, e.id]));
        const list = (res.items || []).map((e) => ({
          v: e.fullName,
          l: e.fullName,
        }));
        this.employeeOptions.set(list);
        if (list.length > 0 && !this.uploadEmployee()) {
          this.uploadEmployee.set(list[0].v);
        }
      },
      error: () => {},
    });
  }

  private loadSummary(): void {
    this.api.documentSummary().subscribe({
      next: (summary) =>
        this.kpis.set([
          { l: 'Total Documents', v: `${summary.total}`, c: 'var(--p)', bg: 'var(--p-soft)' },
          { l: 'Expiring Soon', v: `${summary.expiringSoon}`, c: 'var(--warning)', bg: 'var(--warning-soft)' },
          { l: 'Expired', v: `${summary.expired}`, c: 'var(--danger)', bg: 'var(--danger-soft)' },
          { l: 'Valid', v: `${summary.valid}`, c: 'var(--success)', bg: 'var(--success-soft)' },
        ]),
      error: () => {},
    });
  }

  private loadDocuments(): void {
    this.api.documents().subscribe({
      next: (documents) =>
        this.rows.set(
          (documents || []).map((d) => ({
            id: d.id,
            n: d.employeeName ?? 'Company',
            doc: d.name,
            t: d.type,
            iss: d.issueDate ? this.formatDate(d.issueDate) : ' · ',
            exp: d.expiryDate ? this.formatDate(d.expiryDate) : ' · ',
            days: d.daysLeft ?? 0,
            s: d.status as DocumentRow['s'],
            fileUrl: d.fileUrl,
            fileSize: d.fileSize,
          })),
        ),
      error: () => {
        this.rows.set([]);
      },
    });
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected docClass(s: DocumentRow['s']): string {
    return `badge-${s === 'Critical' || s === 'Expired' ? 'danger' : s === 'Warning' ? 'warning' : 'success'}`;
  }

  protected formatDaysLeft(days?: number | null, expiryDate?: string | null): string {
    if (!expiryDate || expiryDate === ' · ' || expiryDate === '-' || expiryDate === 'NULL') {
      return '—';
    }
    if (days === null || days === undefined) {
      return '—';
    }
    if (days < 0) {
      return `Expired (${Math.abs(days)}d)`;
    }
    if (days === 0) {
      return 'Today';
    }
    if (days < 30) {
      return `${days}d`;
    }
    if (days < 365) {
      const months = Math.max(1, Math.round(days / 30.4));
      return `${months} mo${months > 1 ? 's' : ''}`;
    }
    let years = Math.floor(days / 365);
    let remMonths = Math.round((days % 365) / 30.4);
    if (remMonths >= 12) {
      years += 1;
      remMonths = 0;
    }
    if (remMonths > 0) {
      return `${years}y ${remMonths}m`;
    }
    return `${years} yr${years > 1 ? 's' : ''}`;
  }

  protected viewFields(r: DocumentRow): [string, string][] {
    return [
      ['Employee', r.n],
      ['Document', r.doc],
      ['Type', r.t],
      ['Issue Date', r.iss],
      ['Expiry Date', r.exp],
      ['Days Left', this.formatDaysLeft(r.days, r.exp)],
    ];
  }

  protected view(r: DocumentRow): void {
    this.viewTarget.set(r);
    this.ui.open('docViewModal');
  }

  protected resolveFileUrl(r: DocumentRow): string {
    const raw = (r.fileUrl || r.doc || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    if (raw.startsWith('/api/') || raw.startsWith('/uploads/')) {
      return raw;
    }
    return `/api/files/download/${encodeURIComponent(raw)}`;
  }

  protected isImage(r: DocumentRow): boolean {
    const name = (r.doc || r.fileUrl || '').toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.svg') || name.endsWith('.webp') || name.endsWith('.gif');
  }

  protected isPdf(r: DocumentRow): boolean {
    const name = (r.doc || r.fileUrl || '').toLowerCase();
    return name.endsWith('.pdf');
  }

  protected safePdfUrl(r: DocumentRow): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.resolveFileUrl(r));
  }

  protected onImgError(event: Event, r: DocumentRow): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.dataset['triedFallback']) {
      img.dataset['triedFallback'] = 'true';
      img.src = `/api/files/download/${encodeURIComponent(r.doc)}`;
    }
  }

  protected downloadDocument(r?: DocumentRow | null): void {
    if (!r) return;
    const url = this.resolveFileUrl(r);
    const fileName = r.doc || 'document';

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.toast.show(`Downloading ${fileName}...`, 'info');
  }

  protected removeDocument(r?: DocumentRow | null): void {
    if (!r) return;
    const docName = r.doc || 'this document';
    if (!confirm(`Are you sure you want to remove "${docName}"? This action cannot be undone.`)) {
      return;
    }

    if (r.id) {
      this.api.deleteDocument(r.id).subscribe({
        next: () => {
          this.toast.show(`Document "${docName}" removed successfully.`, 'success');
          this.ui.close('docViewModal');
          this.viewTarget.set(null);
          this.loadDocuments();
          this.loadSummary();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || err?.error?.detail || 'Failed to remove document.', 'danger');
        },
      });
    } else {
      this.rows.update((list) => list.filter((x) => x !== r));
      this.ui.close('docViewModal');
      this.viewTarget.set(null);
      this.toast.show(`Document "${docName}" removed.`, 'success');
      this.loadSummary();
    }
  }
}
