import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SessionService } from '../../core/services/session.service';
import { AnalyticsAdminComponent } from './analytics-admin.component';
import { AnalyticsHrComponent } from './analytics-hr.component';

/** Routes `/analytics` to the role-appropriate dashboard (admin vs HR). */
@Component({
  selector: 'app-analytics',
  imports: [CommonModule, AnalyticsAdminComponent, AnalyticsHrComponent],
  template: `
    @if (isHr()) {
      <app-analytics-hr />
    } @else {
      <app-analytics-admin />
    }
  `,
})
export class AnalyticsComponent {
  private readonly session = inject(SessionService);
  protected readonly isHr = computed(() => this.session.activeRole() === 'HR Manager');
}
