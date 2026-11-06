import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { IconDirective } from '../core/icons/icon.directive';

export interface SelectOption {
  v: string;
  l: string;
}

/**
 * Standalone custom dropdown — the Angular port of `customSelect()`.
 * Usage: `<app-select [options]="opts" [(value)]="val" width="150px" />`
 */
@Component({
  selector: 'app-select',
  imports: [CommonModule, IconDirective],
  template: `
    <div class="csel-wrap" [style.width]="width() || null" (click)="$event.stopPropagation()">
      <button type="button" class="csel-btn" [class.open]="open()" (click)="toggle()">
        <span class="csel-label">{{ selectedLabel() }}</span>
        <span class="csel-arrow" [class.up]="open()" appIcon="chevron"></span>
      </button>
      <div class="csel-menu" [style.display]="open() ? 'block' : 'none'">
        @for (option of options(); track option.v) {
          <div class="csel-opt" [class.csel-active]="option.v === value()" (click)="pick(option)">
            {{ option.l }}
          </div>
        }
      </div>
    </div>
  `,
})
export class SelectComponent {
  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly width = input<string>('');
  readonly valueChange = output<string>();

  readonly open = signal(false);

  readonly selectedLabel = computed(() => {
    const current = this.options().find((o) => o.v === this.value());
    return (current ?? this.options()[0])?.l ?? '';
  });

  toggle(): void {
    this.open.update((v) => !v);
  }

  pick(option: SelectOption): void {
    this.valueChange.emit(option.v);
    this.open.set(false);
  }
}
