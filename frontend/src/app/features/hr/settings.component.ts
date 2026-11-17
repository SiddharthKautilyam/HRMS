import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import {
  NavigationItem,
  RoleItem,
  RoleNavigationPermission,
  KeyGroup,
  KeyStore,
  SaveKeyGroupRequest,
  SaveKeyStoreRequest,
} from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { KeyGroupCacheService } from '../../core/services/key-group-cache.service';
import { UiService } from '../../core/services/ui.service';
import { SessionService } from '../../core/services/session.service';

export interface FlatKeyGroupItem {
  id: string;
  srNo: number;
  name: string;
  code: string;
  isGeneric: boolean;
  itemCount: number;
  raw: KeyGroup;
}

export interface FlatNavigationItem {
  id: string;
  srNo: number;
  title: string;
  code: string;
  route: string;
  icon: string;
  parentId?: string | null;
  parentTitle?: string;
  orderIndex: number;
  badge?: string | null;
  isActive: boolean;
  level: number;
  raw: NavigationItem;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="settings-page">
      <div class="flex justify-between items-center" style="margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <div class="page-title">Settings</div>
          <div class="page-subtitle">Configure Key Groups, Navigation Routes, User Roles &amp; Security Permissions</div>
        </div>
      </div>

      <!-- Settings Top Tabs Navigation -->
      <div class="card p-0" style="margin-bottom: 20px; border-radius: 10px; overflow: hidden;">
        <div style="display: flex; gap: 4px; border-bottom: 1px solid var(--border); background: var(--surface); padding: 4px 12px 0 12px;">
          @for (t of tabs(); track t.id) {
            <button
              class="settings-tab-btn"
              [class.active]="activeTab() === t.id"
              (click)="selectTab(t.id)"
              style="padding: 12px 20px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent; transition: all .15s;"
              [style.border-bottom-color]="activeTab() === t.id ? 'var(--p)' : 'transparent'"
              [style.color]="activeTab() === t.id ? 'var(--p)' : 'var(--muted)'"
            >
              {{ t.label }}
            </button>
          }
        </div>
      </div>

