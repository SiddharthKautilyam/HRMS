import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { DocumentDto } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';

interface DocRow {
  doc: string;
  type: string;
  iss: string;
  exp: string;
  s: string;
  num: string;
  issuedBy: string;
  notes: string;
}

interface CompanyDoc {
  name: string;
  size: string;
  date: string;
}

/** My Documents — ported from pages/emp-documents.html. */
@Component({
  selector: 'app-emp-documents',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 15px">
      <div>
        <div class="page-title">My Documents</div>
        <div class="page-subtitle">Manage your personal and company documents</div>
      </div>
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
                        <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading ' + r.doc + '...')"><span [appIcon]="'download'"></span></button>
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
                <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading...')"><span [appIcon]="'download'"></span></button>
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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
              @for (f of fields(r); track f[0]) {
                <div style="background: var(--bg); border-radius: 8px; padding: 10px">
                  <div style="font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em">
                    {{ f[0] }}
                  </div>
                  <div style="font-size: 13px; font-weight: 400; color: var(--text)">{{ f[1] }}</div>
                </div>
              }
            </div>
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

  ngOnInit(): void {
    this.api.employeeMe().subscribe({
      next: (employee) =>
        this.api.documents({ employeeId: employee.id }).subscribe({
          next: (rows) => this.docs.set(rows.map((row) => this.toRow(row))),
          error: () => {
            /* API offline — no personal documents. */
          },
        }),
      error: () => {
        /* API offline — no personal documents. */
      },
    });

    this.api.documents().subscribe({
      next: (rows) =>
        this.companyDocs.set(
          rows
            .filter((row) => row.isCompanyDocument)
            .map((row) => ({ name: row.name, size: row.fileSize ?? '—', date: row.issueDate ?? '—' })),
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
    };
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
