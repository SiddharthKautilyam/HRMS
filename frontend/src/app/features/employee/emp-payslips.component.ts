import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDetail, Payslip as ApiPayslip } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface PayslipRow {
  id: string;
  m: string;
  net: string;
  gross: string;
  ded: string;
  days: number;
  status: string;
  date: string;
}

/** My Payslips — ported from pages/emp-payslips.html. */
@Component({
  selector: 'app-emp-payslips',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px">
      <div>
        <div class="page-title">My Payslips</div>
        <div class="page-subtitle">{{ employee()?.fullName ?? 'Your payslips' }} - {{ employee()?.employeeCode ?? '—' }} - {{ employee()?.department ?? '—' }}</div>
      </div>
      <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="toast.show('Downloading latest payslip...')">
        <span [appIcon]="'download'"></span> Download Latest
      </button>
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px">
        <div class="card-title">Payslip History</div>
        <app-select [options]="yearOptions()" [value]="year()" (valueChange)="year.set($event)" width="130px" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Pay Date</th>
              <th>Working Days</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net Pay</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td style="font-weight: 600">{{ p.m }}</td>
                <td style="color: var(--muted)">{{ p.date }}</td>
                <td>{{ p.days }}</td>
                <td style="font-weight: 600">{{ p.gross }}</td>
                <td style="font-weight: 600; color: var(--danger)">{{ p.ded }}</td>
                <td style="font-weight: 800; color: var(--p)">{{ p.net }}</td>
                <td><span class="badge badge-success">{{ p.status }}</span></td>
                <td>
                  <div style="display: flex; gap: 4px">
                    <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="view(p)"><span [appIcon]="'eye'"></span></button>
                    <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading ' + p.m + ' payslip...')">
                      <span [appIcon]="'download'"></span>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" [class.open]="ui.isOpen('viewModal')" (click)="ui.onOverlayClick($event, 'viewModal')">
      <div class="modal" style="max-width: 600px">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">{{ viewTarget()?.m }} Payslip</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('viewModal')"><span [appIcon]="'x'"></span></button>
        </div>
        @if (viewTarget(); as p) {
          <div class="modal-body">
            <div style="background: var(--p-soft); border-radius: 10px; padding: 15px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap">
              <div>
                <div style="font-size: 13px; color: var(--muted); margin-bottom: 3px">Employee</div>
                <div style="font-weight: 700">{{ employee()?.fullName ?? '—' }}</div>
                <div style="font-size: 13px; color: var(--muted); margin-top: 2px">{{ employee()?.employeeCode ?? '—' }} - {{ employee()?.department ?? '—' }}</div>
              </div>
              <div>
                <div style="font-size: 13px; color: var(--muted); margin-bottom: 3px">Pay Period</div>
                <div style="font-weight: 700">{{ p.m }}</div>
                <div style="font-size: 13px; color: var(--muted); margin-top: 2px">Pay Date: {{ p.date }}</div>
              </div>
            </div>

            @for (r of breakdown(); track r[0]) {
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border)">
                <span style="font-size: 13px; font-weight: 600; color: var(--muted)">{{ r[0] }}</span>
                <span style="font-size: 13px; font-weight: 600" [style.color]="r[2] || 'var(--text)'">{{ r[1] }}</span>
              </div>
            }

            <div style="background: var(--p-soft); border: 2px solid rgba(37,99,235,.2); border-radius: 12px; padding: 15px 10px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px">
              <div style="font-size: 14px; font-weight: 700">Net Pay</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--p)">{{ p.net }}</div>
            </div>
          </div>
        }
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('viewModal')">Close</button>
          <button class="btn btn-primary" style="display: flex; align-items: center; gap: 6px" (click)="download()">
            <span [appIcon]="'download'"></span> Download PDF
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      thead th,
      tbody td {
        white-space: nowrap;
      }
    `,
  ],
})
export class EmpPayslipsComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly employee = signal<EmployeeDetail | null>(null);
  protected readonly yearOptions = signal<SelectOption[]>([{ v: '', l: 'All Years' }]);
  protected readonly year = signal('');
  protected readonly viewTarget = signal<PayslipRow | null>(null);
  protected readonly breakdown = signal<[string, string, string?][]>([]);

  private readonly payslips = signal<ApiPayslip[]>([]);

  protected readonly allPayslips = computed<PayslipRow[]>(() =>
    this.payslips().map((p) => ({
      id: p.id,
      m: `${this.monthName(p.month)} ${p.year}`,
      date: p.payDate,
      days: p.workingDays,
      gross: this.money(p.basicSalary + p.allowances),
      ded: this.money(p.deductions),
      net: this.money(p.netPay),
      status: p.status,
    })),
  );

  protected readonly filtered = computed(() => {
    const y = this.year();
    const rows = this.allPayslips();
    return y ? rows.filter((p) => p.m.includes(y)) : rows;
  });

  ngOnInit(): void {
    this.api.myPayslips().subscribe({
      next: (payslips) => {
        this.payslips.set(payslips);
        const years = [...new Set(payslips.map((p) => String(p.year)))].sort().reverse();
        this.yearOptions.set([{ v: '', l: 'All Years' }, ...years.map((y) => ({ v: y, l: y }))]);
      },
      error: () => this.toast.show('Could not load your payslips.', 'danger'),
    });

    this.api.employeeMe().subscribe({
      next: (employee) => this.employee.set(employee),
      error: () => {
        /* API offline — employee block stays blank. */
      },
    });
  }

  protected view(row: PayslipRow): void {
    const payslip = this.payslips().find((p) => p.id === row.id);
    if (payslip) {
      this.breakdown.set([
        ['Basic Salary', this.money(payslip.basicSalary)],
        ['Allowances', this.money(payslip.allowances)],
        ['Deductions', `-${this.money(payslip.deductions)}`, 'var(--danger)'],
        ['Net Pay', this.money(payslip.netPay), 'var(--p)'],
      ]);
    }

    this.viewTarget.set(row);
    this.ui.open('viewModal');
  }

  protected download(): void {
    this.toast.show('Downloading PDF...');
    this.ui.close('viewModal');
  }

  private money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  private monthName(month: number): string {
    return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }
}