      <!-- TAB 1: KEY GROUP -->
      @if (activeTab() === 'keygroup') {
        @if (isEditingKeyGroup()) {
          <!-- Screenshot 1: Key Group & Key Store Editor -->
          <div class="card p-0" style="border-radius: 8px; border: 1px solid var(--border); overflow: hidden; background: var(--surface);">
            <!-- Top title row with clean close button -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h5 class="mb-0" style="font-weight: 800; font-size: 16px; color: var(--text);">
                  {{ keyGroupEditForm.id ? 'Edit Key Group' : 'Add Key Group' }}
                </h5>
                @if (keyGroupEditForm.code) {
                  <span class="badge" style="background: var(--bg); border: 1px solid var(--border); font-family: monospace; font-size: 11px;">
                    {{ keyGroupEditForm.code }}
                  </span>
                }
              </div>
              <button 
                type="button" 
                class="btn btn-ghost btn-sm"
                (click)="closeKeyGroupEditor()"
                style="color: var(--muted); padding: 4px 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 6px;"
                data-tooltip="Close"
              >
                <span [appIcon]="'x'"></span>
              </button>
            </div>

            <!-- Section 1 Header: Key Group -->
            <div style="background: #e2e8f0; padding: 10px 20px; font-weight: 700; font-size: 13px; color: #334155; border-bottom: 1px solid #cbd5e1;">
              Key Group
            </div>
            <div style="padding: 18px 20px; display: flex; align-items: center; gap: 24px; border-bottom: 1px solid var(--border); background: var(--surface); flex-wrap: wrap;">
              <div style="flex: 1; min-width: 260px; max-width: 340px;">
                <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block; color: var(--muted);">Name</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="keyGroupEditForm.name" 
                  placeholder="Enter name..." 
                  style="width: 100%; font-size: 13px;" 
                />
              </div>
              <div style="flex: 1; min-width: 200px; max-width: 260px;">
                <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block; color: var(--muted);">Code</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="keyGroupEditForm.code" 
                  [disabled]="!!keyGroupEditForm.id"
                  placeholder="e.g. BLOOD_GROUP" 
                  style="width: 100%; font-size: 13px;" 
                />
              </div>
              <div style="flex: 1; min-width: 240px; max-width: 320px;">
                <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block; color: var(--muted);">Description</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="keyGroupEditForm.description" 
                  placeholder="e.g. Employee blood groups dictionary" 
                  style="width: 100%; font-size: 13px;" 
                />
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 18px;">
                <input 
                  type="checkbox" 
                  id="sgIsGen" 
                  [(ngModel)]="keyGroupEditForm.isGeneric" 
                  style="cursor: pointer; width: 16px; height: 16px;" 
                />
                <label for="sgIsGen" style="font-weight: 600; font-size: 13px; cursor: pointer; margin: 0; color: var(--text);">Is Generic</label>
              </div>
            </div>

            @if (isEnumLocked()) {
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 10px 16px; margin: 12px 20px 0; font-size: 12px; color: #b45309; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">🔒</span>
                <span><strong>System Enum Group:</strong> This group is mapped to backend system enumerations. Adding, renaming, or deleting values is locked to prevent database inconsistency. You may reorder options or toggle them active/inactive.</span>
              </div>
            }

            <!-- Section 2 Header: Key Store with dark [+] button on far right -->
            <div style="background: #e2e8f0; padding: 8px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; margin-top: 12px;">
              <span style="font-weight: 700; font-size: 13px; color: #334155;">Key Store</span>
              <button 
                type="button" 
                (click)="addKeyStoreRow()"
                [disabled]="isEnumLocked()"
                [style.opacity]="isEnumLocked() ? '0.4' : '1'"
                [style.cursor]="isEnumLocked() ? 'not-allowed' : 'pointer'"
                style="background: #1e293b; color: white; border-radius: 4px; padding: 4px 10px; display: flex; align-items: center; justify-content: center; border: none;"
                [attr.data-tooltip]="isEnumLocked() ? 'Adding values is locked for system enum groups' : 'Add Key Store Row'"
              >
                <span [appIcon]="'plus'"></span>
              </button>
            </div>

            <!-- Key Store Table / Rows -->
            <div style="padding: 16px 20px; background: var(--surface);">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 60px 44px; gap: 12px; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: var(--muted); align-items: center;">
                <div>Key</div>
                <div>Value</div>
                <div>Sub Value</div>
                <div style="text-align: center;">Active</div>
                <div></div>
              </div>

              @for (row of keyStoreRows(); track $index) {
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 60px 44px; gap: 12px; margin-bottom: 10px; align-items: center;">
                  <input type="text" class="form-control" [(ngModel)]="row.key" [disabled]="isEnumLocked()" placeholder="Key" style="font-size: 13px;" />
                  <input type="text" class="form-control" [(ngModel)]="row.value" [disabled]="isEnumLocked()" placeholder="Value" style="font-size: 13px;" />
                  <input type="text" class="form-control" [(ngModel)]="row.subValue" placeholder="Sub Value" style="font-size: 13px;" />
                  <div style="text-align: center;">
                    <input type="checkbox" [(ngModel)]="row.isActive" style="cursor: pointer; width: 16px; height: 16px;" title="Toggle Active/Inactive" />
                  </div>
                  <button 
                    type="button" 
                    (click)="removeKeyStoreRow($index)"
                    [disabled]="isEnumLocked()"
                    [style.opacity]="isEnumLocked() ? '0.3' : '1'"
                    [style.cursor]="isEnumLocked() ? 'not-allowed' : 'pointer'"
                    style="background: transparent; border: 1px solid #f87171; color: #dc2626; border-radius: 4px; height: 34px; width: 34px; display: flex; align-items: center; justify-content: center;"
                    [attr.data-tooltip]="isEnumLocked() ? 'Deleting is locked for enum groups' : 'Remove Row'"
                  >
                    <span style="font-weight: 800; font-size: 16px; line-height: 1;">—</span>
                  </button>
                </div>
              } @empty {
                <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">
                  No key store rows added yet. Click [+] to add values.
                </div>
              }
            </div>

            <!-- Bottom Actions matching Screenshot 1 -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--surface);">
              <button 
                type="button" 
                class="btn btn-sm" 
                (click)="resetKeyGroupEditor()"
                style="border: 1px solid #f59e0b; color: #d97706; background: transparent; font-weight: 600; padding: 6px 14px; display: flex; align-items: center; gap: 6px; border-radius: 4px;"
              >
                <span [appIcon]="'refresh'"></span> Reset
              </button>
              <button 
                type="button" 
                class="btn btn-sm" 
                (click)="closeKeyGroupEditor()"
                style="border: 1px solid #ef4444; color: #dc2626; background: transparent; font-weight: 600; padding: 6px 14px; display: flex; align-items: center; gap: 6px; border-radius: 4px;"
              >
                <span [appIcon]="'x'"></span> Cancel
              </button>
              <button 
                type="button" 
                class="btn btn-sm" 
                (click)="saveKeyGroupEditor()"
                [disabled]="savingKeyGroup()"
                style="border: 1px solid #10b981; color: #059669; background: transparent; font-weight: 600; padding: 6px 14px; display: flex; align-items: center; gap: 6px; border-radius: 4px;"
              >
                <span [appIcon]="'check'"></span> {{ savingKeyGroup() ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        } @else {
          <!-- Key Groups List View -->
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h5 class="mb-0" style="font-weight: 700; font-size: 15px;">Key Group Management</h5>
                <div style="font-size: 12px; color: var(--muted);">Tenant dictionary options and drop-down value configurations</div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-outline btn-sm" [class.btn-primary]="showFilterRow()" (click)="toggleFilter()" data-tooltip="Filter">
                  <span [appIcon]="'filter'"></span>
                </button>
                <button class="btn btn-primary btn-sm" (click)="openAddKeyGroup()">
                  <span [appIcon]="'plus'"></span> Add Key Group
                </button>
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width: 70px;">SR No</th>
                    <th>Name</th>
                    <th>Code</th>
                    <th style="width: 110px; text-align: center;">Values</th>
                    <th style="width: 120px; text-align: center;">Is Generic</th>
                    <th style="width: 120px; text-align: right;">Action</th>
                  </tr>
                  @if (showFilterRow()) {
                    <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                      <th style="padding: 6px 12px;"></th>
                      <th style="padding: 6px 12px;">
                        <input 
                          type="text" 
                          class="form-control" 
                          placeholder="Search Name..." 
                          [ngModel]="keyGroupSearch()" 
                          (ngModelChange)="keyGroupSearch.set($event)"
                          style="width: 100%; font-size: 12px; padding: 4px 8px;"
                        />
                      </th>
                      <th style="padding: 6px 12px;" colspan="3"></th>
                      <th style="padding: 6px 12px; text-align: right;">
                        <button class="btn btn-ghost btn-sm" (click)="keyGroupSearch.set('')" data-tooltip="Clear">
                          <span [appIcon]="'x'"></span>
                        </button>
                      </th>
                    </tr>
                  }
                </thead>
                <tbody>
                  @for (kg of filteredKeyGroups(); track kg.id) {
                    <tr>
                      <td style="font-weight: 600; color: var(--muted);">{{ kg.srNo }}</td>
                      <td style="font-weight: 700;">{{ kg.name }}</td>
                      <td>
                        <span class="badge" style="background: var(--bg); border: 1px solid var(--border); font-family: monospace; font-size: 11px;">
                          {{ kg.code }}
                        </span>
                      </td>
                      <td style="text-align: center;">
                        <span class="badge" style="background: rgba(37,99,235,0.1); color: #2563eb; font-weight: 700;">
                          {{ kg.itemCount }} options
                        </span>
                      </td>
                      <td style="text-align: center;">
                        <label class="switch-toggle" style="display: inline-block; position: relative; width: 36px; height: 20px; cursor: pointer;">
                          <input 
                            type="checkbox" 
                            [checked]="kg.isGeneric" 
                            (change)="toggleGeneric(kg)"
                            style="opacity: 0; width: 0; height: 0;"
                          />
                          <span 
                            class="slider"
                            [style.background]="kg.isGeneric ? '#059669' : '#d1d5db'"
                            style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; border-radius: 20px; transition: .3s;"
                          >
                            <span 
                              [style.transform]="kg.isGeneric ? 'translateX(16px)' : 'translateX(2px)'"
                              style="position: absolute; height: 16px; width: 16px; left: 1px; bottom: 2px; background-color: white; border-radius: 50%; transition: .3s;"
                            ></span>
                          </span>
                        </label>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 6px;">
                          <button class="tbl-btn" (click)="editKeyGroup(kg.raw)" data-tooltip="Edit">
                            <span [appIcon]="'edit'"></span>
                          </button>
                          @if (!kg.isGeneric && !kg.raw.isEnumLocked) {
                            <button class="tbl-btn danger" (click)="deleteKeyGroup(kg.raw)" data-tooltip="Delete">
                              <span [appIcon]="'trash'"></span>
                            </button>
                          } @else {
                            <span style="font-size: 11px; color: var(--muted); padding: 4px 6px;" [title]="kg.raw.isEnumLocked ? 'Enum-backed system group cannot be deleted' : 'System generic group cannot be deleted'">
                              <span [appIcon]="'lock'"></span>
                            </span>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 24px; color: var(--muted);">
                        No key groups match your search.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <!-- TAB 2: NAVIGATION (HIERARCHY TREE) -->
      @if (activeTab() === 'navigation') {
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h5 class="mb-0" style="font-weight: 700; font-size: 15px;">Navigation Management</h5>
              <div style="font-size: 12px; color: var(--muted);">Configure hierarchical menu structure (Level 1, 2, 3)</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" [class.btn-primary]="showFilterRow()" (click)="toggleFilter()" data-tooltip="Filter">
                <span [appIcon]="'filter'"></span>
              </button>
              <button class="btn btn-primary btn-sm" (click)="openAddNav()">
                <span [appIcon]="'plus'"></span> Add Navigation
              </button>
            </div>
          </div>

          <div class="table-wrap" style="overflow-x: auto;">
            <table style="min-width: 950px;">
              <thead>
                <tr>
                  <th style="width: 60px;">SR No</th>
                  <th style="width: 60px;">Icon</th>
                  <th>Navigation Name</th>
                  <th>Code</th>
                  <th>Route / Path</th>
                  <th>Parent Module</th>
                  <th style="width: 80px; text-align: center;">Order</th>
                  <th style="width: 90px; text-align: center;">Status</th>
                  <th style="width: 110px; text-align: right;">Action</th>
                </tr>
                @if (showFilterRow()) {
                  <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                    <th style="padding: 6px 12px;"></th>
                    <th style="padding: 6px 12px;"></th>
                    <th style="padding: 6px 12px;">
                      <input 
                        type="text" 
                        class="form-control" 
                        placeholder="Search Title..." 
                        [ngModel]="navSearch()" 
                        (ngModelChange)="navSearch.set($event)"
                        style="width: 100%; font-size: 12px; padding: 4px 8px;"
                      />
                    </th>
                    <th style="padding: 6px 12px;" colspan="5"></th>
                    <th style="padding: 6px 12px; text-align: right;">
                      <button class="btn btn-ghost btn-sm" (click)="navSearch.set('')" data-tooltip="Clear">
                        <span [appIcon]="'x'"></span>
                      </button>
                    </th>
                  </tr>
                }
              </thead>
              <tbody>
                @for (item of filteredNavigations(); track item.id) {
                  <tr>
                    <td style="font-weight: 600; color: var(--muted);">{{ item.srNo }}</td>
                    <td>
                      <div style="width: 30px; height: 30px; border-radius: 6px; background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--p);">
                        <span [appIcon]="item.icon"></span>
                      </div>
                    </td>
                    <td style="font-weight: 700;">
                      <span [style.padding-left.px]="item.level * 20" style="display: inline-flex; align-items: center; gap: 6px;">
                        @if (item.level > 0) {
                          <span style="color: var(--muted); font-size: 11px;">↳</span>
                        }
                        {{ item.title }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700;">{{ item.code }}</span>
                    </td>
                    <td style="font-size: 12px; font-family: monospace;">{{ item.route }}</td>
                    <td style="font-size: 13px; color: var(--muted);">{{ item.parentTitle || 'Root (Top-level)' }}</td>
                    <td style="text-align: center; font-weight: 700;">
                      <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                        <button 
                          type="button"
                          class="tbl-btn" 
                          (click)="moveNav(item, -1)" 
                          [disabled]="isFirstSibling(item)" 
                          data-tooltip="Move Up" 
                          style="padding: 2px 5px; font-size: 10px; width: 22px; height: 22px; line-height: 1;"
                        >
                          ▲
                        </button>
                        <span style="min-width: 18px; text-align: center;">{{ item.orderIndex }}</span>
                        <button 
                          type="button"
                          class="tbl-btn" 
                          (click)="moveNav(item, 1)" 
                          [disabled]="isLastSibling(item)" 
                          data-tooltip="Move Down" 
                          style="padding: 2px 5px; font-size: 10px; width: 22px; height: 22px; line-height: 1;"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <span class="badge" [style.background]="item.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'" [style.color]="item.isActive ? '#059669' : '#dc2626'">
                        {{ item.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button class="tbl-btn" (click)="editNav(item)" data-tooltip="Edit">
                          <span [appIcon]="'edit'"></span>
                        </button>
                        <button 
                          class="tbl-btn danger" 
                          (click)="deleteNav(item.id, item.code)" 
                          [disabled]="item.code === 'SETT' || item.route === '/settings'"
                          [attr.data-tooltip]="item.code === 'SETT' ? 'Settings is protected and cannot be deleted' : 'Delete'"
                        >
                          <span [appIcon]="'trash'"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 24px; color: var(--muted);">
                      No navigation routes found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- TAB 3: PERMISSION (DYNAMIC MATRIX) -->
      @if (activeTab() === 'permission') {
        <div style="display: grid; grid-template-columns: 240px 1fr; gap: 16px;" class="permission-grid-layout">
          <!-- Left Panel: Roles Selector -->
          <div class="card p-0" style="overflow: hidden; height: fit-content;">
            <div style="padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--bg); font-weight: 700; font-size: 13px;">
              Roles
            </div>

            <div style="padding: 8px;">
              @for (role of permissionRoles(); track role.id) {
                <div 
                  (click)="selectRoleForPermissions(role)"
                  style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background .15s; margin-bottom: 4px;"
                  [style.background]="selectedRole()?.id === role.id ? 'var(--p-soft)' : 'transparent'"
                  [style.color]="selectedRole()?.id === role.id ? 'var(--p)' : 'var(--text)'"
                >
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar-placeholder avatar-sm" style="background: var(--surface); border: 1px solid var(--border); color: var(--p); font-weight: 700;">
                      {{ role.code.charAt(0) }}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 13px;">{{ role.name }}</div>
                      <div style="font-size: 11px; color: var(--muted);">{{ role.userCount }} users</div>
                    </div>
                  </div>
                  @if (role.isSystem) {
                    <span class="badge" style="font-size: 10px; background: rgba(59,130,246,0.12); color: #2563eb;">Sys</span>
                  }
                </div>
              } @empty {
                <div style="padding: 16px; font-size: 12px; color: var(--muted); text-align: center;">
                  No configurable roles found. System Admin roles have full access by default.
                </div>
              }
            </div>
          </div>

          <!-- Right Panel: Permissions Matrix Table -->
          <div class="card p-0">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 16px;">
              <div style="font-weight: 700; font-size: 14px; color: var(--text);">
                Permissions for Role: 
                <span style="color: var(--p);">{{ selectedRole()?.name }}</span>
                @if (isProtectedAdminRole()) {
                  <span class="badge" style="margin-left: 8px; background: rgba(16,185,129,0.15); color: #059669; font-size: 11px;">
                    Lockout Protected
                  </span>
                }
              </div>
              <button class="btn btn-primary btn-sm" (click)="saveRolePermissions()" [disabled]="savingPermissions()" style="display: flex; align-items: center; gap: 6px;">
                <span [appIcon]="'save'"></span> {{ savingPermissions() ? 'Saving...' : 'Save Permissions' }}
              </button>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Module / Navigation Title</th>
                    <th>Route</th>
                    <th style="width: 80px; text-align: center;">Full</th>
                    <th style="width: 80px; text-align: center;">View</th>
                    <th style="width: 80px; text-align: center;">Create</th>
                    <th style="width: 80px; text-align: center;">Edit</th>
                    <th style="width: 80px; text-align: center;">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  @for (perm of rolePermissions(); track perm.navigationItemId) {
                    <tr>
                      <td style="font-weight: 700; font-size: 13px;">
                        <span>{{ perm.navigationTitle }}</span>
                        @if (isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()) {
                          <span style="margin-left: 6px; font-size: 11px; color: var(--muted); font-weight: normal;">(Admin Core - Protected)</span>
                        }
                      </td>
                      <td style="font-size: 12px; font-family: monospace; color: var(--muted);">{{ perm.navigationRoute }}</td>
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="perm.isFull" 
                          (change)="onToggleFull(perm)"
                          [disabled]="isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()"
                        />
                      </td>
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="perm.isView" 
                          (change)="onCheckChild(perm)"
                          [disabled]="isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()"
                        />
                      </td>
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="perm.isCreate" 
                          (change)="onCheckChild(perm)"
                          [disabled]="isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()"
                        />
                      </td>
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="perm.isEdit" 
                          (change)="onCheckChild(perm)"
                          [disabled]="isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()"
                        />
                      </td>
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="perm.isDelete" 
                          (change)="onCheckChild(perm)"
                          [disabled]="isSettingsModule(perm.navigationTitle, perm.navigationRoute) && isProtectedAdminRole()"
                        />
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" style="text-align: center; padding: 24px; color: var(--muted);">
                        No navigation permissions found for this role.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- TAB 4: ROLE (DYNAMIC CRUD) -->
      @if (activeTab() === 'role') {
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h5 class="mb-0" style="font-weight: 700; font-size: 15px;">Role Management</h5>
              <div style="font-size: 12px; color: var(--muted);">Create and manage dynamic system and custom roles</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" [class.btn-primary]="showFilterRow()" (click)="toggleFilter()" data-tooltip="Filter">
                <span [appIcon]="'filter'"></span>
              </button>
              <button class="btn btn-primary btn-sm" (click)="openAddRole()">
                <span [appIcon]="'plus'"></span> Add Role
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 70px;">SR No</th>
                  <th>Role Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th style="width: 120px; text-align: center;">Assigned Users</th>
                  <th style="width: 110px; text-align: center;">Type</th>
                  <th style="width: 120px; text-align: right;">Action</th>
                </tr>
                @if (showFilterRow()) {
                  <tr style="background: var(--bg); border-bottom: 1px solid var(--border);">
                    <th style="padding: 6px 12px;"></th>
                    <th style="padding: 6px 12px;">
                      <input 
                        type="text" 
                        class="form-control" 
                        placeholder="Search Role..." 
                        [ngModel]="roleSearch()" 
                        (ngModelChange)="roleSearch.set($event)"
                        style="width: 100%; font-size: 12px; padding: 4px 8px;"
                      />
                    </th>
                    <th style="padding: 6px 12px;" colspan="4"></th>
                    <th style="padding: 6px 12px; text-align: right;">
                      <button class="btn btn-ghost btn-sm" (click)="roleSearch.set('')" data-tooltip="Clear">
                        <span [appIcon]="'x'"></span>
                      </button>
                    </th>
                  </tr>
                }
              </thead>
              <tbody>
                @for (role of filteredRoles(); track role.id; let idx = $index) {
                  <tr>
                    <td style="font-weight: 600; color: var(--muted);">{{ idx + 1 }}</td>
                    <td style="font-weight: 700;">{{ role.name }}</td>
                    <td>
                      <span class="badge" style="background: var(--p-soft); color: var(--p); font-weight: 700;">{{ role.code }}</span>
                    </td>
                    <td style="font-size: 13px; color: var(--muted);">{{ role.description || '-' }}</td>
                    <td style="text-align: center; font-weight: 600;">{{ role.userCount }} users</td>
                    <td style="text-align: center;">
                      @if (role.isSystem) {
                        <span class="badge" style="background: rgba(59,130,246,0.12); color: #2563eb; font-weight: 700;">System</span>
                      } @else {
                        <span class="badge" style="background: rgba(16,185,129,0.12); color: #059669; font-weight: 700;">Custom</span>
                      }
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button class="tbl-btn" (click)="editRole(role)" data-tooltip="Edit">
                          <span [appIcon]="'edit'"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--muted);">
                      No roles match your filter.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Modal: Add / Edit Role -->
    @if (showRoleModal()) {
      <div class="modal-overlay open" (click)="showRoleModal.set(false)">
        <div class="modal" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingRoleId() ? 'Edit Role' : 'Add Role' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showRoleModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Role Name *</label>
              <input class="form-control" [(ngModel)]="roleForm.name" placeholder="e.g. Operations Manager, Lead" />
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Role Code *</label>
              <input 
                class="form-control" 
                [(ngModel)]="roleForm.code" 
                [disabled]="isEditingSystemRole()"
                placeholder="e.g. OPERATIONS" 
              />
              @if (isEditingSystemRole()) {
                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">System role codes cannot be modified.</div>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" [(ngModel)]="roleForm.description" rows="3" placeholder="Brief summary of duties and access permissions"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showRoleModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveRole()" [disabled]="savingRole()">
              {{ savingRole() ? 'Saving...' : 'Save Role' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Add / Edit Navigation -->
    @if (showNavModal()) {
      <div class="modal-overlay open" (click)="showNavModal.set(false)">
        <div class="modal" style="max-width: 500px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 1.1rem;">{{ editingNavId() ? 'Edit Navigation' : 'Add Navigation' }}</div>
            <button class="btn btn-ghost btn-sm" (click)="showNavModal.set(false)"><span [appIcon]="'x'"></span></button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Navigation Title *</label>
              <input class="form-control" [(ngModel)]="navForm.title" placeholder="e.g. Shift Management, Key Group" />
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Code *</label>
                <input class="form-control" [(ngModel)]="navForm.code" placeholder="e.g. SHIF, KEYG" />
                @if (isDuplicateNavCode()) {
                  <div style="font-size: 11px; color: #dc2626; margin-top: 4px; font-weight: 600;">
                    ⚠️ Code already in use by another navigation item. Please enter a unique code.
                  </div>
                }
              </div>
              <div class="form-group">
                <label class="form-label">Icon</label>
                <select class="form-control" [(ngModel)]="navForm.icon">
                  <option value="dashboard">Dashboard</option>
                  <option value="company">Company</option>
                  <option value="employees">Employees</option>
                  <option value="user">Profile</option>
                  <option value="clock">Shift</option>
                  <option value="attendance">Attendance</option>
                  <option value="leave">Leave</option>
                  <option value="payroll">Payroll</option>
                  <option value="payslip">Payslip</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="documents">Documents</option>
                  <option value="approvals">Approvals</option>
                  <option value="reports">Reports</option>
                  <option value="settings">Settings</option>
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                  <option value="lock">Lock</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Route / Path *</label>
              <input class="form-control" [(ngModel)]="navForm.route" list="standardRoutesList" placeholder="e.g. /employee-profile, /shift, or /settings#role" />
              <datalist id="standardRoutesList">
                <option value="/dashboard">Dashboard</option>
                <option value="/analytics">Analytics</option>
                <option value="/company">Company</option>
                <option value="/employees">Employees</option>
                <option value="/employee-profile">Profile (Employee Profile)</option>
                <option value="/shift">Shift Management</option>
                <option value="/attendance">Attendance</option>
                <option value="/leave">Leave Management</option>
                <option value="/payroll">Payroll</option>
                <option value="/payslips">Payslips</option>
                <option value="/onboarding">Onboarding</option>
                <option value="/documents">Documents</option>
                <option value="/approvals">Approvals</option>
                <option value="/reports">Reports</option>
                <option value="/settings">Settings</option>
                <option value="/settings#keygroup">Settings - Key Group</option>
                <option value="/settings#navigation">Settings - Navigation</option>
                <option value="/settings#permission">Settings - Permission</option>
                <option value="/settings#role">Settings - Role</option>
              </datalist>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Parent Navigation (Nesting Hierarchy)</label>
              <select class="form-control" [(ngModel)]="navForm.parentId">
                <option [ngValue]="null">Root Level (No Parent)</option>
                @for (p of availableParents(); track p.id) {
                  <option [ngValue]="p.id">{{ p.title }} ({{ p.code }})</option>
                }
              </select>
            </div>
            <div class="grid grid-2" style="gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Sort Order</label>
                <input class="form-control" type="number" [(ngModel)]="navForm.orderIndex" />
              </div>
              <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 24px;">
                <input type="checkbox" [(ngModel)]="navForm.isActive" id="navActiveCheck" />
                <label for="navActiveCheck" style="font-weight: 600; cursor: pointer;">Is Active</label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="showNavModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveNav()" [disabled]="savingNav()">
              {{ savingNav() ? 'Saving...' : 'Save Navigation' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly permService = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);
  private readonly session = inject(SessionService);
  protected readonly currentRole = computed(() => this.session.activeRole());

  protected readonly tabs = computed<{ id: 'keygroup' | 'navigation' | 'permission' | 'role'; label: string }[]>(() => {
    const settingsChildren = this.flatNavigations().filter((n) => {
      const route = (n.route || '').toLowerCase();
      const code = (n.code || '').toUpperCase();
      return (
        code === 'KEYG' ||
        code === 'NAVM' ||
        code === 'PERM' ||
        code === 'ROLE' ||
        route.includes('#keygroup') ||
        route.includes('#navigation') ||
        route.includes('#permission') ||
        route.includes('#role') ||
        route.includes('tab=keygroup') ||
        route.includes('tab=navigation') ||
        route.includes('tab=permission') ||
        route.includes('tab=role')
      );
    }).sort((a, b) => a.orderIndex - b.orderIndex);

    if (settingsChildren.length === 0) {
      return [
        { id: 'keygroup', label: 'Key Group' },
        { id: 'navigation', label: 'Navigation' },
        { id: 'permission', label: 'Permission' },
        { id: 'role', label: 'Role' },
      ];
    }

    const mapCodeOrRouteToTab = (
      n: FlatNavigationItem
    ): { id: 'keygroup' | 'navigation' | 'permission' | 'role'; label: string } | null => {
      const code = (n.code || '').toUpperCase();
      const route = (n.route || '').toLowerCase();
      const title = n.title;
      if (code === 'KEYG' || route.includes('keygroup')) return { id: 'keygroup', label: title || 'Key Group' };
      if (code === 'NAVM' || route.includes('navigation')) return { id: 'navigation', label: title || 'Navigation' };
      if (code === 'PERM' || route.includes('permission')) return { id: 'permission', label: title || 'Permission' };
      if (code === 'ROLE' || route.includes('role')) return { id: 'role', label: title || 'Role' };
      return null;
    };

    const result: { id: 'keygroup' | 'navigation' | 'permission' | 'role'; label: string }[] = [];
    const seen = new Set<string>();

    for (const child of settingsChildren) {
      const tab = mapCodeOrRouteToTab(child);
      if (tab && !seen.has(tab.id)) {
        seen.add(tab.id);
        result.push(tab);
      }
    }

    const allDefaults: { id: 'keygroup' | 'navigation' | 'permission' | 'role'; label: string }[] = [
      { id: 'keygroup', label: 'Key Group' },
      { id: 'navigation', label: 'Navigation' },
      { id: 'permission', label: 'Permission' },
      { id: 'role', label: 'Role' },
    ];
    for (const def of allDefaults) {
      if (!seen.has(def.id)) {
        result.push(def);
      }
    }

    return result;
  });

  protected readonly activeTab = signal<'keygroup' | 'navigation' | 'permission' | 'role'>('keygroup');

  // Key Groups Backend State
  private readonly keyGroupCache = inject(KeyGroupCacheService);
  protected readonly keyGroups = signal<KeyGroup[]>([]);
  protected readonly isEditingKeyGroup = signal<boolean>(false);
  protected readonly savingKeyGroup = signal<boolean>(false);
  protected keyGroupEditForm = { id: '', code: '', name: '', description: '', isGeneric: false };
  protected readonly keyStoreRows = signal<Array<{ id?: string; key: string; value: string; subValue?: string; isActive: boolean }>>([]);
  private originalEditingKg: KeyGroup | null = null;
  protected readonly isEnumLocked = computed(() => {
    const code = (this.keyGroupEditForm.code || '').toUpperCase().trim();
    return !!(this.originalEditingKg?.isEnumLocked || ['GENDER', 'MARITAL_STATUS', 'EMPLOYMENT_TYPE', 'PAYMENT_MODE'].includes(code));
  });

  // Navigations State (from backend tree)
  protected readonly rawNavigations = signal<NavigationItem[]>([]);
  protected readonly flatNavigations = signal<FlatNavigationItem[]>([]);

  // Roles State (from backend)
  protected readonly roles = signal<RoleItem[]>([]);
  protected readonly selectedRole = signal<RoleItem | null>(null);

  // Permission Matrix State
  protected readonly rolePermissions = signal<RoleNavigationPermission[]>([]);
  protected readonly savingPermissions = signal(false);

  // Filters & Search
  protected readonly showFilterRow = signal(false);
  protected readonly keyGroupSearch = signal('');
  protected readonly navSearch = signal('');
  protected readonly roleSearch = signal('');

  protected readonly showRoleModal = signal(false);
  protected readonly editingRoleId = signal<string | null>(null);
  protected readonly isEditingSystemRole = signal(false);
  protected readonly savingRole = signal(false);
  protected roleForm = { name: '', code: '', description: '' };

  protected readonly showNavModal = signal(false);
  protected readonly editingNavId = signal<string | null>(null);
  protected readonly savingNav = signal(false);
  private originalEditingNavCode = '';
  protected navForm = {
    title: '',
    code: '',
    route: '',
    icon: 'dashboard',
    parentId: null as string | null,
    orderIndex: 1,
    isActive: true,
  };

  protected isDuplicateNavCode(): boolean {
    const code = this.navForm.code?.trim().toUpperCase();
    if (!code) return false;
    const editId = this.editingNavId();
    if (editId && code === this.originalEditingNavCode) return false;
    return this.flatNavigations().some((n) => n.id.toLowerCase() !== editId?.toLowerCase() && n.code.toUpperCase() === code);
  }

  protected readonly filteredKeyGroups = computed<FlatKeyGroupItem[]>(() => {
    const list = this.keyGroups();
    const q = this.keyGroupSearch().trim().toLowerCase();
    const filtered = q
      ? list.filter((kg) => kg.name.toLowerCase().includes(q) || kg.code.toLowerCase().includes(q))
      : list;

    return filtered.map((kg, idx) => ({
      id: kg.id,
      srNo: idx + 1,
      name: kg.name,
      code: kg.code,
      isGeneric: kg.isGeneric ?? false,
      itemCount: kg.items?.length || 0,
      raw: kg,
    }));
  });

  protected readonly filteredNavigations = computed(() => {
    return this.flatNavigations().filter((nav) =>
      !this.navSearch() || nav.title.toLowerCase().includes(this.navSearch().toLowerCase()) || nav.code.toLowerCase().includes(this.navSearch().toLowerCase())
    );
  });

  protected isSuperOrCompanyAdmin(): boolean {
    const r1 = (this.session.activeRole() || '').toLowerCase().replace(/[^a-z]/g, '');
    const r2 = (this.session.user()?.role || '').toLowerCase().replace(/[^a-z]/g, '');
    const r3 = (this.session.role() || '').toLowerCase().replace(/[^a-z]/g, '');
    return r1 === 'superadmin' || r1 === 'companyadmin' || r2 === 'superadmin' || r2 === 'companyadmin' || r3 === 'superadmin' || r3 === 'companyadmin';
  }

  protected isRestrictedAdminRole(role?: RoleItem | null): boolean {
    if (!role) return false;
    const code = (role.code || '').toLowerCase().replace(/[^a-z]/g, '');
    const name = (role.name || '').toLowerCase().replace(/[^a-z]/g, '');
    return (
      code.includes('companyadmin') ||
      name.includes('companyadmin') ||
      code.includes('superadmin') ||
      name.includes('superadmin')
    );
  }

  protected readonly filteredRoles = computed(() => {
    const isSuperOrCompany = this.isSuperOrCompanyAdmin();
    const list = this.roles().filter((r) => {
      // If caller is HR Manager or non-super/company admin, hide Company Admin & Super Admin completely
      if (!isSuperOrCompany && this.isRestrictedAdminRole(r)) {
        return false;
      }
      return true;
    });

    return list.filter((r) =>
      !this.roleSearch() || r.name.toLowerCase().includes(this.roleSearch().toLowerCase()) || r.code.toLowerCase().includes(this.roleSearch().toLowerCase())
    );
  });

  protected isAdminRole(role?: RoleItem | null): boolean {
    if (!role) return false;
    const name = (role.name || '').toLowerCase();
    const code = (role.code || '').toLowerCase();
    return (
      name.includes('admin') ||
      code.includes('admin') ||
      name.includes('hr manager') ||
      code.includes('hrmanager') ||
      code === 'superadmin' ||
      code === 'companyadmin'
    );
  }

  protected readonly permissionRoles = computed(() => {
    return this.roles().filter((r) => !this.isAdminRole(r));
  });

  protected readonly availableParents = computed(() => {
    const editId = this.editingNavId();
    return this.flatNavigations().filter((n) => n.id !== editId && n.level < 2);
  });

  private normalizeTab(val?: string | null): 'keygroup' | 'navigation' | 'permission' | 'role' | null {
    if (!val) return null;
    const lower = val.toLowerCase().replace(/[^a-z]/g, '');
    if (lower.startsWith('key')) return 'keygroup';
    if (lower.startsWith('nav')) return 'navigation';
    if (lower.startsWith('perm')) return 'permission';
    if (lower.startsWith('role')) return 'role';
    return null;
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadNavigations();
    this.loadKeyGroups();

    this.route.queryParamMap.subscribe((params) => {
      const tab = this.normalizeTab(params.get('tab'));
      if (tab && tab !== this.activeTab()) {
        this.selectTab(tab, false);
      }
    });

    this.route.fragment.subscribe((frag) => {
      const tab = this.normalizeTab(frag);
      if (tab && tab !== this.activeTab()) {
        this.selectTab(tab, false);
      }
    });

    const initTab = this.normalizeTab(this.route.snapshot.queryParamMap.get('tab')) ||
      this.normalizeTab(this.route.snapshot.fragment);
    if (initTab) {
      this.selectTab(initTab, false);
    }
  }

  protected selectTab(tab: 'keygroup' | 'navigation' | 'permission' | 'role', updateUrl = true): void {
    this.activeTab.set(tab);
    // Clear filter row and searches when switching tabs
    this.showFilterRow.set(false);
    this.keyGroupSearch.set('');
    this.navSearch.set('');
    this.roleSearch.set('');
    if (updateUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        fragment: tab,
      });
    }
    if (tab === 'keygroup') {
      this.loadKeyGroups();
    } else if (tab === 'role') {
      this.loadRoles();
    } else if (tab === 'navigation') {
      this.loadNavigations();
    } else if (tab === 'permission') {
      const configurable = this.permissionRoles();
      if ((!this.selectedRole() || this.isAdminRole(this.selectedRole())) && configurable.length > 0) {
        this.selectRoleForPermissions(configurable[0]);
      } else if (this.selectedRole()) {
        this.loadPermissionsForRole(this.selectedRole()!.id);
      }
    }
  }

  protected toggleFilter(): void {
    const next = !this.showFilterRow();
    this.showFilterRow.set(next);
    // Clear all searches when closing the filter row
    if (!next) {
      this.keyGroupSearch.set('');
      this.navSearch.set('');
      this.roleSearch.set('');
    }
  }

  // ── Roles Backend Integration ──
  protected loadRoles(): void {
    this.api.roles().subscribe({
      next: (list) => {
        this.roles.set(list);
        if (!this.selectedRole() || this.isAdminRole(this.selectedRole())) {
          const configurable = list.filter((r) => !this.isAdminRole(r));
          if (configurable.length > 0) {
            this.selectedRole.set(configurable[0]);
          } else if (list.length > 0) {
            this.selectedRole.set(list[0]);
          }
        }
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to load roles from server', 'danger');
      },
    });
  }

  protected openAddRole(): void {
    this.editingRoleId.set(null);
    this.isEditingSystemRole.set(false);
    this.roleForm = { name: '', code: '', description: '' };
    this.showRoleModal.set(true);
  }

  protected editRole(role: RoleItem): void {
    if (!this.isSuperOrCompanyAdmin() && this.isRestrictedAdminRole(role)) {
      this.toast.show('HR Managers do not have permission to edit Company Admin or Super Admin roles', 'danger');
      return;
    }
    this.editingRoleId.set(role.id);
    this.isEditingSystemRole.set(role.isSystem);
    this.roleForm = {
      name: role.name,
      code: role.code,
      description: role.description || '',
    };
    this.showRoleModal.set(true);
  }

  protected saveRole(): void {
    if (!this.roleForm.name.trim()) {
      this.toast.show('Please enter a role name', 'danger');
      return;
    }
    if (!this.roleForm.code.trim()) {
      this.toast.show('Please enter a role code', 'danger');
      return;
    }

    this.savingRole.set(true);
    const id = this.editingRoleId();

    if (id) {
      this.api.updateRole(id, {
        name: this.roleForm.name.trim(),
        code: this.roleForm.code.trim(),
        description: this.roleForm.description?.trim() || null,
      }).subscribe({
        next: (updated) => {
          this.toast.show(`Role '${updated.name}' updated successfully`, 'success');
          this.savingRole.set(false);
          this.showRoleModal.set(false);
          this.loadRoles();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Failed to update role', 'danger');
          this.savingRole.set(false);
        },
      });
    } else {
      this.api.createRole({
        name: this.roleForm.name.trim(),
        code: this.roleForm.code.trim().toUpperCase(),
        description: this.roleForm.description?.trim() || null,
      }).subscribe({
        next: (created) => {
          this.toast.show(`Role '${created.name}' created successfully`, 'success');
          this.savingRole.set(false);
          this.showRoleModal.set(false);
          this.loadRoles();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Failed to create role', 'danger');
          this.savingRole.set(false);
        },
      });
    }
  }

  protected deleteRole(role: RoleItem): void {
    if (!this.isSuperOrCompanyAdmin() && this.isRestrictedAdminRole(role)) {
      this.toast.show('HR Managers do not have permission to delete Company Admin or Super Admin roles', 'danger');
      return;
    }
    if (role.isSystem) {
      this.toast.show('System roles cannot be deleted', 'danger');
      return;
    }
    if (role.userCount > 0) {
      this.toast.show(`Cannot delete role '${role.name}' because ${role.userCount} user(s) are assigned to it`, 'danger');
      return;
    }
    if (!confirm(`Are you sure you want to delete role '${role.name}'?`)) {
      return;
    }

    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.toast.show(`Role '${role.name}' deleted successfully`, 'success');
        this.loadRoles();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to delete role', 'danger');
      },
    });
  }

  // ── Navigation Tree Backend Integration ──
  protected loadNavigations(): void {
    this.api.navigationTree().subscribe({
      next: (tree) => {
        this.rawNavigations.set(tree);
        const flat: FlatNavigationItem[] = [];
        let sr = 1;

        const flatten = (items: NavigationItem[], level: number, parentTitle?: string) => {
          for (const item of items) {
            flat.push({
              id: item.id,
              srNo: sr++,
              title: item.title,
              code: item.code || '',
              route: item.route,
              icon: item.icon,
              parentId: item.parentId,
              parentTitle: parentTitle,
              orderIndex: item.orderIndex,
              badge: item.badge,
              isActive: item.isActive ?? true,
              level: level,
              raw: item,
            });
            if (item.children && item.children.length > 0) {
              flatten(item.children, level + 1, item.title);
            }
          }
        };

        flatten(tree, 0);
        this.flatNavigations.set(flat);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to load navigation tree', 'danger');
      },
    });
  }

  protected isFirstSibling(item: FlatNavigationItem): boolean {
    const siblings = this.flatNavigations()
      .filter((n) => (n.parentId || null) === (item.parentId || null))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return siblings.length > 0 && siblings[0].id === item.id;
  }

  protected isLastSibling(item: FlatNavigationItem): boolean {
    const siblings = this.flatNavigations()
      .filter((n) => (n.parentId || null) === (item.parentId || null))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return siblings.length > 0 && siblings[siblings.length - 1].id === item.id;
  }

  protected moveNav(item: FlatNavigationItem, dir: -1 | 1): void {
    const siblings = this.flatNavigations()
      .filter((n) => (n.parentId || null) === (item.parentId || null))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === item.id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const other = siblings[targetIdx];
    const payload = {
      items: [
        { id: item.id, orderIndex: other.orderIndex, parentId: item.parentId || null },
        { id: other.id, orderIndex: item.orderIndex, parentId: other.parentId || null },
      ],
    };

    this.api.reorderNavigation(payload).subscribe({
      next: () => {
        this.toast.show(`Reordered '${item.title}'`, 'success');
        this.loadNavigations();
        this.ui.triggerNavigationRefresh();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to reorder navigation item', 'danger');
      },
    });
  }

  protected openAddNav(): void {
    this.editingNavId.set(null);
    this.originalEditingNavCode = '';
    this.navForm = {
      title: '',
      code: '',
      route: '',
      icon: 'dashboard',
      parentId: null,
      orderIndex: this.flatNavigations().length + 1,
      isActive: true,
    };
    this.showNavModal.set(true);
  }

  protected editNav(item: FlatNavigationItem): void {
    this.editingNavId.set(item.id);
    this.originalEditingNavCode = (item.code || '').trim().toUpperCase();
    this.navForm = {
      title: item.title,
      code: item.code,
      route: item.route,
      icon: item.icon,
      parentId: item.parentId || null,
      orderIndex: item.orderIndex,
      isActive: item.isActive,
    };
    this.showNavModal.set(true);
  }

  protected saveNav(): void {
    if (!this.navForm.title?.trim()) {
      this.toast.show('Please enter navigation title', 'danger');
      return;
    }
    if (!this.navForm.code?.trim()) {
      this.toast.show('Please enter navigation code', 'danger');
      return;
    }
    if (!this.navForm.route?.trim()) {
      this.toast.show('Please enter route path', 'danger');
      return;
    }

    if (this.isDuplicateNavCode()) {
      this.toast.show(`Code '${this.navForm.code.trim().toUpperCase()}' is already in use by another navigation item. Please choose a unique code.`, 'danger');
      return;
    }

    this.savingNav.set(true);
    const id = this.editingNavId();

    let cleanRoute = this.navForm.route.trim();
    if (!cleanRoute.startsWith('/') && !cleanRoute.startsWith('#')) {
      cleanRoute = '/' + cleanRoute;
    }

    const parsedOrder = parseInt(String(this.navForm.orderIndex), 10);
    const orderIndex = isNaN(parsedOrder) || parsedOrder < 1 ? 1 : parsedOrder;

    const payload = {
      id: id || undefined,
      title: this.navForm.title.trim(),
      code: this.navForm.code.trim().toUpperCase(),
      route: cleanRoute,
      icon: this.navForm.icon || 'settings',
      parentId: this.navForm.parentId || null,
      orderIndex: orderIndex,
      isActive: this.navForm.isActive ?? true,
    };

    if (id) {
      this.api.updateNavigationItem(id, payload).subscribe({
        next: (updated) => {
          this.toast.show(`Navigation item '${updated.title}' updated successfully`, 'success');
          this.savingNav.set(false);
          this.showNavModal.set(false);
          this.loadNavigations();
          this.ui.triggerNavigationRefresh();
        },
        error: (err) => {
          const msg = err?.error?.message 
            || err?.error?.title 
            || (err?.error?.errors ? Object.values(err.error.errors).flat().join(', ') : null)
            || 'Failed to update navigation item';
          this.toast.show(msg, 'danger');
          this.savingNav.set(false);
        },
      });
    } else {
      this.api.createNavigationItem(payload).subscribe({
        next: (created) => {
          this.toast.show(`Navigation item '${created.title}' added successfully`, 'success');
          this.savingNav.set(false);
          this.showNavModal.set(false);
          this.loadNavigations();
          this.ui.triggerNavigationRefresh();
        },
        error: (err) => {
          const msg = err?.error?.message 
            || err?.error?.title 
            || (err?.error?.errors ? Object.values(err.error.errors).flat().join(', ') : null)
            || 'Failed to create navigation item';
          this.toast.show(msg, 'danger');
          this.savingNav.set(false);
        },
      });
    }
  }

  protected deleteNav(id: string, code: string): void {
    if (code === 'SETT') {
      this.toast.show('Settings navigation item is protected and cannot be deleted', 'danger');
      return;
    }
    if (!confirm('Are you sure you want to delete this navigation item and its sub-items?')) {
      return;
    }

    this.api.deleteNavigationItem(id).subscribe({
      next: () => {
        this.toast.show('Navigation item removed', 'success');
        this.loadNavigations();
        this.ui.triggerNavigationRefresh();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to delete navigation item', 'danger');
      },
    });
  }

  // ── Permissions Matrix Backend Integration ──
  protected selectRoleForPermissions(role: RoleItem): void {
    this.selectedRole.set(role);
    this.loadPermissionsForRole(role.id);
  }

  protected loadPermissionsForRole(roleId: string): void {
    this.api.rolePermissions(roleId).subscribe({
      next: (perms) => {
        this.rolePermissions.set(perms);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to load permissions for role', 'danger');
      },
    });
  }

  protected isProtectedAdminRole(): boolean {
    const role = this.selectedRole();
    if (!role) return false;
    const name = role.name.toLowerCase();
    const code = role.code.toLowerCase();
    return name.includes('admin') || code.includes('admin');
  }

  protected isSettingsModule(title: string, route: string): boolean {
    const t = (title || '').toLowerCase();
    const r = (route || '').toLowerCase();
    return t.includes('setting') || r.includes('setting');
  }

  protected onToggleFull(perm: RoleNavigationPermission): void {
    perm.isView = perm.isFull;
    perm.isCreate = perm.isFull;
    perm.isEdit = perm.isFull;
    perm.isDelete = perm.isFull;
  }

  protected onCheckChild(perm: RoleNavigationPermission): void {
    perm.isFull = perm.isView && perm.isCreate && perm.isEdit && perm.isDelete;
  }

  protected saveRolePermissions(): void {
    const role = this.selectedRole();
    if (!role) return;

    this.savingPermissions.set(true);

    const payload = {
      roleId: role.id,
      permissions: this.rolePermissions().map((p) => ({
        navigationItemId: p.navigationItemId,
        isFull: p.isFull,
        isView: p.isView,
        isCreate: p.isCreate,
        isEdit: p.isEdit,
        isDelete: p.isDelete,
      })),
    };

    this.api.saveRolePermissions(payload).subscribe({
      next: () => {
        this.toast.show(`Permissions for '${role.name}' saved successfully!`, 'success');
        this.savingPermissions.set(false);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to save permissions', 'danger');
        this.savingPermissions.set(false);
      },
    });
  }

  // ── Key Group Backend Integration & Screenshot 1 Editor ──
  protected loadKeyGroups(): void {
    this.api.keyGroups().subscribe({
      next: (list) => {
        this.keyGroups.set(list || []);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to load key groups', 'danger');
      },
    });
  }

  protected openAddKeyGroup(): void {
    this.originalEditingKg = null;
    this.keyGroupEditForm = { id: '', code: '', name: '', description: '', isGeneric: false };
    this.keyStoreRows.set([
      { key: '', value: '', subValue: '', isActive: true },
    ]);
    this.isEditingKeyGroup.set(true);
  }

  protected editKeyGroup(kg: KeyGroup): void {
    this.originalEditingKg = kg;
    this.keyGroupEditForm = {
      id: kg.id,
      code: kg.code,
      name: kg.name,
      description: kg.description || '',
      isGeneric: kg.isGeneric ?? false,
    };
    const rows = (kg.items || []).map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value,
      subValue: s.subValue || '',
      isActive: s.isActive,
    }));
    this.keyStoreRows.set(rows.length > 0 ? rows : [{ key: '', value: '', subValue: '', isActive: true }]);
    this.isEditingKeyGroup.set(true);
  }

  protected addKeyStoreRow(): void {
    if (this.isEnumLocked()) {
      this.toast.show('Adding new values is locked for system enum key groups.', 'warning');
      return;
    }
    this.keyStoreRows.update((rows) => [
      ...rows,
      { key: '', value: '', subValue: '', isActive: true },
    ]);
  }

  protected removeKeyStoreRow(index: number): void {
    if (this.isEnumLocked()) {
      this.toast.show('Deleting values is locked for system enum key groups. You can toggle active/inactive instead.', 'warning');
      return;
    }
    this.keyStoreRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected resetKeyGroupEditor(): void {
    if (this.originalEditingKg) {
      this.editKeyGroup(this.originalEditingKg);
    } else {
      this.openAddKeyGroup();
    }
  }

  protected closeKeyGroupEditor(): void {
    this.isEditingKeyGroup.set(false);
  }

  protected saveKeyGroupEditor(): void {
    const name = this.keyGroupEditForm.name.trim();
    const code = this.keyGroupEditForm.code.trim();

    if (!name) {
      this.toast.show('Please enter a key group name', 'danger');
      return;
    }
    if (!code) {
      this.toast.show('Please enter a key group code', 'danger');
      return;
    }

    this.savingKeyGroup.set(true);

    const isNew = !this.keyGroupEditForm.id || this.keyGroupEditForm.id.trim() === '';
    const groupId = isNew ? undefined : this.keyGroupEditForm.id.trim();

    const items: SaveKeyStoreRequest[] = this.keyStoreRows()
      .filter((r) => r.key.trim() || r.value.trim())
      .map((r, idx) => ({
        id: r.id?.trim() || undefined,
        keyGroupId: groupId,
        key: r.key.trim() || r.value.trim(),
        value: r.value.trim() || r.key.trim(),
        subValue: r.subValue?.trim() || null,
        displayOrder: idx + 1,
        isActive: r.isActive ?? true,
      }));

    const payload: SaveKeyGroupRequest = {
      id: groupId,
      code,
      name,
      description: this.keyGroupEditForm.description?.trim() || null,
      isGeneric: this.keyGroupEditForm.isGeneric ?? false,
      items,
    };

    this.api.saveKeyGroup(payload).subscribe({
      next: () => {
        this.toast.show(`Key group '${name}' saved successfully`, 'success');
        this.keyGroupCache.clearCache();
        this.savingKeyGroup.set(false);
        this.isEditingKeyGroup.set(false);
        this.loadKeyGroups();
      },
      error: (err) => {
        const msg = err?.error?.message 
          || err?.error?.title 
          || (err?.error?.errors ? Object.values(err.error.errors).flat().join(', ') : null)
          || 'Failed to save key group';
        this.toast.show(msg, 'danger');
        this.savingKeyGroup.set(false);
      },
    });
  }

  protected deleteKeyGroup(kg: KeyGroup): void {
    if (kg.isGeneric) {
      this.toast.show(`Key group '${kg.name}' is a generic system group and cannot be deleted`, 'warning');
      return;
    }
    if (!confirm(`Are you sure you want to delete key group '${kg.name}'?`)) {
      return;
    }

    this.api.deleteKeyGroup(kg.id).subscribe({
      next: () => {
        this.toast.show(`Key group '${kg.name}' deleted successfully`, 'success');
        this.keyGroupCache.clearCache();
        this.loadKeyGroups();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to delete key group', 'danger');
        this.loadKeyGroups();
      },
    });
  }

  protected toggleGeneric(kg: FlatKeyGroupItem): void {
    const updated: SaveKeyGroupRequest = {
      id: kg.id,
      code: kg.code,
      name: kg.name,
      isGeneric: !kg.isGeneric,
    };
    this.api.saveKeyGroup(updated).subscribe({
      next: () => {
        this.toast.show(`Key group '${kg.name}' isGeneric: ${!kg.isGeneric}`, 'info');
        this.keyGroupCache.clearCache();
        this.loadKeyGroups();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Failed to update generic status', 'danger');
      },
    });
  }
}
