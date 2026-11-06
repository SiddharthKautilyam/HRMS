import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks a trusted HTML string as safe. Needed because Angular's built-in
 * sanitizer strips `<svg>` from `[innerHTML]` bindings — which silently removed
 * every icon/illustration supplied as a string.
 *
 * Only use this with strings defined in source, never with user input.
 */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}
