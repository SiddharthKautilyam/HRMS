import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';

interface Loan {
  apiId?: string;
  n: string;
  t: string;
  amt: number;
  emi: number;
  paid: number;
  bal: number;
  ten: string;
  s: 'Active' | 'Pending' | 'Closed';
}

/** Loans & Advances — ported from pages/loans.html. */
@Component({
  selector: 'app-loans',
  imports: [CommonModule, IconDirective, SelectComponent],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">Loans &amp; Advances</div>
        <div class="page-subtitle">Manage employee loan requests</div>
      </div>
      <button class="btn btn-primary btn-sm" (click)="openModal()">+ New Request</button>
    </div>

    <div class="grid-4" style="margin-bottom: 24px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" style="background: var(--p-soft)" [style.color]="k.c"><span [appIcon]="'loans'"></span></div>
          <div class="kpi-value">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
        </div>
      }
    </div>

    <div class="card">
      <div class="card-header" style="margin-bottom: 12px">
        <div class="card-title">Loan Register</div>
        <div style="display: flex; gap: 8px">
          <app-select [options]="statusOptions" [value]="status()" (valueChange)="status.set($event)" width="140px" />
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Loan Type</th>
              <th class="loan-col-amt">Amount</th>
              <th class="loan-col-emi">EMI</th>
              <th class="loan-col-paid">Paid</th>
              <th class="loan-col-bal">Balance</th>
              <th class="loan-col-ten">Tenure</th>
              <th class="loan-col-status">Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.n + r.t) {
              <tr>
                <td class="loan-emp-cell">
                  <div class="table-avatar">
                    <div class="avatar-placeholder avatar-sm" style="background: var(--p-soft); color: var(--p)">{{ initials(r.n) }}</div>
                    <span style="font-weight: 600; font-size: 13px">{{ r.n }}</span>
                  </div>
                </td>
                <td><span class="badge badge-primary loan-type-badge">{{ r.t }}</span></td>
                <td class="loan-col-amt" style="font-weight: 700">{{ '$' + r.amt.toLocaleString() }}</td>
                <td class="loan-col-emi">{{ r.emi ? '$' + r.emi : ' · ' }}</td>
                <td class="loan-col-paid" style="color: var(--success); font-weight: 600">{{ '$' + r.paid.toLocaleString() }}</td>
                <td class="loan-col-bal" [style.color]="r.bal ? 'var(--danger)' : 'var(--success)'" style="font-weight: 700">
                  {{ '$' + r.bal.toLocaleString() }}
                </td>
                <td class="loan-col-ten" style="font-size: 13px; color: var(--muted)">{{ r.ten }}</td>
                <td class="loan-col-status">
                  <span class="badge" [class]="loanClass(r.s)">{{ r.s }}</span>
                </td>
                <td>
                  <div style="display: flex; gap: 4px; align-items: center">
                    @if (r.s === 'Pending') {
                      <button class="btn btn-success btn-sm" data-tooltip="Approve" (click)="approve(r, true)"><span [appIcon]="'check'"></span></button>
                      <button class="btn btn-danger btn-sm" data-tooltip="Reject" (click)="approve(r, false)"><span [appIcon]="'x'"></span></button>
                    } @else {
                      <button class="btn btn-ghost btn-sm" data-tooltip="View" (click)="toast.show(r.n + ' · ' + r.t)"><span [appIcon]="'eye'"></span></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" style="text-align: center; padding: 24px; color: var(--muted);">
                  No loans or advances found.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" [class.open]="ui.isOpen('loanModal')" (click)="ui.onOverlayClick($event, 'loanModal')">
      <div class="modal">
        <div class="modal-header">
          <div style="font-size: 1.1rem; font-weight: 700">New Loan / Advance Request</div>
          <button class="btn btn-ghost btn-sm" (click)="ui.close('loanModal')"><span [appIcon]="'x'"></span></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Employee</label>
            <app-select [options]="employeeOptions()" [value]="form().employee" (valueChange)="patch('employee', $event)" width="100%" />
          </div>
          <div class="form-group">
            <label class="form-label">Loan Type</label>
            <app-select [options]="loanTypeOptions" [value]="form().type" (valueChange)="patch('type', $event)" width="100%" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Amount</label>
              <input class="form-control" placeholder="$0.00" [value]="form().amount" (input)="patch('amount', $any($event.target).value)" />
            </div>
            <div class="form-group">
              <label class="form-label">Repayment Months</label>
              <input class="form-control" type="number" placeholder="12" [value]="form().months" (input)="patch('months', $any($event.target).value)" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Reason</label>
            <textarea class="form-control" rows="3" placeholder="Reason for loan..." [value]="form().reason" (input)="patch('reason', $any($event.target).value)"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="ui.close('loanModal')">Cancel</button>
          <button class="btn btn-primary" (click)="submit()">Submit</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .loan-emp-cell {
        white-space: nowrap;
      }
      .loan-type-badge {
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        .loan-col-amt,
        .loan-col-emi,
        .loan-col-paid,
        .loan-col-bal,
        .loan-col-ten {
          display: none;
        }
      }
      @media (max-width: 400px) {
        .loan-col-status {
          display: none;
        }
      }
    `,
  ],
})
export class LoansComponent implements OnInit {
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly kpis = signal([
    { l: 'Total Disbursed', v: '$0', c: 'var(--p)' },
    { l: 'Outstanding', v: '$0', c: 'var(--danger)' },
    { l: 'Active Loans', v: '0', c: 'var(--warning)' },
    { l: 'Pending Approval', v: '0', c: 'var(--p)' },
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { v: '', l: 'All Status' },
    { v: 'Active', l: 'Active' },
    { v: 'Pending', l: 'Pending' },
    { v: 'Closed', l: 'Closed' },
  ];

  protected readonly employeeOptions = signal<SelectOption[]>([]);

  protected readonly loanTypeOptions: SelectOption[] = [
    { v: 'Personal Loan', l: 'Personal Loan' },
    { v: 'Salary Advance', l: 'Salary Advance' },
    { v: 'Emergency Advance', l: 'Emergency Advance' },
  ];

  protected readonly status = signal('');

  protected readonly loans = signal<Loan[]>([]);

  protected readonly form = signal({ employee: '', type: 'Personal Loan', amount: '', months: '', reason: '' });

  protected readonly filtered = computed(() => {
    const s = this.status();
    return this.loans().filter((l) => !s || l.s === s);
  });

  ngOnInit(): void {
    this.loadSummary();
    this.loadLoans();
    this.loadEmployees();
  }

  private loadEmployees(): void {
    this.api.employees({ pageSize: 100 }).subscribe({
      next: (res) => {
        const list = (res.items || []).map((e) => ({
          v: e.fullName,
          l: e.fullName,
        }));
        this.employeeOptions.set(list);
        if (list.length > 0 && !this.form().employee) {
          this.patch('employee', list[0].v);
        }
      },
      error: () => {},
    });
  }

  private loadSummary(): void {
    this.api.loanSummary().subscribe({
      next: (summary) =>
        this.kpis.set([
          { l: 'Total Disbursed', v: this.money(summary.totalDisbursed), c: 'var(--p)' },
          { l: 'Outstanding', v: this.money(summary.outstanding), c: 'var(--danger)' },
          { l: 'Active Loans', v: `${summary.activeLoans}`, c: 'var(--warning)' },
          { l: 'Pending Approval', v: `${summary.pendingApproval}`, c: 'var(--p)' },
        ]),
      error: () => {},
    });
  }

  private loadLoans(): void {
    this.api.loans().subscribe({
      next: (rows) =>
        this.loans.set(
          (rows || []).map((loan) => ({
            apiId: loan.id,
            n: loan.employeeName,
            t: loan.loanType,
            amt: loan.amount,
            emi: loan.emi,
            paid: loan.paidAmount,
            bal: loan.balance,
            ten:
              loan.status === 'Closed'
                ? 'Closed'
                : loan.tenureMonths > 0
                  ? `${loan.tenureMonths} mo`
                  : ' · ',
            s: loan.status as Loan['s'],
          })),
        ),
      error: () => {
        this.loans.set([]);
      },
    });
  }

  private money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }

  protected loanClass(s: Loan['s']): string {
    return `badge-${s === 'Active' ? 'success' : s === 'Pending' ? 'warning' : 'info'}`;
  }

  protected openModal(): void {
    const firstEmp = this.employeeOptions()[0]?.v || '';
    this.form.set({ employee: firstEmp, type: 'Personal Loan', amount: '', months: '', reason: '' });
    this.ui.open('loanModal');
  }

  protected patch(key: 'employee' | 'type' | 'amount' | 'months' | 'reason', value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected approve(loan: Loan, ok: boolean): void {
    if (!loan.apiId) {
      this.loans.update((list) => (ok ? list.map((l) => (l === loan ? { ...l, s: 'Active' as const } : l)) : list.filter((l) => l !== loan)));
      this.toast.show(ok ? 'Approved!' : 'Rejected', ok ? 'success' : 'danger');
      return;
    }

    const request = ok ? this.api.approveLoan(loan.apiId) : this.api.rejectLoan(loan.apiId);
    request.subscribe({
      next: () => {
        this.toast.show(ok ? 'Approved!' : 'Rejected', ok ? 'success' : 'danger');
        this.loadSummary();
        this.loadLoans();
      },
      error: (error) => this.toast.show(error?.error?.title ?? 'Could not update the loan.', 'danger'),
    });
  }

  protected submit(): void {
    const f = this.form();
    const loanType =
      f.type === 'Salary Advance' ? 'SalaryAdvance' : f.type === 'Emergency Advance' ? 'EmergencyAdvance' : 'PersonalLoan';

    this.api
      .createLoan({
        employeeId: null,
        loanType,
        amount: Number(String(f.amount).replace(/[^0-9.]/g, '')) || 0,
        tenureMonths: Number(f.months) || 1,
        reason: f.reason,
      })
      .subscribe({
        next: () => {
          this.ui.close('loanModal');
          this.toast.show('Loan request submitted!');
          this.loadSummary();
          this.loadLoans();
        },
        error: (error) => this.toast.show(error?.error?.title ?? 'Could not submit the loan request.', 'danger'),
      });
  }
}
