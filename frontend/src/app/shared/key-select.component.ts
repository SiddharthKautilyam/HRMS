import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ApiService } from '../core/api/api.service';
import { KeyStoreItem } from '../core/api/api.models';
import { IconDirective } from '../core/icons/icon.directive';
import { KeyGroupCacheService } from '../core/services/key-group-cache.service';

export interface KeyOptionItem {
  key: string;
  value: string;
  subValue?: string | null;
  isActive: boolean;
  isLegacy?: boolean;
}

@Component({
  selector: 'app-key-select, app-key-group-select',
  imports: [CommonModule, IconDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => KeyGroupSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="csel-wrap key-select-wrap" [style.width]="width" (click)="$event.stopPropagation()">
      <button
        type="button"
        class="csel-btn key-select-btn"
        [class.open]="open()"
        [class.disabled]="disabledState()"
        [disabled]="disabledState()"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
      >
        <span class="csel-label" [class.muted-label]="!selectedOption()">
          @if (loading()) {
            <span style="display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px;">
              <span class="spinner-sm"></span> Loading...
            </span>
          } @else if (selectedOption()) {
            {{ selectedOption()!.value }}
            @if (selectedOption()!.isLegacy) {
              <span class="badge" style="font-size: 10px; margin-left: 6px; background: rgba(239,68,68,0.12); color: #dc2626;">Inactive</span>
            }
          } @else {
            {{ placeholder }}
          }
        </span>
        <span class="csel-arrow" [class.up]="open()" appIcon="chevron"></span>
      </button>

      @if (open()) {
        <div class="csel-menu key-select-menu" [class.drop-up]="dropUp()" style="display: block; max-height: 240px; overflow-y: auto; z-index: 1000;">
          @if (allowClear && innerValue()) {
            <div class="csel-opt text-muted" (click)="pickClear()" style="font-size: 12px; border-bottom: 1px solid var(--border);">
              <em>Clear selection</em>
            </div>
          }

          @if (loading()) {
            <div class="csel-opt" style="color: var(--muted); cursor: default; text-align: center; padding: 12px;">
              Loading options...
            </div>
          } @else if (displayOptions().length === 0) {
            <div class="csel-opt" style="color: var(--muted); cursor: default; text-align: center; padding: 12px;">
              No options available
            </div>
          } @else {
            @for (opt of displayOptions(); track (opt.key + '_' + opt.value + '_' + $index)) {
              <div
                class="csel-opt"
                [class.csel-active]="opt.value === innerValue() || opt.key === innerValue()"
                (click)="pick(opt)"
                style="display: flex; justify-content: space-between; align-items: center;"
              >
                <span>{{ opt.value }}</span>
                @if (opt.subValue) {
                  <span style="font-size: 11px; color: var(--muted); margin-left: 8px;">{{ opt.subValue }}</span>
                }
                @if (opt.isLegacy) {
                  <span class="badge" style="font-size: 9px; background: rgba(239,68,68,0.12); color: #dc2626; padding: 1px 4px;">Inactive</span>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .key-select-wrap {
        position: relative;
        display: inline-block;
      }
      .key-select-menu.drop-up {
        top: auto !important;
        bottom: calc(100% + 4px) !important;
        box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.18), 0 -8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      }
      .key-select-btn.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .muted-label {
        color: var(--muted);
      }
      .spinner-sm {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-top-color: var(--p);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class KeyGroupSelectComponent implements OnInit, OnChanges, ControlValueAccessor {
  private readonly cache = inject(KeyGroupCacheService);
  private readonly elementRef = inject(ElementRef);

  @Input() groupCode: string = '';
  @Input() placeholder: string = 'Select option...';
  @Input() width: string = '100%';
  @Input() allowClear: boolean = false;
  @Input() set disabled(val: boolean) {
    this.disabledState.set(val);
  }

  /** Direct value input for non-form usage (e.g. [value]="val") */
  @Input() set value(val: string) {
    this.innerValue.set(val || '');
  }

  @Output() valueChange = new EventEmitter<string>();

  protected readonly innerValue = signal<string>('');
  protected readonly disabledState = signal<boolean>(false);
  protected readonly loading = signal<boolean>(false);
  protected readonly open = signal<boolean>(false);
  protected readonly rawOptions = signal<KeyStoreItem[]>([]);

  // ControlValueAccessor hooks
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Builds the displayed option list, including the current value even if inactive/legacy */
  protected readonly displayOptions = computed<KeyOptionItem[]>(() => {
    const raw = this.rawOptions();
    const curr = (this.innerValue() || '').trim();

    const result: KeyOptionItem[] = raw
      .filter((o) => o.isActive)
      .map((o) => ({
        key: o.key,
        value: o.value,
        subValue: o.subValue,
        isActive: o.isActive,
      }));

    // If current value is set and not present in active options, find in raw or append as legacy
    if (curr) {
      const matchInActive = result.find(
        (o) => o.value.toLowerCase() === curr.toLowerCase() || o.key.toLowerCase() === curr.toLowerCase()
      );
      if (!matchInActive) {
        const matchInRaw = raw.find(
          (o) => o.value.toLowerCase() === curr.toLowerCase() || o.key.toLowerCase() === curr.toLowerCase()
        );
        if (matchInRaw) {
          result.unshift({
            key: matchInRaw.key,
            value: matchInRaw.value,
            subValue: matchInRaw.subValue,
            isActive: false,
            isLegacy: true,
          });
        } else {
          result.unshift({
            key: curr,
            value: curr,
            isActive: false,
            isLegacy: true,
          });
        }
      }
    }

    return result;
  });

  protected readonly selectedOption = computed<KeyOptionItem | null>(() => {
    const curr = (this.innerValue() || '').trim();
    if (!curr) return null;
    return (
      this.displayOptions().find(
        (o) => o.value.toLowerCase() === curr.toLowerCase() || o.key.toLowerCase() === curr.toLowerCase()
      ) || {
        key: curr,
        value: curr,
        isActive: true,
      }
    );
  });

  ngOnInit(): void {
    this.loadOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groupCode'] && !changes['groupCode'].firstChange) {
      this.loadOptions();
    }
  }

  private loadOptions(): void {
    const code = this.groupCode?.trim();
    if (!code) return;

    this.loading.set(true);
    this.cache.getOptions(code).subscribe({
      next: (items) => {
        this.rawOptions.set(items || []);
        this.loading.set(false);
      },
      error: () => {
        this.rawOptions.set([]);
        this.loading.set(false);
      },
    });
  }

  protected readonly dropUp = signal(false);

  protected toggle(): void {
    if (this.disabledState()) return;
    if (!this.open()) {
      try {
        const rect = (this.elementRef.nativeElement as HTMLElement).getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldDropUp = spaceBelow < 240 && rect.top > spaceBelow;
        this.dropUp.set(shouldDropUp);
      } catch {
        this.dropUp.set(false);
      }
      this.open.set(true);
      this.onTouched();
    } else {
      this.open.set(false);
    }
  }

  protected pick(opt: KeyOptionItem): void {
    this.innerValue.set(opt.value);
    this.onChange(opt.value);
    this.valueChange.emit(opt.value);
    this.open.set(false);
  }

  protected pickClear(): void {
    this.innerValue.set('');
    this.onChange('');
    this.valueChange.emit('');
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  // ── ControlValueAccessor Implementation ──
  writeValue(val: any): void {
    this.innerValue.set(val != null ? String(val) : '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
  }
}
