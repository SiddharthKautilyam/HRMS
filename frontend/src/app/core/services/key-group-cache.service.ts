import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { KeyStoreItem } from '../api/api.models';

@Injectable({
  providedIn: 'root',
})
export class KeyGroupCacheService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, Observable<KeyStoreItem[]>>();

  /**
   * Retrieves active KeyStores for a given groupCode, cached with shareReplay(1)
   * to eliminate duplicate HTTP requests across multiple dropdowns on a single page.
   */
  getOptions(groupCode: string): Observable<KeyStoreItem[]> {
    const key = groupCode.trim().toUpperCase();
    const existing = this.cache.get(key);
    if (existing) {
      return existing;
    }

    const obs = this.api.keyStoresByGroup(key).pipe(
      map((items) => items || []),
      shareReplay(1)
    );

    this.cache.set(key, obs);
    return obs;
  }

  /**
   * Clears the cache for a specific groupCode or all groups when an administrator
   * updates or saves KeyGroups in Settings.
   */
  clearCache(groupCode?: string): void {
    if (groupCode) {
      this.cache.delete(groupCode.trim().toUpperCase());
    } else {
      this.cache.clear();
    }
  }
}
