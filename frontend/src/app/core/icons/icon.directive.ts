import { Directive, ElementRef, inject, input, effect } from '@angular/core';
import { ICONS, IconName } from './icons';

/**
 * Replaces the original `ICONS[name]` string interpolation with an attribute
 * directive so templates can do `<span class="nav-icon" [appIcon]="item.icon"></span>`,
 * matching the original markup structure exactly.
 */
@Directive({
  selector: '[appIcon]',
})
export class IconDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Icon name from the ICONS registry. */
  readonly appIcon = input<IconName | string>();

  constructor() {
    effect(() => {
      const name = this.appIcon();
      this.el.nativeElement.innerHTML = name ? (ICONS[name as IconName] ?? '') : '';
    });
  }
}
