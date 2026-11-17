import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
  host: {
    '[class.csel-host-open]': 'open()',
  },
  template: `
    <div class="csel-wrap" [class.csel-open]="open()" [style.width]="width() || null">
      <button type="button" class="csel-btn" [class.open]="open()" (click)="toggle()">
        <span class="csel-label">{{ selectedLabel() }}</span>
        <span class="csel-arrow" [class.up]="open()" appIcon="chevron"></span>
      </button>
      <div class="csel-menu" [class.drop-up]="dropUp()" [class.align-right]="alignRight()" [style.display]="open() ? 'block' : 'none'">
        @for (option of options(); track option.v) {
          <div class="csel-opt" [class.csel-active]="option.v === value()" (click)="pick(option)">
            {{ option.l }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      position: relative;
    }
    :host(.csel-host-open),
    :host(.csel-open) {
      z-index: 1000 !important;
    }
    .csel-wrap.csel-open {
      z-index: 1050 !important;
      position: relative;
    }
    .csel-menu {
      background-color: var(--surface, #ffffff) !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      z-index: 99999 !important;
      max-height: 280px !important;
      overflow-y: auto !important;
    }
    .csel-menu.drop-up {
      top: auto !important;
      bottom: calc(100% + 4px) !important;
      box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.18), 0 -8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    }
    .csel-menu.align-right {
      left: auto !important;
      right: 0 !important;
    }
  `],
})
export class SelectComponent {
  private readonly elementRef = inject(ElementRef);

  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly width = input<string>('');
  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly dropUp = signal(false);
  readonly alignRight = signal(false);

  readonly selectedLabel = computed(() => {
    const current = this.options().find((o) => o.v === this.value());
    return (current ?? this.options()[0])?.l ?? '';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  toggle(): void {
    if (!this.open()) {
      try {
        const rect = (this.elementRef.nativeElement as HTMLElement).getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If space below is less than 240px and there is more space above, open upwards!
        const shouldDropUp = spaceBelow < 240 && rect.top > spaceBelow;
        this.dropUp.set(shouldDropUp);
        const shouldAlignRight = rect.right + 60 > window.innerWidth;
        this.alignRight.set(shouldAlignRight);
      } catch {
        this.dropUp.set(false);
        this.alignRight.set(false);
      }
      this.open.set(true);
    } else {
      this.open.set(false);
    }
  }

  pick(option: SelectOption): void {
    this.valueChange.emit(option.v);
    this.open.set(false);
  }
}
