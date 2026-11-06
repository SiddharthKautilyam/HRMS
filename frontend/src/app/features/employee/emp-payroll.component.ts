import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EmployeeDetail, Payslip as ApiPayslip } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

/** My Payroll — ported from pages/emp-payroll.html. */
@Component({
  selector: 'app-emp-payroll',
  imports: [CommonModule, RouterLink, IconDirective],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">My Payroll</div>
        <div class="page-subtitle">Salary slips and breakdown</div>
      </div>
      <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px" (click)="toast.show('Downloading...')">
        <span [appIcon]="'download'"></span> Download Latest
      </button>
    </div>

    <div class="grid-3" style="margin-bottom: 24px">
      @for (k of kpis(); track k.l) {
        <div class="kpi-card">
          <div class="kpi-icon" [style.background]="k.bg" [style.color]="k.c"><span [appIcon]="'payroll'"></span></div>
          <div class="kpi-value" [style.color]="k.c">{{ k.v }}</div>
          <div class="kpi-label">{{ k.l }}</div>
          <div style="font-size: 0.86rem; color: var(--muted); margin-top: 4px">{{ periodLabel() }}</div>
        </div>
      }
    </div>

    <div class="grid-2" style="margin-bottom: 24px">
      <div class="card">
        <div class="card-header"><div class="card-title">Salary Breakdown</div></div>
        <div class="card-body">
          <div class="hero-banner" style="margin-bottom: 14px; padding: 14px 16px">
            <div>
              <div style="font-size: 0.65rem; color: var(--muted); font-weight: 600; text-transform: uppercase">Net Pay</div>
              <div style="font-size: 0.86rem; font-weight: 900; color: var(--text)">{{ money(netPay()) }}</div>
            </div>
            <div style="text-align: right">
              <div style="font-size: 0.86rem; color: var(--muted)">{{ periodLabel() }}</div>
              <div style="font-size: 0.82rem; color: var(--p); font-weight: 600; margin-top: 2px">Credited {{ payDate() }}</div>
            </div>
          </div>
          @for (line of breakdown(); track line[0]) {
            <div style="display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border)">
              <span style="font-size: 0.85rem; color: var(--muted)">{{ line[0] }}</span>
              <span style="font-size: 0.875rem; font-weight: 600" [style.color]="line[2] || 'var(--text)'">{{ line[1] }}</span>
            </div>
          }
          @if (breakdown().length === 0) {
            <div style="padding: 12px 0; font-size: 0.86rem; color: var(--muted)">No payslips available yet.</div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="margin-bottom: 12px">
          <div class="card-title">Payslip History</div>
          <button class="btn btn-outline btn-sm" routerLink="/me/payslips">View All</button>
        </div>
        <div class="card-body" style="padding-top: 0">
          @for (p of history(); track p.m) {
            <div style="display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border)">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--p-soft); display: flex; align-items: center; justify-content: center; color: var(--p)">
                <span [appIcon]="'payslip'"></span>
              </div>
              <div style="flex: 1">
                <div style="font-size: 0.875rem; font-weight: 600">{{ p.m }}</div>
                <div style="font-size: 0.82rem; color: var(--muted)">Net: {{ p.net }}</div>
              </div>
              <span class="badge badge-success" style="font-size: 0.86rem">{{ p.s }}</span>
              <button class="btn btn-ghost btn-sm" data-tooltip="Download" (click)="toast.show('Downloading ' + p.m + ' payslip...')">
                <span [appIcon]="'download'"></span>
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class EmpPayrollComponent implements OnInit {
  protected readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  protected readonly employee = signal<EmployeeDetail | null>(null);
  private readonly payslips = signal<ApiPayslip[]>([]);

  protected readonly periodLabel = computed(() => {
    const payslip = this.payslips()[0];
    return payslip ? `${this.monthName(payslip.month)} ${payslip.year}` : '—';
  });

  protected readonly netPay = computed(() => this.payslips()[0]?.netPay ?? 0);

  protected readonly payDate = computed(() => this.payslips()[0]?.payDate ?? '—');

  protected readonly kpis = computed(() => {
    const payslip = this.payslips()[0];
    if (!payslip) return [];

    return [
      { l: 'Gross Salary', v: this.money(payslip.basicSalary + payslip.allowances), c: 'var(--p)', bg: 'var(--p-soft)' },
      { l: 'Deductions', v: `-${this.money(payslip.deductions)}`, c: '#EF4444', bg: 'rgba(239,68,68,.1)' },
      { l: 'Net Salary', v: this.money(payslip.netPay), c: '#10B981', bg: 'rgba(16,185,129,.1)' },
    ];
  });

  protected readonly breakdown = computed<[string, string, string?][]>(() => {
    const payslip = this.payslips()[0];
    const employee = this.employee();
    if (!payslip) return [];

    if (!employee) {
      return [
        ['Basic Salary', this.money(payslip.basicSalary)],
        ['Allowances', this.money(payslip.allowances)],
        ['Deductions', `-${this.money(payslip.deductions)}`, 'var(--danger)'],
      ];
    }

    return [
      ['Basic Salary', this.money(employee.basicSalary)],
      ['Housing Allowance', this.money(employee.housingAllowance)],
      ['Transport Allowance', this.money(employee.transportAllowance)],
      ['Mobile Allowance', this.money(employee.mobileAllowance)],
      ['Other Allowances', this.money(employee.otherAllowances)],
      ['Deductions', `-${this.money(payslip.deductions)}`, 'var(--danger)'],
    ];
  });

  protected readonly history = computed(() =>
    this.payslips()
      .slice(0, 6)
      .map((p) => ({ m: `${this.monthName(p.month)} ${p.year}`, net: this.money(p.netPay), s: p.status })),
  );

  ngOnInit(): void {
    this.api.myPayslips().subscribe({
      next: (payslips) => this.payslips.set(payslips),
      error: () => this.toast.show('Could not load your payroll data.', 'danger'),
    });

    this.api.employeeMe().subscribe({
      next: (employee) => this.employee.set(employee),
      error: () => {
        /* API offline — the salary breakdown falls back to the payslip totals. */
      },
    });
  }

  protected money(value: number): string {
    return `$${value.toLocaleString()}`;
  }

  private monthName(month: number): string {
    return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }
}
