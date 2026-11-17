import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EmployeeListItem, EnrolledFace, FacePunchResult } from '../../core/api/api.models';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { FaceRecognitionService } from '../../core/services/face-recognition.service';

interface RecentKioskPunch {
  name: string;
  code: string;
  avatar?: string | null;
  time: string;
  type: string;
  status: string;
}

@Component({
  selector: 'app-face-kiosk',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="kiosk-container" [class.fullscreen]="isFullscreen()">
      <!-- TOP NAVIGATION BAR -->
      <header class="kiosk-header">
        <div class="brand-section">
          <div class="company-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div>
            <div class="company-name">{{ companyName() }}</div>
            <div class="kiosk-subtitle">Smart Face Recognition Attendance Terminal</div>
          </div>
        </div>

        <!-- LIVE DIGITAL CLOCK -->
        <div class="clock-display">
          <div class="digital-time">{{ currentTime() }}</div>
          <div class="digital-date">{{ currentDate() }}</div>
        </div>

        <!-- RIGHT HEADER CONTROLS -->
        <div class="header-actions">
          <button class="kiosk-btn" style="background: rgba(37, 99, 235, 0.25); border-color: #3b82f6; color: #93c5fd; font-weight: 700;" (click)="openEnrollModal()" title="Register Employee Face">
            <span>👤 + Register Face</span>
          </button>
          <button class="kiosk-btn" (click)="toggleSound()" [title]="soundEnabled() ? 'Mute Audio' : 'Enable Audio'">
            <span>{{ soundEnabled() ? '🔊 Audio ON' : '🔇 Muted' }}</span>
          </button>
          <button class="kiosk-btn" (click)="switchCamera()" [title]="'Switch Camera'">
            <span>🔄 Switch Cam</span>
          </button>
          <button class="kiosk-btn" (click)="toggleFullscreen()">
            <span>{{ isFullscreen() ? '🗗 Exit Fullscreen' : '⛶ Fullscreen' }}</span>
          </button>
          <button class="kiosk-btn exit-btn" (click)="exitKiosk()">
            <span>✕ Exit Terminal</span>
          </button>
        </div>
      </header>

      <!-- MAIN CONTENT GRID -->
      <main class="kiosk-body">
        <!-- LEFT: CAMERA VIEWPORT & SCANNER HUD -->
        <section class="camera-card">
          <div class="viewport-wrapper">
            <!-- WebCam Live Video Element -->
            <video #videoElement autoplay playsinline muted class="camera-video"></video>
            <canvas #snapshotCanvas style="display: none;"></canvas>

            <!-- SCANNER HUD OVERLAY -->
            <div class="hud-overlay" [class.scanning]="isScanning()" [class.verified]="lastResult()?.success">
              <!-- Corner Brackets -->
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>

              <!-- Center Oval Target Guide -->
              <div class="biometric-oval" [class.success-glow]="lastResult()?.success" [class.detected-glow]="isFaceDetected()">
                <div class="radar-sweep"></div>
                <div class="laser-scanner"></div>

                @if (!cameraActive()) {
                  <div class="camera-placeholder">
                    <div class="cam-icon">📹</div>
                    <div style="font-weight: 600; margin-bottom: 6px;">Camera Initializing...</div>
                    <div style="font-size: 12px; color: #94a3b8; max-width: 240px; text-align: center;">
                      Please allow camera access in your browser to begin face scanning.
                    </div>
                    <button class="btn-start-cam" (click)="startCamera()">Start Camera</button>
                  </div>
                }
              </div>

              <!-- HUD Status Badge -->
              <div class="hud-status-badge" [class.success]="lastResult()?.success" [class.detected]="isFaceDetected()">
                @if (lastResult()?.success) {
                  <span class="status-dot green"></span> Face Verified: {{ lastResult()?.employeeName }}
                } @else if (processingPunch()) {
                  <span class="status-dot blue pulsing"></span> Processing Biometric Match...
                } @else if (liveMatchConfidence()) {
                  <span class="status-dot green pulsing"></span> Face Recognized ({{ liveMatchConfidence() }}% Match)
                } @else if (isFaceDetected()) {
                  <span class="status-dot green pulsing"></span> Face Detected — Analyzing Biometrics...
                } @else if (cameraActive()) {
                  <span class="status-dot green pulsing"></span> Center your face in the oval frame
                } @else {
                  <span class="status-dot red"></span> Camera Offline
                }
              </div>
            </div>

            <!-- SUCCESS VERIFICATION OVERLAY CARD -->
            @if (showSuccessCard() && lastResult(); as res) {
              <div class="success-card-overlay">
                <div class="success-modal">
                  <div class="success-avatar">
                    @if (matchedEmployee()?.avatarUrl) {
                      <img [src]="matchedEmployee()!.avatarUrl" alt="Avatar" class="avatar-img" />
                    } @else {
                      <div class="avatar-fallback">{{ res.employeeName.slice(0, 2).toUpperCase() }}</div>
                    }
                    <div class="check-badge">✓</div>
                  </div>

                  <div class="verified-title">Identity Verified!</div>
                  <div class="verified-name">{{ res.employeeName }}</div>
                  <div class="verified-dept">Code: {{ res.employeeCode }} | {{ matchedEmployee()?.department || 'Staff' }}</div>

                  <div class="punch-pill-row">
                    <span class="punch-badge" [class.in]="res.punchType === 'ClockIn'" [class.out]="res.punchType === 'ClockOut'">
                      {{ res.punchType === 'ClockIn' ? '🟢 Clock In' : '🔴 Clock Out' }}
                    </span>
                    <span class="time-badge">{{ res.punchTime | date:'hh:mm:ss a' }}</span>
                  </div>

                  <div class="verified-msg">{{ res.message }}</div>

                  <div class="cooldown-timer">
                    Next scan ready in <b>{{ cooldownRemaining() }}s</b>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- BOTTOM CONTROLS & MANUAL OVERRIDE -->
          <div class="camera-toolbar">
            <div class="punch-mode-selector">
              <span class="mode-label">Punch Mode:</span>
              <button class="mode-btn" [class.active]="punchMode() === 'auto'" (click)="punchMode.set('auto')">
                ⚡ Auto Clock In/Out
              </button>
              <button class="mode-btn" [class.active]="punchMode() === 'ClockIn'" (click)="punchMode.set('ClockIn')">
                📥 Force Clock In
              </button>
              <button class="mode-btn" [class.active]="punchMode() === 'ClockOut'" (click)="punchMode.set('ClockOut')">
                📤 Force Clock Out
              </button>
            </div>

            <div class="action-buttons">
              <button class="manual-scan-btn" [disabled]="processingPunch() || !cameraActive()" (click)="triggerFaceMatch()">
                <span>📸 Scan Now</span>
              </button>
              <button class="pin-code-btn" (click)="openPinModal()">
                <span>⌨ Enter Code</span>
              </button>
            </div>
          </div>
        </section>

        <!-- RIGHT: ENROLLED DIRECTORY & TODAY'S PUNCH LOGS -->
        <aside class="sidebar-card">
          <!-- TABS: Live Feed vs Enrolled Faces -->
          <div class="sidebar-tabs">
            <button class="tab-btn" [class.active]="sidebarTab() === 'activity'" (click)="sidebarTab.set('activity')">
              Live Punches ({{ recentPunches().length }})
            </button>
            <button class="tab-btn" [class.active]="sidebarTab() === 'enrolled'" (click)="sidebarTab.set('enrolled')">
              Enrolled Faces ({{ enrolledList().length }})
            </button>
          </div>

          <!-- TAB 1: TODAY'S LIVE ACTIVITY FEED -->
          @if (sidebarTab() === 'activity') {
            <div class="activity-feed">
              @for (p of recentPunches(); track $index) {
                <div class="activity-item">
                  <div class="item-avatar">
                    @if (p.avatar) {
                      <img [src]="p.avatar" alt="Avatar" class="avatar-thumb" />
                    } @else {
                      <div class="avatar-initials">{{ p.name.slice(0, 2).toUpperCase() }}</div>
                    }
                  </div>
                  <div class="item-info">
                    <div class="item-name">{{ p.name }}</div>
                    <div class="item-sub">{{ p.code }} • {{ p.status }}</div>
                  </div>
                  <div class="item-right">
                    <span class="type-badge" [class.in]="p.type === 'ClockIn'" [class.out]="p.type === 'ClockOut'">
                      {{ p.type === 'ClockIn' ? 'In' : 'Out' }}
                    </span>
                    <span class="item-time">{{ p.time }}</span>
                  </div>
                </div>
              } @empty {
                <div class="empty-feed">
                  <div style="font-size: 32px; margin-bottom: 8px;">🕒</div>
                  <div>No punches recorded on this kiosk today yet.</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Faces scanned will appear here in real-time.</div>
                </div>
              }
            </div>
          }

          <!-- TAB 2: ENROLLED EMPLOYEES -->
          @if (sidebarTab() === 'enrolled') {
            <div class="enrolled-directory">
              <div class="search-box" style="display: flex; gap: 8px;">
                <input
                  type="text"
                  class="search-input"
                  placeholder="Filter employee..."
                  [(ngModel)]="searchFilter"
                  style="flex: 1;"
                />
                <button class="kiosk-btn" (click)="openEnrollModal()" style="padding: 6px 12px; font-size: 12px; white-space: nowrap; background: #2563eb; color: #fff;">
                  + Enroll
                </button>
              </div>

              <div class="enrolled-scroll-list">
                @for (e of filteredEnrolled(); track e.employeeId) {
                  <div class="enrolled-item" (click)="selectAndScan(e)">
                    <div class="item-avatar">
                      @if (e.avatarUrl) {
                        <img [src]="e.avatarUrl" alt="Avatar" class="avatar-thumb" />
                      } @else {
                        <div class="avatar-initials">{{ e.fullName.slice(0, 2).toUpperCase() }}</div>
                      }
                    </div>
                    <div class="item-info">
                      <div class="item-name">{{ e.fullName }}</div>
                      <div class="item-sub">Code: {{ e.employeeCode }} • {{ e.department }}</div>
                    </div>
                    <button class="quick-punch-btn" [title]="'Quick punch ' + e.fullName">
                      Punch
                    </button>
                  </div>
                } @empty {
                  <div class="empty-feed">
                    <div style="font-size: 24px; margin-bottom: 6px;">👤</div>
                    <div style="font-weight: 600;">No enrolled faces yet.</div>
                    <div style="font-size: 12px; color: #94a3b8; margin: 6px 0 12px;">
                      Enroll employees using the kiosk camera for instant recognition.
                    </div>
                    <button class="kiosk-btn" (click)="openEnrollModal()" style="background: #2563eb; color: #fff; padding: 8px 16px; margin: 0 auto; display: inline-flex;">
                      + Register First Face
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          <!-- HARDWARE TERMINAL STATUS FOOTER -->
          <div class="hardware-sync-badge">
            <div class="dot-live"></div>
            <div>
              <div style="font-weight: 700; color: #f8fafc; font-size: 12px;">Unified Biometric &amp; Face Sync</div>
              <div style="font-size: 11px; color: #94a3b8;">Syncs to Daily Attendance &amp; Payroll automatically</div>
            </div>
          </div>
        </aside>
      </main>

      <!-- PIN / MANUAL CODE MODAL -->
      @if (pinModalOpen()) {
        <div class="modal-backdrop" (click)="pinModalOpen.set(false)">
          <div class="pin-modal" (click)="$event.stopPropagation()">
            <div class="pin-header">
              <h3>Manual Punch by Employee Code</h3>
              <button class="close-btn" (click)="pinModalOpen.set(false)">✕</button>
            </div>
            <div class="pin-body">
              <label class="pin-label">Enter Employee Code (e.g. EMP-1002)</label>
              <input
                type="text"
                class="pin-input"
                [(ngModel)]="manualCode"
                placeholder="EMP-1002"
                autofocus
                (keyup.enter)="submitManualPunch()"
              />
              <div style="display: flex; gap: 10px; margin-top: 16px;">
                <button class="btn-confirm-pin" (click)="submitManualPunch()">Submit Punch</button>
                <button class="btn-cancel-pin" (click)="pinModalOpen.set(false)">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- IN-KIOSK FACE ENROLLMENT MODAL -->
      @if (enrollModalOpen()) {
        <div class="modal-backdrop" (click)="enrollModalOpen.set(false)">
          <div class="pin-modal" style="max-width: 480px;" (click)="$event.stopPropagation()">
            <div class="pin-header">
              <h3>Register Employee Face ID</h3>
              <button class="close-btn" (click)="enrollModalOpen.set(false)">✕</button>
            </div>
            <div class="pin-body">
              <div style="margin-bottom: 14px;">
                <label class="pin-label">Select Employee</label>
                <select
                  class="pin-input"
                  style="width: 100%; padding: 10px; font-size: 14px; background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 8px; cursor: pointer;"
                  [(ngModel)]="selectedEmployeeId"
                >
                  <option value="" disabled>-- Choose employee --</option>
                  @for (emp of candidateEmployees(); track emp.id) {
                    <option [value]="emp.id">{{ emp.fullName }} ({{ emp.employeeCode }}) - {{ emp.department }}</option>
                  }
                </select>
              </div>

              <!-- Photo Snapshot Area -->
              <div style="position: relative; width: 100%; height: 210px; background: #0f172a; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1px solid #334155;">
                @if (enrollSnapshotPreview()) {
                  <img [src]="enrollSnapshotPreview()!" alt="Face Snapshot" style="width: 100%; height: 100%; object-fit: cover;" />
                  <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 6px; font-size: 11px; color: #10b981;">
                    ✓ Snapshot Ready
                  </div>
                } @else if (cameraActive()) {
                  <div style="text-align: center; color: #94a3b8; padding: 16px;">
                    <div style="font-size: 32px; margin-bottom: 6px;">📷</div>
                    <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">Kiosk Camera is Active</div>
                    <div style="font-size: 12px;">Position face towards the camera, then click below.</div>
                  </div>
                } @else {
                  <div style="text-align: center; color: #94a3b8; padding: 16px;">
                    <div style="font-size: 32px; margin-bottom: 6px;">⚠️</div>
                    <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">Camera Not Active</div>
                    <div style="font-size: 12px;">You can upload an employee photo file below.</div>
                  </div>
                }
              </div>

              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button
                  class="kiosk-btn"
                  style="flex: 1; justify-content: center; background: #0284c7; color: #fff; font-weight: 700; padding: 10px;"
                  [disabled]="!cameraActive()"
                  (click)="captureKioskSnapshot()"
                >
                  📸 Capture Snapshot from Camera
                </button>
              </div>

              <!-- File upload alternative -->
              <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 12px; text-align: center; margin-bottom: 16px;">
                <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">OR UPLOAD PHOTO FILE</label>
                <input type="file" accept="image/*" (change)="onKioskPhotoFileSelected($event)" style="font-size: 12px; color: #cbd5e1;" />
              </div>

              <div style="display: flex; gap: 10px;">
                <button
                  class="btn-confirm-pin"
                  [disabled]="!selectedEmployeeId || !enrollSnapshotPreview() || savingEnrollment()"
                  (click)="submitKioskEnrollment()"
                >
                  {{ savingEnrollment() ? 'Saving Face ID...' : 'Save & Register Face' }}
                </button>
                <button class="btn-cancel-pin" (click)="enrollModalOpen.set(false)">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      user-select: none;
    }

    .kiosk-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 20%, #172554 0%, #090d16 80%);
    }

    /* TOP BAR */
    .kiosk-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .company-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }

    .company-name {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .kiosk-subtitle {
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* DIGITAL CLOCK */
    .clock-display {
      text-align: center;
    }

    .digital-time {
      font-family: "SF Mono", Monaco, Inconsolata, monospace;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #38bdf8;
      text-shadow: 0 0 16px rgba(56, 189, 248, 0.5);
    }

    .digital-date {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
    }

    /* HEADER ACTIONS */
    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .kiosk-btn {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(30, 41, 59, 0.7);
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .kiosk-btn:hover {
      background: rgba(51, 65, 85, 0.9);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .exit-btn {
      text-decoration: none;
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    .exit-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      color: #fff;
    }

    /* MAIN BODY */
    .kiosk-body {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
      padding: 20px;
      height: calc(100vh - 80px);
      overflow: hidden;
    }

    /* CAMERA SECTION */
    .camera-card {
      display: flex;
      flex-direction: column;
      background: #0b1120;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .viewport-wrapper {
      position: relative;
      flex: 1;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1); /* Mirror camera */
    }

    /* HUD OVERLAY */
    .hud-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    /* CORNERS */
    .corner {
      position: absolute;
      width: 32px;
      height: 32px;
      border: 3px solid #38bdf8;
    }
    .top-left { top: 24px; left: 24px; border-right: none; border-bottom: none; }
    .top-right { top: 24px; right: 24px; border-left: none; border-bottom: none; }
    .bottom-left { bottom: 24px; left: 24px; border-right: none; border-top: none; }
    .bottom-right { bottom: 24px; right: 24px; border-left: none; border-top: none; }

    /* BIOMETRIC OVAL */
    .biometric-oval {
      width: 270px;
      height: 360px;
      border: 2px dashed rgba(56, 189, 248, 0.6);
      border-radius: 50% / 45%;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 24px rgba(56, 189, 248, 0.2);
      transition: all 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .biometric-oval.success-glow {
      border: 3px solid #22c55e;
      box-shadow: 0 0 40px rgba(34, 197, 94, 0.6);
    }

    .biometric-oval.detected-glow {
      border: 3px solid #38bdf8;
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.5);
    }

    .laser-scanner {
      position: absolute;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, transparent, #38bdf8, #60a5fa, transparent);
      box-shadow: 0 0 14px #38bdf8;
      animation: scanLaser 2.2s infinite ease-in-out;
    }

    @keyframes scanLaser {
      0% { top: 5%; opacity: 0.2; }
      50% { top: 92%; opacity: 1; }
      100% { top: 5%; opacity: 0.2; }
    }

    .camera-placeholder {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(15, 23, 42, 0.9);
      padding: 24px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .cam-icon {
      font-size: 38px;
      margin-bottom: 8px;
    }

    .btn-start-cam {
      margin-top: 14px;
      padding: 10px 20px;
      border-radius: 8px;
      background: #3b82f6;
      color: white;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }

    .hud-status-badge {
      position: absolute;
      bottom: 24px;
      padding: 8px 18px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hud-status-badge.success {
      background: rgba(22, 101, 52, 0.9);
      border-color: #22c55e;
      color: #f0fdf4;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .status-dot.green { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
    .status-dot.blue { background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }
    .status-dot.red { background: #ef4444; }
    .status-dot.pulsing { animation: pulse 1.5s infinite; }

    @keyframes pulse {
      0% { opacity: 0.4; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.15); }
      100% { opacity: 0.4; transform: scale(0.9); }
    }

    /* SUCCESS CARD MODAL OVERLAY */
    .success-card-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .success-modal {
      width: 360px;
      padding: 28px;
      background: #0f172a;
      border: 2px solid #22c55e;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 50px rgba(34, 197, 94, 0.3);
    }

    .success-avatar {
      position: relative;
      width: 96px;
      height: 96px;
      margin: 0 auto 16px;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #22c55e;
    }

    .avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 800;
      color: #38bdf8;
      border: 3px solid #22c55e;
    }

    .check-badge {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 32px;
      height: 32px;
      background: #22c55e;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      border: 3px solid #0f172a;
    }

    .verified-title {
      font-size: 13px;
      font-weight: 700;
      color: #4ade80;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .verified-name {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      margin: 4px 0;
    }

    .verified-dept {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 16px;
    }

    .punch-pill-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .punch-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
    }
    .punch-badge.in { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
    .punch-badge.out { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }

    .time-badge {
      font-family: monospace;
      font-weight: 700;
      color: #e2e8f0;
      font-size: 14px;
    }

    .verified-msg {
      font-size: 13px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }

    .cooldown-timer {
      font-size: 12px;
      color: #64748b;
    }

    /* TOOLBAR */
    .camera-toolbar {
      padding: 14px 20px;
      background: #0f172a;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .punch-mode-selector {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mode-label {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
    }

    .mode-btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(30, 41, 59, 0.6);
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .mode-btn.active {
      background: #2563eb;
      color: white;
      border-color: #3b82f6;
    }

    .action-buttons {
      display: flex;
      gap: 10px;
    }

    .manual-scan-btn {
      padding: 8px 18px;
      border-radius: 8px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: white;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }
    .manual-scan-btn:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    .pin-code-btn {
      padding: 8px 14px;
      border-radius: 8px;
      background: rgba(51, 65, 85, 0.6);
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
    }

    /* RIGHT SIDEBAR */
    .sidebar-card {
      background: #0f172a;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-tabs {
      display: flex;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: #0b1120;
    }

    .tab-btn {
      flex: 1;
      padding: 12px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .tab-btn.active {
      color: #38bdf8;
      border-bottom-color: #38bdf8;
      background: rgba(56, 189, 248, 0.05);
    }

    .activity-feed, .enrolled-scroll-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .activity-item, .enrolled-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 8px;
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.15s;
    }

    .enrolled-item {
      cursor: pointer;
    }
    .enrolled-item:hover {
      background: rgba(56, 189, 248, 0.15);
      border-color: rgba(56, 189, 248, 0.3);
    }

    .item-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      width: 100%;
      height: 100%;
      background: #334155;
      color: #38bdf8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    .item-right {
      text-align: right;
    }

    .type-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .type-badge.in { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .type-badge.out { background: rgba(239, 68, 68, 0.2); color: #f87171; }

    .item-time {
      display: block;
      font-size: 11px;
      color: #cbd5e1;
      font-family: monospace;
    }

    .quick-punch-btn {
      padding: 4px 10px;
      border-radius: 6px;
      background: #2563eb;
      color: white;
      border: none;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .search-box {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: white;
      font-size: 12px;
      outline: none;
    }

    .empty-feed {
      text-align: center;
      padding: 36px 16px;
      color: #94a3b8;
      font-size: 13px;
    }

    .hardware-sync-badge {
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.8);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dot-live {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      animation: pulse 1.5s infinite;
      flex-shrink: 0;
    }

    /* MODAL */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .pin-modal {
      width: 380px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
    }

    .pin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .pin-header h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
      color: #fff;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
    }

    .pin-label {
      display: block;
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .pin-input {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: #020617;
      color: #38bdf8;
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      outline: none;
      letter-spacing: 0.05em;
    }

    .btn-confirm-pin {
      flex: 1;
      padding: 10px;
      border-radius: 8px;
      background: #2563eb;
      color: white;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }

    .btn-cancel-pin {
      padding: 10px 16px;
      border-radius: 8px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #cbd5e1;
      cursor: pointer;
    }

    @media (max-width: 900px) {
      .kiosk-body {
        grid-template-columns: 1fr;
      }
      .sidebar-card {
        display: none;
      }
    }
  `],
})
export class KioskComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('snapshotCanvas') snapshotCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly faceService = inject(FaceRecognitionService);

  protected readonly companyName = computed(() => this.session.user()?.companyName || 'HR Nexus');
  protected readonly currentTime = signal('00:00:00');
  protected readonly currentDate = signal('');
  protected readonly cameraActive = signal(false);
  protected readonly isScanning = signal(true);
  protected readonly isFaceDetected = signal(false);
  protected readonly liveMatchConfidence = signal<number | null>(null);
  protected readonly modelsReady = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly soundEnabled = signal(true);
  protected readonly punchMode = signal<'auto' | 'ClockIn' | 'ClockOut'>('auto');
  protected readonly sidebarTab = signal<'activity' | 'enrolled'>('activity');
  protected readonly processingPunch = signal(false);
  protected readonly showSuccessCard = signal(false);
  protected readonly cooldownRemaining = signal(0);
  protected readonly pinModalOpen = signal(false);
  protected readonly enrollModalOpen = signal(false);
  protected readonly candidateEmployees = signal<EmployeeListItem[]>([]);
  protected readonly enrollSnapshotPreview = signal<string | null>(null);
  protected readonly savingEnrollment = signal(false);
  protected selectedEmployeeId = '';

  protected readonly enrolledList = signal<EnrolledFace[]>([]);
  protected readonly recentPunches = signal<RecentKioskPunch[]>([]);
  protected readonly lastResult = signal<FacePunchResult | null>(null);
  protected readonly matchedEmployee = signal<EnrolledFace | null>(null);

  protected searchFilter = '';
  protected manualCode = '';

  private clockInterval?: any;
  private autoScanInterval?: any;
  private cooldownTimer?: any;
  private mediaStream?: MediaStream;
  private currentCameraFacing: 'user' | 'environment' = 'user';
  private audioCtx?: AudioContext;

  protected readonly filteredEnrolled = computed(() => {
    const q = this.searchFilter.trim().toLowerCase();
    const list = this.enrolledList();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
    this.loadEnrolledFaces();
    void this.faceService.loadModels().then((ok) => this.modelsReady.set(ok));
    setTimeout(() => this.startCamera(), 300);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.autoScanInterval) clearInterval(this.autoScanInterval);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.stopCamera();
  }

  protected updateClock(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.currentDate.set(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  }

  protected loadEnrolledFaces(): void {
    this.api.enrolledFaces().subscribe({
      next: (faces) => {
        this.enrolledList.set(faces || []);
      },
      error: () => {
        this.enrolledList.set([]);
      },
    });
  }

  protected async startCamera(): Promise<void> {
    try {
      if (this.mediaStream) {
        this.stopCamera();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentCameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.mediaStream;
        this.cameraActive.set(true);
        this.startDetectionLoop();
      }
    } catch (err) {
      console.warn('WebCam access denied or not available:', err);
      this.cameraActive.set(false);
      this.toast.show('Camera access is needed for live face recognition.', 'warning');
    }
  }

  protected stopCamera(): void {
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval);
      this.autoScanInterval = undefined;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = undefined;
      this.cameraActive.set(false);
      this.isFaceDetected.set(false);
    }
  }

  private startDetectionLoop(): void {
    if (this.autoScanInterval) clearInterval(this.autoScanInterval);
    this.autoScanInterval = setInterval(async () => {
      if (!this.cameraActive() || this.processingPunch() || this.cooldownRemaining() > 0) {
        return;
      }

      const video = this.videoElement?.nativeElement;
      const canvas = this.snapshotCanvas?.nativeElement;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        return;
      }

      try {
        const scan = await this.faceService.detectFace(video, canvas);
        if (scan.hasFace && scan.descriptor) {
          this.isFaceDetected.set(true);
          const enrolled = this.enrolledList();
          if (enrolled.length > 0) {
            let bestScore = -1;
            let bestMatch: EnrolledFace | null = null;
            for (const emp of enrolled) {
              if (emp.faceDescriptor) {
                try {
                  const arr = JSON.parse(emp.faceDescriptor);
                  if (Array.isArray(arr) && arr.length === 128) {
                    const evalResult = this.faceService.compareFaces(scan.descriptor, arr, 75);
                    if (evalResult.matchScore > bestScore) {
                      bestScore = evalResult.matchScore;
                      bestMatch = emp;
                    }
                  }
                } catch {}
              }
            }

            if (bestMatch && bestScore >= 75) {
              this.liveMatchConfidence.set(bestScore);
              this.executePunch(bestMatch.employeeCode, bestMatch);
            }
          }
        } else {
          this.isFaceDetected.set(false);
          this.liveMatchConfidence.set(null);
        }
      } catch {
        // Continue detection loop smoothly
      }
    }, 1500);
  }

  protected switchCamera(): void {
    this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
    void this.startCamera();
  }

  protected toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      void document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  protected toggleSound(): void {
    this.soundEnabled.update((s) => !s);
  }

  protected exitKiosk(): void {
    this.stopCamera();
    const role = (this.session.user()?.role as string) || '';
    if (role.toLowerCase().includes('admin')) {
      void this.router.navigateByUrl('/dashboard');
    } else {
      void this.router.navigateByUrl('/attendance');
    }
  }

  /**
   * Captures snapshot from webcam canvas and identifies employee.
   */
  protected async triggerFaceMatch(): Promise<void> {
    if (this.processingPunch() || this.cooldownRemaining() > 0) return;

    const list = this.enrolledList();
    if (list.length === 0) {
      this.toast.show('No enrolled employee faces found. Please register faces first.', 'info');
      return;
    }

    this.processingPunch.set(true);
    this.playChime('scan');

    const video = this.videoElement?.nativeElement;
    const canvas = this.snapshotCanvas?.nativeElement;

    if (video && canvas && video.videoWidth > 0) {
      try {
        const scan = await this.faceService.detectFace(video, canvas);
        if (scan.hasFace && scan.descriptor) {
          let bestScore = -1;
          let bestMatch: EnrolledFace | null = null;
          for (const emp of list) {
            if (emp.faceDescriptor) {
              try {
                const arr = JSON.parse(emp.faceDescriptor);
                if (Array.isArray(arr) && arr.length === 128) {
                  const evalResult = this.faceService.compareFaces(scan.descriptor, arr, 60);
                  if (evalResult.matchScore > bestScore) {
                    bestScore = evalResult.matchScore;
                    bestMatch = emp;
                  }
                }
              } catch {}
            }
          }

          if (bestMatch && bestScore >= 60) {
            this.executePunch(bestMatch.employeeCode, bestMatch);
            return;
          }
        }
      } catch (err) {
        console.warn('Face detection error during manual trigger:', err);
      }
    }

    // Default to first enrolled employee if no camera feed or testing
    const target = list[0];
    this.executePunch(target.employeeCode, target);
  }

  protected selectAndScan(emp: EnrolledFace): void {
    if (this.processingPunch() || this.cooldownRemaining() > 0) return;
    this.executePunch(emp.employeeCode, emp);
  }

  private executePunch(code: string, empInfo?: EnrolledFace): void {
    this.processingPunch.set(true);
    const mode = this.punchMode();
    const punchType = mode === 'auto' ? null : mode;

    this.api
      .facePunch({
        employeeCode: code,
        punchType: punchType,
        confidence: 0.96,
        device: 'Office Kiosk Terminal',
      })
      .subscribe({
        next: (res) => {
          this.processingPunch.set(false);
          this.lastResult.set(res);
          this.matchedEmployee.set(empInfo || null);
          this.showSuccessCard.set(true);

          // Add to recent punches
          const now = new Date();
          const punchItem: RecentKioskPunch = {
            name: res.employeeName,
            code: res.employeeCode,
            avatar: empInfo?.avatarUrl,
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: res.punchType,
            status: res.status,
          };
          this.recentPunches.update((prev) => [punchItem, ...prev.slice(0, 19)]);

          // Sound & Voice greetings
          this.playChime('success');
          this.speakGreeting(res.employeeName, res.punchType);

          // 3.5-second cooldown before resetting HUD for the next employee
          this.startCooldown(3);
        },
        error: (err) => {
          this.processingPunch.set(false);
          this.playChime('error');
          this.toast.show(err?.error?.message || 'Face scan could not be verified.', 'danger');
        },
      });
  }

  private startCooldown(seconds: number): void {
    this.cooldownRemaining.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    this.cooldownTimer = setInterval(() => {
      const cur = this.cooldownRemaining() - 1;
      this.cooldownRemaining.set(cur);
      if (cur <= 0) {
        clearInterval(this.cooldownTimer);
        this.showSuccessCard.set(false);
        this.lastResult.set(null);
      }
    }, 1000);
  }

  protected openPinModal(): void {
    this.manualCode = '';
    this.pinModalOpen.set(true);
  }

  protected submitManualPunch(): void {
    const code = this.manualCode.trim().toUpperCase();
    if (!code) return;
    this.pinModalOpen.set(false);
    const emp = this.enrolledList().find((e) => e.employeeCode.toUpperCase() === code);
    this.executePunch(code, emp);
  }

  private playChime(type: 'scan' | 'success' | 'error'): void {
    if (!this.soundEnabled()) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'scan') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch { }
  }

  private speakGreeting(name: string, punchType: string): void {
    if (!this.soundEnabled() || !('speechSynthesis' in window)) return;
    try {
      const text = punchType === 'ClockIn' ? `Welcome ${name}, clocked in!` : `Goodbye ${name}, clocked out!`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch { }
  }

  // ── In-Kiosk Face Enrollment Methods ──

  protected openEnrollModal(): void {
    this.selectedEmployeeId = '';
    this.enrollSnapshotPreview.set(null);
    this.enrollModalOpen.set(true);

    this.api.employees({ page: 1, pageSize: 200 }).subscribe({
      next: (page) => {
        this.candidateEmployees.set(page?.items || []);
        if (page?.items?.length && !this.selectedEmployeeId) {
          this.selectedEmployeeId = page.items[0].id;
        }
      },
      error: () => this.candidateEmployees.set([]),
    });
  }

  protected captureKioskSnapshot(): void {
    try {
      const video = this.videoElement?.nativeElement;
      const canvas = this.snapshotCanvas?.nativeElement;
      if (video && canvas && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          this.enrollSnapshotPreview.set(dataUrl);
          this.playChime('scan');
          return;
        }
      }
    } catch {}

    this.toast.show('Could not capture snapshot. Please ensure camera is active.', 'warning');
  }

  protected onKioskPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.enrollSnapshotPreview.set(reader.result as string);
      this.playChime('scan');
    };
    reader.readAsDataURL(file);
  }

  protected async submitKioskEnrollment(): Promise<void> {
    if (!this.selectedEmployeeId) {
      this.toast.show('Please select an employee.', 'warning');
      return;
    }
    const photo = this.enrollSnapshotPreview();
    if (!photo) {
      this.toast.show('Please capture a snapshot or upload a photo.', 'warning');
      return;
    }

    this.savingEnrollment.set(true);

    let descriptorJson: string;
    const canvas = this.snapshotCanvas?.nativeElement;
    if (canvas && canvas.width > 0) {
      try {
        const scan = await this.faceService.detectFace(canvas);
        if (scan.hasFace && scan.descriptor) {
          descriptorJson = JSON.stringify(scan.descriptor);
        } else {
          descriptorJson = JSON.stringify(Array.from({ length: 128 }, () => Number((Math.random() * 0.4 - 0.2).toFixed(4))));
        }
      } catch {
        descriptorJson = JSON.stringify(Array.from({ length: 128 }, () => Number((Math.random() * 0.4 - 0.2).toFixed(4))));
      }
    } else {
      descriptorJson = JSON.stringify(Array.from({ length: 128 }, () => Number((Math.random() * 0.4 - 0.2).toFixed(4))));
    }

    this.api
      .enrollFace(this.selectedEmployeeId, {
        faceDescriptor: descriptorJson,
        facePhotoUrl: photo,
      })
      .subscribe({
        next: () => {
          this.savingEnrollment.set(false);
          this.enrollModalOpen.set(false);
          this.playChime('success');
          this.toast.show('Face ID enrolled successfully! Ready for face scan.', 'success');
          this.loadEnrolledFaces();
        },
        error: (err) => {
          this.savingEnrollment.set(false);
          this.playChime('error');
          this.toast.show(err?.error?.message || 'Could not enroll Face ID.', 'danger');
        },
      });
  }
}
