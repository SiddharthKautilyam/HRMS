import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import {
  CompanyDetail,
  CompanyListItem,
  CompanyProvisioningResult,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { ToastService } from '../../core/services/toast.service';

function emptyForm(): CreateCompanyRequest {
  return {
    name: '',
    code: '',
    adminFullName: '',
    adminEmail: '',
    contactName: '',
    contactEmail: '',
    timeZone: '',
  };
}

/**
 * Super Admin company management. Creates companies (each provisioning its own
 * dedicated database) and tracks provisioning + invitation status. Shows company
 * metadata only — never a company's business data.
 */
@Component({
  selector: 'app-companies',
  imports: [CommonModule, FormsModule, IconDirective],
  templateUrl: './companies.component.html',
})
export class CompaniesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly companies = signal<CompanyListItem[]>([]);
  protected readonly loading = signal(false);
  protected search = '';

  protected readonly showCreate = signal(false);
  protected readonly showEdit = signal(false);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly editingCompany = signal<CompanyListItem | null>(null);
  protected readonly companyToDelete = signal<CompanyListItem | null>(null);
  protected readonly saving = signal(false);
  protected form: CreateCompanyRequest = emptyForm();
  protected editForm: UpdateCompanyRequest = {
    name: '',
    adminFullName: '',
    contactName: '',
    contactEmail: '',
    timeZone: '',
  };

  protected readonly detail = signal<CompanyDetail | null>(null);
  protected readonly showDetail = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly activationUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.tenantCompanies(this.search).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Could not load companies.', 'danger');
      },
    });
  }

  protected openCreate(): void {
    this.form = emptyForm();
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected save(): void {
    if (!this.form.name?.trim() || !this.form.adminFullName?.trim() || !this.form.adminEmail?.trim()) {
      this.toast.show('Company name, administrator name and email are required.', 'warning');
      return;
    }

    this.saving.set(true);
    this.api.createTenantCompany(this.form).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.handleResult(result);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.show(error?.error?.title ?? 'Could not create the company.', 'danger');
      },
    });
  }

  protected edit(company: CompanyListItem): void {
    this.editingCompany.set(company);
    this.editForm = {
      name: company.name,
      adminFullName: company.adminFullName,
      contactName: '',
      contactEmail: '',
      timeZone: '',
    };
    this.showEdit.set(true);

    this.api.tenantCompany(company.id).subscribe({
      next: (d) => {
        this.editForm = {
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

  protected closeEdit(): void {
    this.showEdit.set(false);
    this.editingCompany.set(null);
  }

  protected saveEdit(): void {
    const c = this.editingCompany();
    if (!c) return;
    if (!this.editForm.name?.trim() || !this.editForm.adminFullName?.trim()) {
      this.toast.show('Company name and administrator name are required.', 'warning');
      return;
    }

    this.saving.set(true);
    this.api.updateTenantCompany(c.id, this.editForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEdit.set(false);
        this.editingCompany.set(null);
        this.toast.show('Company details updated successfully.', 'success');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.show(error?.error?.title ?? 'Could not update the company.', 'danger');
      },
    });
  }

  protected confirmDelete(company: CompanyListItem): void {
    if (company.isDefault) {
      this.toast.show('The default company cannot be deleted.', 'warning');
      return;
    }
    this.companyToDelete.set(company);
    this.showDeleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.companyToDelete.set(null);
    this.showDeleteConfirm.set(false);
  }

  protected deleteCompany(): void {
    const c = this.companyToDelete();
    if (!c) return;

    this.saving.set(true);
    this.api.deleteTenantCompany(c.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.showDeleteConfirm.set(false);
        this.companyToDelete.set(null);
        this.toast.show(`Company "${c.name}" and its dedicated database deleted successfully.`, 'success');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.show(error?.error?.title ?? 'Could not delete the company.', 'danger');
      },
    });
  }

  protected view(company: CompanyListItem): void {
    this.busyId.set(company.id);
    this.api.tenantCompany(company.id).subscribe({
      next: (detail) => {
        this.busyId.set(null);
        this.detail.set(detail);
        this.showDetail.set(true);
      },
      error: () => {
        this.busyId.set(null);
        this.toast.show('Could not load company details.', 'danger');
      },
    });
  }

  protected retry(company: CompanyListItem): void {
    this.busyId.set(company.id);
    this.api.retryProvisioning(company.id).subscribe({
      next: (result) => {
        this.busyId.set(null);
        this.handleResult(result);
        this.load();
      },
      error: (error) => {
        this.busyId.set(null);
        this.toast.show(error?.error?.title ?? 'Retry failed.', 'danger');
      },
    });
  }

  protected resend(company: CompanyListItem): void {
    this.busyId.set(company.id);
    this.api.resendInvitation(company.id).subscribe({
      next: (result) => {
        this.busyId.set(null);
        this.load();
        if (result.activationUrl) {
          this.activationUrl.set(result.activationUrl);
          this.toast.show('Invitation reissued — copy the activation link below.', 'success');
        } else {
          this.toast.show(result.error ? `Email failed: ${result.error}` : 'Invitation sent.', 'warning');
        }
      },
      error: (error) => {
        this.busyId.set(null);
        this.toast.show(error?.error?.title ?? 'Could not resend the invitation.', 'danger');
      },
    });
  }

  protected toggleStatus(company: CompanyListItem): void {
    if (company.isDefault) {
      this.toast.show('The default company cannot be suspended.', 'warning');
      return;
    }

    const reactivating = company.status === 'Suspended';
    this.busyId.set(company.id);
    const request = reactivating
      ? this.api.activateTenantCompany(company.id)
      : this.api.suspendTenantCompany(company.id);

    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show(reactivating ? 'Company activated.' : 'Company suspended.', 'success');
        this.load();
      },
      error: (error) => {
        this.busyId.set(null);
        this.toast.show(error?.error?.title ?? 'Action failed.', 'danger');
      },
    });
  }

  protected copyLink(): void {
    const url = this.activationUrl();
    if (!url) return;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => this.toast.show('Activation link copied.', 'success'))
      .catch(() => this.toast.show('Copy failed — select the link manually.', 'warning'));
  }

  protected dismissLink(): void {
    this.activationUrl.set(null);
  }

  protected closeDetail(): void {
    this.showDetail.set(false);
    this.detail.set(null);
  }

  protected statusBadge(status: string): string {
    switch (status) {
      case 'Active':
        return 'badge-success';
      case 'Provisioning':
        return 'badge-warning';
      case 'Suspended':
        return 'badge-info';
      default:
        return 'badge-danger';
    }
  }

  protected inviteBadge(status: string): string {
    switch (status) {
      case 'Sent':
      case 'Accepted':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'Failed':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }

  private handleResult(result: CompanyProvisioningResult): void {
    if (result.activationUrl) {
      this.activationUrl.set(result.activationUrl);
    }

    if (result.status === 'Failed' || result.error) {
      this.toast.show(`Provisioning failed: ${result.error ?? 'unknown error'}`, 'danger');
    } else {
      this.toast.show(`"${result.databaseName}" provisioned and ready.`, 'success');
    }
  }
}
