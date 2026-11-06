import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IconDirective } from '../core/icons/icon.directive';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IconDirective],
  template: `
    <div class="empty-state">
      @if (icon) {
        <div class="empty-state-icon">
          <span [appIcon]="icon"></span>
        </div>
      }
      <div class="empty-state-title">{{ title }}</div>
      @if (description) {
        <div class="empty-state-desc">{{ description }}</div>
      }
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'No data found';
  @Input() description = '';
}
