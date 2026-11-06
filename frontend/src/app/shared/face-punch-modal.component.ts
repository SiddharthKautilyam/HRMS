import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api/api.service';
import { EnrolledFace } from '../core/api/api.models';
import { IconDirective } from '../core/icons/icon.directive';
import { FaceMatchEvaluation, FaceRecognitionService } from '../core/services/face-recognition.service';
import { PunchService } from '../core/services/punch.service';
import { SessionService } from '../core/services/session.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-face-punch-modal',
  standalone: true,
  imports: [CommonModule, IconDirective],
  template: `
    <div class="face-modal-backdrop" (click)="onBackdropClick($event)">
      <div class="face-modal-card" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div
          class="face-modal-header"
          [class.clock-out]="action() === 'ClockOut'"
          [class.start-break]="action() === 'StartBreak'"
          [class.end-break]="action() === 'EndBreak'"
        >
          <div
            class="face-header-icon"
            [class.clock-out]="action() === 'ClockOut'"
            [class.start-break]="action() === 'StartBreak'"
            [class.end-break]="action() === 'EndBreak'"
          >
            @if (action() === 'ClockIn') {
              <span [appIcon]="'clock'"></span>
            } @else if (action() === 'ClockOut') {
              <span [appIcon]="'x'"></span>
            } @else if (action() === 'StartBreak') {
              <span [appIcon]="'clock'"></span>
            } @else {
              <span [appIcon]="'check'"></span>
            }
          </div>
          <div class="face-header-info">
            <h3 class="face-header-title">
              @if (action() === 'ClockIn') {
                🟢 Biometric Face Clock In
              } @else if (action() === 'ClockOut') {
                🔴 Biometric Face Clock Out
              } @else if (action() === 'StartBreak') {
                ☕ Biometric Face Break Start
              } @else {
                ⚡ Biometric Face Break End
              }
            </h3>
            <div class="face-header-sub">
              <span>{{ employeeName() }}</span>
              <span class="emp-badge">{{ employeeCode() }}</span>
              <span class="role-badge">
                @if (action() === 'ClockIn') { Shift Start }
                @else if (action() === 'ClockOut') { Shift End }
                @else if (action() === 'StartBreak') { Pause Shift }
                @else { Resume Shift }
              </span>
            </div>
          </div>
          <button class="face-close-btn" (click)="closeModal()" aria-label="Close modal">
            <span [appIcon]="'x'"></span>
          </button>
        </div>

        <!-- Camera HUD Viewport -->
        <div class="face-viewport-wrap">
          <div class="face-viewport">
            <video
              #faceVideo
              class="face-video"
              playsinline
              muted
              autoplay
              [class.active]="cameraActive()"
            ></video>
            <canvas #faceCanvas class="face-canvas"></canvas>

            <!-- Loading overlay when camera/models are starting -->
            @if (!cameraActive() || faceService.loadingModels()) {
              <div class="face-camera-loading">
                <div class="face-spinner"></div>
                <div class="face-loading-text">
                  {{ faceService.loadingModels() ? 'Loading AI Neural Network…' : 'Initializing camera stream…' }}
                </div>
                <div class="face-loading-sub">Position your face in front of the webcam</div>
              </div>
            }

            <!-- HUD Reticle Overlay -->
            <div
              class="face-hud-reticle"
              [class.scanning]="faceStatus() === 'scanning'"
              [class.matched]="faceStatus() === 'matched'"
              [class.failed]="faceStatus() === 'failed'"
            >
              <div class="reticle-corner tl"></div>
              <div class="reticle-corner tr"></div>
              <div class="reticle-corner bl"></div>
              <div class="reticle-corner br"></div>
              <div class="reticle-laser" [class.active]="faceStatus() === 'scanning'"></div>
              <div class="reticle-center-cross"></div>
            </div>

            <!-- Floating Status Tag -->
            <div
              class="face-floating-tag"
              [class.tag-matched]="faceStatus() === 'matched'"
              [class.tag-failed]="faceStatus() === 'failed'"
            >
              @if (faceStatus() === 'scanning') {
                <span class="tag-pulse"></span> Analyzing Biometrics…
              } @else if (faceStatus() === 'matched') {
                ✅ Face Verified: {{ faceMatchScore() }}% Match (≥80%)
              } @else if (faceStatus() === 'failed') {
                ❌ Face Mismatch: {{ faceMatchScore() ?? 0 }}% (&lt;80%)
              } @else {
                Face Recognition HUD Active
              }
            </div>
          </div>
        </div>

        <!-- Biometric Match Score Meter -->
        @if (faceMatchScore() !== null) {
          <div class="face-score-card">
            <div class="score-header">
              <span class="score-label">Biometric Match Confidence</span>
              <span
                class="score-number"
                [class.score-pass]="(faceMatchScore() ?? 0) >= 80"
                [class.score-fail]="(faceMatchScore() ?? 0) < 80"
              >
                {{ faceMatchScore() }}%
              </span>
            </div>
            <div class="score-track">
              <div
                class="score-fill"
                [style.width.%]="faceMatchScore()"
                [class.fill-pass]="(faceMatchScore() ?? 0) >= 80"
                [class.fill-fail]="(faceMatchScore() ?? 0) < 80"
              ></div>
              <div class="score-marker" title="Required Threshold: 80%">
                <span class="marker-text">80% Req</span>
              </div>
            </div>
          </div>
        }

        <!-- Status Message Banner -->
        <div class="face-status-banner" [class.success]="faceStatus() === 'matched'" [class.error]="faceStatus() === 'failed'">
          <div class="status-icon">
            @if (faceStatus() === 'matched') {
              <span [appIcon]="'check'"></span>
            } @else if (faceStatus() === 'failed') {
              <span [appIcon]="'x'"></span>
            } @else {
              <span [appIcon]="'shield'"></span>
            }
          </div>
          <div class="status-text">{{ statusMessage() }}</div>
        </div>

        <!-- Action Footer -->
        <div class="face-modal-footer">
          <div class="footer-note">
            <span [appIcon]="'shield'"></span>
            <span>Security Rule: Must match <strong>≥ 80%</strong> to log attendance &amp; working hours.</span>
          </div>

          <div class="face-buttons-row">
            @if (!isFaceEnrolled()) {
              <button
                type="button"
                class="btn-enroll"
                [disabled]="faceVerifying() || !cameraActive()"
                (click)="enrollCurrentFace()"
              >
                📸 Register Face for {{ employeeName() }}
              </button>
            } @else {
              <button
                type="button"
                class="btn-verify"
                [class.clock-out-btn]="action() === 'ClockOut'"
                [class.start-break-btn]="action() === 'StartBreak'"
                [class.end-break-btn]="action() === 'EndBreak'"
                [disabled]="faceVerifying() || !cameraActive()"
                (click)="verifyFaceAndPunch()"
              >
                @if (faceVerifying()) {
                  <span class="spinner-sm"></span> Verifying Face Biometrics…
                } @else {
                  <span [appIcon]="action() === 'ClockOut' ? 'x' : (action() === 'StartBreak' ? 'clock' : 'check')"></span>
                  @if (action() === 'ClockIn') { Verify Face &amp; Clock In }
                  @else if (action() === 'ClockOut') { Verify Face &amp; Clock Out }
                  @else if (action() === 'StartBreak') { Verify Face &amp; Start Break }
                  @else { Verify Face &amp; End Break }
                }
              </button>

              <button
                type="button"
                class="btn-re-enroll"
                title="Re-register face biometric template"
                [disabled]="faceVerifying()"
                (click)="reEnrollFace()"
              >
                🔄 Re-enroll
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .face-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(8, 12, 24, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      padding: 16px;
      animation: faceFadeIn 0.25s ease-out;
    }

    @keyframes faceFadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    .face-modal-card {
      width: 100%;
      max-width: 490px;
      background: #0f172a;
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 20px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(37, 99, 235, 0.15);
      overflow: hidden;
      color: #f8fafc;
      font-family: inherit;
      display: flex;
      flex-direction: column;
    }

    .face-modal-header {
      padding: 18px 22px 14px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, transparent 100%);
    }

    .face-modal-header.clock-out {
      background: linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, transparent 100%);
    }

    .face-modal-header.start-break {
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.18) 0%, transparent 100%);
    }

    .face-modal-header.end-break {
      background: linear-gradient(180deg, rgba(6, 182, 212, 0.18) 0%, transparent 100%);
    }

    .face-header-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.18);
      border: 1px solid rgba(16, 185, 129, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #34d399;
      flex-shrink: 0;
    }

    .face-header-icon.clock-out {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.4);
      color: #f87171;
    }

    .face-header-icon.start-break {
      background: rgba(245, 158, 11, 0.18);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }

    .face-header-icon.end-break {
      background: rgba(6, 182, 212, 0.18);
      border-color: rgba(6, 182, 212, 0.4);
      color: #38bdf8;
    }

    .face-header-info { flex: 1; min-width: 0; }
    .face-header-title { font-size: 16px; font-weight: 800; color: #ffffff; margin: 0; }
    .face-header-sub { font-size: 12px; color: #94a3b8; margin-top: 3px; display: flex; align-items: center; gap: 6px; }

    .emp-badge { padding: 1px 7px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border-radius: 4px; font-weight: 600; font-size: 11px; }
    .role-badge { padding: 1px 7px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border-radius: 4px; font-weight: 500; font-size: 11px; }

    .face-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .face-close-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

    .face-viewport-wrap { padding: 16px 20px 10px; background: #0b1120; }
    .face-viewport {
      position: relative;
      width: 100%;
      height: 290px;
      border-radius: 14px;
      overflow: hidden;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .face-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block; }
    .face-canvas { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; z-index: 2; }

    .face-camera-loading {
      position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column;
      align-items: center; justify-content: center; background: rgba(2, 6, 23, 0.94); gap: 10px;
    }
    .face-spinner { width: 36px; height: 36px; border: 3px solid rgba(59, 130, 246, 0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .face-loading-text { font-size: 13px; font-weight: 600; color: #e2e8f0; }
    .face-loading-sub { font-size: 11px; color: #64748b; }

    .face-hud-reticle {
      position: absolute; top: 12%; left: 20%; right: 20%; bottom: 18%;
      border: 1.5px dashed rgba(59, 130, 246, 0.5); border-radius: 24px;
      pointer-events: none; z-index: 3; transition: all 0.3s ease;
    }
    .face-hud-reticle.scanning { border-color: #60a5fa; box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
    .face-hud-reticle.matched { border-color: #10b981; border-style: solid; box-shadow: 0 0 25px rgba(16, 185, 129, 0.6); }
    .face-hud-reticle.failed { border-color: #ef4444; border-style: solid; box-shadow: 0 0 25px rgba(239, 68, 68, 0.6); }

    .reticle-corner { position: absolute; width: 14px; height: 14px; border: 2.5px solid #60a5fa; }
    .reticle-corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; border-top-left-radius: 8px; }
    .reticle-corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; border-top-right-radius: 8px; }
    .reticle-corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; border-bottom-left-radius: 8px; }
    .reticle-corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; border-bottom-right-radius: 8px; }

    .reticle-laser {
      position: absolute; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, #38bdf8 30%, #ffffff 50%, #38bdf8 70%, transparent);
      box-shadow: 0 0 12px #38bdf8; opacity: 0;
    }
    .reticle-laser.active { opacity: 1; animation: laserSweep 1.5s ease-in-out infinite alternate; }
    @keyframes laserSweep { 0% { top: 5%; } 100% { top: 92%; } }

    .face-floating-tag {
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      padding: 5px 14px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px;
      font-size: 11px; font-weight: 600; color: #94a3b8; z-index: 4; white-space: nowrap;
    }
    .face-floating-tag.tag-matched { background: rgba(6, 78, 59, 0.9); border-color: #10b981; color: #a7f3d0; }
    .face-floating-tag.tag-failed { background: rgba(127, 29, 29, 0.9); border-color: #ef4444; color: #fecaca; }

    .face-score-card { padding: 10px 20px 6px; background: #0f172a; }
    .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .score-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700; }
    .score-number { font-size: 16px; font-weight: 800; color: #e2e8f0; }
    .score-number.score-pass { color: #34d399; text-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
    .score-number.score-fail { color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.4); }

    .score-track { position: relative; height: 10px; background: rgba(255, 255, 255, 0.08); border-radius: 5px; overflow: visible; }
    .score-fill { height: 100%; border-radius: 5px; background: #3b82f6; transition: width 0.4s ease; }
    .score-fill.fill-pass { background: linear-gradient(90deg, #10b981, #34d399); box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); }
    .score-fill.fill-fail { background: linear-gradient(90deg, #ef4444, #f87171); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }

    .score-marker {
      position: absolute; top: -5px; bottom: -5px; left: 80%; width: 2px;
      background: #fbbf24; box-shadow: 0 0 8px #fbbf24; z-index: 5;
    }
    .marker-text {
      position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
      font-size: 9px; font-weight: 800; color: #fbbf24; white-space: nowrap;
    }

    .face-status-banner {
      margin: 10px 20px; padding: 10px 14px; border-radius: 10px;
      background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; gap: 10px; font-size: 12px; color: #cbd5e1;
    }
    .face-status-banner.success { background: rgba(6, 78, 59, 0.35); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7; }
    .face-status-banner.error { background: rgba(127, 29, 29, 0.35); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; }

    .face-modal-footer { padding: 14px 20px 18px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1120; }
    .footer-note { font-size: 11px; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }

    .face-buttons-row { display: flex; gap: 10px; }
    .btn-verify {
      flex: 1; padding: 12px 18px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35); transition: all 0.2s;
    }
    .btn-verify.clock-out-btn {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.35);
    }
    .btn-verify.start-break-btn {
      background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
    }
    .btn-verify.end-break-btn {
      background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
      box-shadow: 0 4px 15px rgba(6, 182, 212, 0.35);
    }
    .btn-verify:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
    .btn-verify:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-enroll {
      flex: 1; padding: 12px 18px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
    }

    .btn-re-enroll {
      padding: 0 14px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px;
      background: rgba(255, 255, 255, 0.05); color: #94a3b8; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-re-enroll:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

    .spinner-sm {
      width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
  `],
})
export class FacePunchModalComponent implements OnInit, OnDestroy {
  protected readonly punch = inject(PunchService);
  protected readonly session = inject(SessionService);
  protected readonly faceService = inject(FaceRecognitionService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @ViewChild('faceVideo') private faceVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas') private faceCanvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly action = computed(() => this.punch.faceAction());
  protected readonly actionLabel = computed(() => {
    switch (this.action()) {
      case 'ClockIn': return 'Clock In';
      case 'ClockOut': return 'Clock Out';
      case 'StartBreak': return 'Start Break';
      case 'EndBreak': return 'End Break';
    }
  });
  protected readonly employeeName = computed(() => this.session.user()?.name || 'Sarah Jenkins');
  protected readonly employeeCode = computed(() => this.session.user()?.employeeId || 'EMP-001');

  protected readonly cameraActive = signal(false);
  protected readonly isFaceEnrolled = signal(false);
  protected readonly faceVerifying = signal(false);
  protected readonly faceStatus = signal<'idle' | 'scanning' | 'matched' | 'failed'>('idle');
  protected readonly faceMatchScore = signal<number | null>(null);
  protected readonly statusMessage = signal('Initializing face detection AI neural network…');

  private mediaStream?: MediaStream;
  private referenceFaceFeatures: number[] | null = null;
  private readonly faceThreshold = 80; // Strict 80% accuracy rule

  ngOnInit(): void {
    void this.initializeProfile();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (this.faceVerifying()) return;
    this.closeModal();
  }

  protected closeModal(): void {
    this.stopCamera();
    this.punch.closeFaceModal();
  }

  private async initializeProfile(): Promise<void> {
    const empId = this.employeeCode();
    const empName = this.employeeName();

    // Check localStorage first
    const local = localStorage.getItem('hrms_face_' + empId) || localStorage.getItem('hrms_face_' + empName.toLowerCase());
    if (local) {
      try {
        const parsed: EnrolledFace = JSON.parse(local);
        if (parsed.faceDescriptor) {
          const arr = JSON.parse(parsed.faceDescriptor);
          if (Array.isArray(arr) && arr.length === 128) {
            this.referenceFaceFeatures = arr;
            this.isFaceEnrolled.set(true);
            this.statusMessage.set(`Ready for ${this.actionLabel()}. Face the camera and click Verify.`);
            setTimeout(() => void this.startCamera(), 200);
            return;
          }
        }
      } catch {}
    }

    // Try backend enrolled faces
    this.api.enrolledFaces().subscribe({
      next: (faces) => {
        const match = faces.find(
          (f) => f.employeeId === empId || f.fullName?.toLowerCase() === empName.toLowerCase()
        );
        if (match && match.faceDescriptor) {
          try {
            const arr = JSON.parse(match.faceDescriptor);
            if (Array.isArray(arr) && arr.length === 128) {
              this.referenceFaceFeatures = arr;
              this.isFaceEnrolled.set(true);
              this.statusMessage.set(`Ready for ${this.actionLabel()}. Face the camera and click Verify.`);
              setTimeout(() => void this.startCamera(), 200);
              return;
            }
          } catch {}
        }

        // If not enrolled yet, prompt registration
        this.isFaceEnrolled.set(false);
        this.statusMessage.set(`No registered Face ID found for ${empName}. Click "Register Face" below to enroll.`);
        setTimeout(() => void this.startCamera(), 200);
      },
      error: () => {
        this.isFaceEnrolled.set(false);
        this.statusMessage.set(`No registered Face ID found for ${empName}. Click "Register Face" below to enroll.`);
        setTimeout(() => void this.startCamera(), 200);
      },
    });
  }

  private async startCamera(): Promise<void> {
    try {
      this.stopCamera();
      await this.faceService.loadModels();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.faceVideoRef?.nativeElement;
      if (!video) return;

      video.srcObject = this.mediaStream;
      try {
        await video.play();
      } catch {}

      this.cameraActive.set(true);
      if (this.isFaceEnrolled()) {
        this.statusMessage.set('Camera stream live. Center face and click Verify Face.');
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err);
      this.cameraActive.set(false);
      this.statusMessage.set('Camera access blocked. Please allow webcam permissions in your browser.');
    }
  }

  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = undefined;
    }
    const video = this.faceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
    this.cameraActive.set(false);
  }

  protected reEnrollFace(): void {
    this.isFaceEnrolled.set(false);
    this.referenceFaceFeatures = null;
    this.faceMatchScore.set(null);
    this.faceStatus.set('idle');
    this.statusMessage.set('Position face in reticle and click "Register Face" to capture a clean 128D template.');
    this.toast.show('Ready to re-register face template.', 'info');
  }

  protected async enrollCurrentFace(): Promise<void> {
    if (!this.cameraActive() || !this.faceVideoRef?.nativeElement) return;

    this.faceVerifying.set(true);
    this.faceStatus.set('scanning');
    this.statusMessage.set('AI scanning face and extracting 128D deep neural embedding…');

    const video = this.faceVideoRef.nativeElement;
    const canvas = this.faceCanvasRef?.nativeElement;

    // Collect 3 samples for centroid
    const samples: number[][] = [];
    let snapshot = '';
    for (let i = 0; i < 3; i++) {
      const scan = await this.faceService.detectFace(video, canvas);
      if (scan.hasFace && scan.descriptor) {
        samples.push(scan.descriptor);
        if (scan.snapshot) snapshot = scan.snapshot;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 120));
    }

    if (samples.length === 0) {
      this.faceVerifying.set(false);
      this.faceStatus.set('failed');
      this.statusMessage.set('No face detected by AI model. Look directly into the camera.');
      this.toast.show('No face detected. Please face the camera.', 'danger');
      return;
    }

    const finalDescriptor = new Array(128).fill(0);
    for (const s of samples) {
      for (let j = 0; j < 128; j++) finalDescriptor[j] += s[j] / samples.length;
    }
    let norm = 0;
    for (let j = 0; j < 128; j++) norm += finalDescriptor[j] * finalDescriptor[j];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let j = 0; j < 128; j++) finalDescriptor[j] /= norm;
    }

    const empId = this.employeeCode();
    const empName = this.employeeName();

    const record: EnrolledFace = {
      employeeId: empId,
      employeeCode: empId,
      fullName: empName,
      department: 'Engineering',
      avatarUrl: snapshot,
      faceDescriptor: JSON.stringify(finalDescriptor),
    };

    this.referenceFaceFeatures = finalDescriptor;
    this.isFaceEnrolled.set(true);

    try {
      localStorage.setItem('hrms_face_' + empId, JSON.stringify(record));
      localStorage.setItem('hrms_face_' + empName.toLowerCase(), JSON.stringify(record));
    } catch {}

    this.api.enrollFace(empId, {
      faceDescriptor: JSON.stringify(finalDescriptor),
      facePhotoUrl: snapshot,
    }).subscribe({ next: () => {}, error: () => {} });

    this.faceVerifying.set(false);
    this.faceStatus.set('idle');
    this.faceMatchScore.set(null);
    this.statusMessage.set(`✅ Face enrolled! Now click Verify Face & ${this.actionLabel()}.`);
    this.toast.show(`Face profile registered for ${empName}!`, 'success');
  }

  protected async verifyFaceAndPunch(): Promise<void> {
    if (this.faceVerifying() || !this.faceVideoRef?.nativeElement || !this.referenceFaceFeatures) return;

    this.faceVerifying.set(true);
    this.faceStatus.set('scanning');
    this.statusMessage.set('AI comparing biometric face vector against enrolled template…');

    const video = this.faceVideoRef.nativeElement;
    const canvas = this.faceCanvasRef?.nativeElement;

    let bestEvaluation: FaceMatchEvaluation | null = null;
    let faceDetected = false;

    for (let i = 0; i < 2; i++) {
      const scan = await this.faceService.detectFace(video, canvas);
      if (scan.hasFace && scan.descriptor) {
        faceDetected = true;
        const evaluation = this.faceService.compareFaces(
          scan.descriptor,
          this.referenceFaceFeatures,
          this.faceThreshold
        );
        if (!bestEvaluation || evaluation.matchScore > bestEvaluation.matchScore) {
          bestEvaluation = evaluation;
        }
        if (evaluation.matched) break;
      }
      if (i === 0) await new Promise((r) => setTimeout(r, 100));
    }

    this.faceVerifying.set(false);

    if (!faceDetected || !bestEvaluation) {
      this.faceStatus.set('failed');
      this.faceMatchScore.set(0);
      this.statusMessage.set('❌ No face detected by AI model. Look straight at the camera.');
      this.toast.show('No face detected in camera frame.', 'warning');
      return;
    }

    const evaluation = bestEvaluation;
    this.faceMatchScore.set(evaluation.matchScore);

    if (evaluation.matched) {
      // ✅ SUCCESS: Score >= 80%
      this.faceStatus.set('matched');
      const isClockIn = this.action() === 'ClockIn';

      if (this.action() === 'ClockIn') {
        this.statusMessage.set(`✅ Face Verified: ${evaluation.matchScore}% Match! Clocking you in…`);
        this.punch.clockIn();
        this.toast.show(`Face Verified (${evaluation.matchScore}%) — Clock In recorded! Shift timer started.`, 'success');
      } else if (this.action() === 'ClockOut') {
        this.statusMessage.set(`✅ Face Verified: ${evaluation.matchScore}% Match! Clocking you out…`);
        const hoursWorked = this.punch.workTime();
        this.punch.clockOut();
        this.toast.show(`Face Verified (${evaluation.matchScore}%) — Clock Out recorded! Total shift: ${hoursWorked}.`, 'success');
      } else if (this.action() === 'StartBreak') {
        this.statusMessage.set(`✅ Face Verified: ${evaluation.matchScore}% Match! Starting break…`);
        this.punch.startBreak();
        this.toast.show(`Face Verified (${evaluation.matchScore}%) — Break Started. Shift timer paused.`, 'warning');
      } else if (this.action() === 'EndBreak') {
        this.statusMessage.set(`✅ Face Verified: ${evaluation.matchScore}% Match! Ending break and resuming shift…`);
        this.punch.endBreak();
        this.toast.show(`Face Verified (${evaluation.matchScore}%) — Break Ended. Shift resumed!`, 'success');
      }

      setTimeout(() => {
        this.closeModal();
      }, 850);
    } else {
      // ❌ FAILED: Score < 80% (somebody else)
      this.faceStatus.set('failed');
      this.statusMessage.set(
        `❌ Face Mismatch: ${evaluation.matchScore}% (Must be ≥ ${this.faceThreshold}%). Somebody else's face detected! Clocking denied.`
      );
      this.toast.show(
        `Biometric mismatch (${evaluation.matchScore}% < ${this.faceThreshold}%). You cannot clock in/out for another employee!`,
        'danger'
      );
    }
  }
}
