import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { DocumentDto } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { triggerDocumentDownload } from '../../core/utils/document-download.util';

interface DocRow {
  doc: string;
  type: string;
  iss: string;
  exp: string;
  s: string;
  num: string;
  issuedBy: string;
  notes: string;
  fileUrl?: string | null;
  fileSize?: string | null;
}

interface CompanyDoc {
  name: string;
  size: string;
  date: string;
  fileUrl?: string | null;
}

/** My Documents — ported from pages/emp-documents.html. */
@Component({
  selector: 'app-emp-documents',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-end items-center" style="margin-bottom: 15px">
      <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="toast.show('Upload dialog')">
        <span [appIcon]="'upload2'"></span> Upload
      </button>
    </div>

    <div style="margin-bottom: 14px">
      <div class="tabs mb-4">
        <button class="tab-btn" [class.active]="tab() === 'my'" (click)="tab.set('my')">My Documents</button>
        <button class="tab-btn" [class.active]="tab() === 'company'" (click)="tab.set('company')">Company Documents</button>
      </div>

      @if (tab() === 'my') {
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th class="col-hide">Type</th>
                  <th class="col-hide">Issue Date</th>
                  <th>Expiry</th>
                  <th class="col-hide">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (r of docs(); track r.doc + r.num) {
                  <tr>
                    <td style="font-weight: 600; white-space: nowrap">{{ r.doc }}</td>
                    <td class="col-hide"><span class="badge badge-info">{{ r.type }}</span></td>
                    <td class="col-hide" style="white-space: nowrap">{{ r.iss }}</td>
                    <td style="white-space: nowrap">{{ r.exp }}</td>
                    <td class="col-hide"><span class="badge badge-success">{{ r.s }}</span></td>
                    <td>
                      <div style="display: flex; gap: 6px">
                        <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="view(r)"><span [appIcon]="'eye'"></span></button>
                        <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="downloadMyDoc(r)"><span [appIcon]="'download'"></span></button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (tab() === 'company') {
        <div class="card">
          <div class="card-body">
            @for (d of companyDocs(); track d.name) {
              <div style="display: flex; align-items: center; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border)">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--p-soft); display: flex; align-items: center; justify-content: center; color: var(--p)">
                  <span [appIcon]="'documents'"></span>
                </div>
                <div style="flex: 1">
                  <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px">{{ d.name }}</div>
                  <div style="font-size: 13px; color: var(--muted)">{{ d.size }} · {{ d.date }}</div>
                </div>
                <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="downloadCompanyDoc(d)"><span [appIcon]="'download'"></span></button>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <div class="modal-overlay" [class.open]="ui.isOpen('docModal')" (click)="ui.onOverlayClick($event, 'docModal')">
      <div class="modal" style="max-width: 700px">
        <div class="modal-header">
          <div>
            <div class="card-title" style="font-size: 14px">{{ viewTarget()?.doc }} · Details</div>
            <div class="card-subtitle">{{ viewTarget()?.type }} Document</div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('docModal')"><span [appIcon]="'x'"></span></button>
        </div>
        @if (viewTarget(); as r) {
          <div class="modal-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
              @for (f of fields(r); track f[0]) {
                <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                  <div style="font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em">
                    {{ f[0] }}
                  </div>
                  <div style="font-size: 13px; font-weight: 400; color: var(--text)">{{ f[1] }}</div>
                </div>
              }
            </div>

            @if (r.fileUrl && (r.fileUrl.startsWith('data:image') || r.fileUrl.endsWith('.jpg') || r.fileUrl.endsWith('.png'))) {
              <div style="text-align: center; background: #0f172a; border-radius: 8px; padding: 12px; margin-bottom: 12px; max-height: 240px; overflow: hidden;">
                <img [src]="r.fileUrl" alt="Document Preview" style="max-height: 220px; max-width: 100%; object-fit: contain; border-radius: 6px;" />
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="ui.close('docModal')">Close</button>
            <button class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;" (click)="downloadMyDoc(r)">
              <span [appIcon]="'download'"></span> Download Document
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      @media (max-width: 480px) {
        .col-hide {
          display: none;
        }
      }
    `,
  ],
})
export class EmpDocumentsComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly tab = signal<'my' | 'company'>('my');
  protected readonly viewTarget = signal<DocRow | null>(null);

  protected readonly docs = signal<DocRow[]>([]);
  protected readonly companyDocs = signal<CompanyDoc[]>([]);

  private readonly currentEmpName = signal<string>('Employee');
  private readonly currentEmpCode = signal<string>('EMP');

  ngOnInit(): void {
    this.api.employeeMe().subscribe({
      next: (employee) => {
        this.currentEmpName.set(employee.fullName || `${employee.firstName} ${employee.lastName}`);
        this.currentEmpCode.set(employee.employeeCode || 'EMP');
        this.api.documents({ employeeId: employee.id }).subscribe({
          next: (rows) => this.docs.set(rows.map((row) => this.toRow(row))),
          error: () => {
            /* API offline — no personal documents. */
          },
        });
      },
      error: () => {
        /* API offline — no personal documents. */
      },
    });

    this.api.documents().subscribe({
      next: (rows) =>
        this.companyDocs.set(
          rows
            .filter((row) => row.isCompanyDocument)
            .map((row) => ({ name: row.name, size: row.fileSize ?? '—', date: row.issueDate ?? '—', fileUrl: row.fileUrl ?? null })),
        ),
      error: () => {
        /* API offline — no company documents. */
      },
    });
  }

  private toRow(row: DocumentDto): DocRow {
    return {
      doc: row.name,
      type: row.type,
      iss: row.issueDate ?? ' · ',
      exp: row.expiryDate ?? ' · ',
      s: row.status,
      num: row.documentNumber ?? '—',
      issuedBy: row.issuedBy ?? '—',
      notes: row.notes ?? '—',
      fileUrl: row.fileUrl ?? null,
      fileSize: row.fileSize ?? null,
    };
  }

  protected downloadMyDoc(r: DocRow): void {
    triggerDocumentDownload(r.doc, r.fileUrl, {
      employeeName: this.currentEmpName(),
      employeeCode: this.currentEmpCode(),
      issueDate: r.iss,
      expiryDate: r.exp,
      status: r.s,
      type: r.type,
    });
    this.toast.show(`Downloaded ${r.doc}`, 'success');
  }

  protected downloadCompanyDoc(d: CompanyDoc): void {
    triggerDocumentDownload(d.name, d.fileUrl, {
      employeeName: 'All Employees',
      employeeCode: 'COMPANY',
      issueDate: d.date,
      status: 'Active',
      type: 'Company Policy',
    });
    this.toast.show(`Downloaded ${d.name}`, 'success');
  }

  protected fields(r: DocRow): [string, string][] {
    return [
      ['Document', r.doc],
      ['Type', r.type],
      ['Document No.', r.num],
      ['Issued By', r.issuedBy],
      ['Issue Date', r.iss],
      ['Expiry', r.exp],
      ['Status', r.s],
      ['Notes', r.notes],
    ];
  }

  protected view(r: DocRow): void {
    this.viewTarget.set(r);
    this.ui.open('docModal');
  }
}
