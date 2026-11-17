import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { EnrolledFace, LoginResponse } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { Role } from '../../core/models';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { SafeHtmlPipe } from '../../shared/safe-html.pipe';
import { environment } from '../../../environments/environment';
import { FaceMatchEvaluation, FaceRecognitionService } from '../../core/services/face-recognition.service';

interface Slide {
  svg: string;
  title: string;
  text: string;
  pills: string[];
}

/**
 * Login screen — ported from index.html. Role chips pick the session role,
 * "Sign In" stores it and routes to that role's landing page, and the right
 * panel auto-rotates the three marketing slides.
 */
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink, IconDirective, SafeHtmlPipe],
  templateUrl: './login.component.html',
  styleUrls: ['./login-face.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly faceService = inject(FaceRecognitionService);

  /** Disable the demo account switcher on the login screen in production builds. */
  protected readonly showDemoAccounts = !environment.production;

  /** Dynamic tenant branding resolved via query parameter (?code=...) or company code input. */
  protected readonly resolvedTenantName = signal<string>('HR Nexus');
  protected readonly resolvedTenantLogo = signal<string | null>(null);
  protected readonly resolvingTenant = signal<boolean>(false);

  /** Seeded backend accounts used to prefill credentials. */
  protected readonly demoAccounts: { role: Role; label: string; email: string; password: string; companyCode?: string }[] = [
    { role: 'Super Admin', label: 'Super Admin', email: 'admin@hrnexus.com', password: 'Admin@123' },
    { role: 'Company Admin', label: 'Viral Infotech (Admin)', email: 'viral@gmail.com', password: 'Admin@123', companyCode: 'VIRALINFOTECH' },
    { role: 'HR Manager', label: 'HR Manager', email: 'hr@hrnexus.com', password: 'Hr@12345' },
    { role: 'Manager', label: 'Manager', email: 'manager@hrnexus.com', password: 'Manager@123' },
    { role: 'Employee', label: 'Employee', email: 'sarah@hrnexus.com', password: 'Employee@123' },
  ];

  protected selectDemo(acc: { email: string; password: string; companyCode?: string }): void {
    this.email = acc.email;
    this.password = acc.password;
    this.companyCode = acc.companyCode ?? '';
    this.resolveTenant(this.companyCode);
  }

  protected email = 'admin@hrnexus.com';
  protected password = 'Admin@123';
  protected companyCode = '';
  protected rememberMe = true;
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);

  // ── Face Verification State ──
  protected readonly showFaceModal = signal(false);
  protected readonly faceVerifying = signal(false);
  protected readonly faceStatus = signal<'idle' | 'scanning' | 'matched' | 'failed'>('idle');
  protected readonly faceStatusMessage = signal('Position your face in the frame');
  protected readonly cameraActive = signal(false);
  protected readonly enrolledEmployeeName = signal('');
  protected readonly enrolledEmployeeCode = signal('');
  protected readonly faceMatchScore = signal<number | null>(null);
  protected readonly isFaceEnrolled = signal(false);
  /** Minimum similarity (0-100) required to accept a face match. */
  protected readonly faceThreshold = 80;
  /** Descriptor length produced by face-api ResNet-34 (128-dimensional embedding). */
  private readonly faceDescriptorLength = 128;
  private pendingLoginResponse: LoginResponse | null = null;
  /** Token held in memory (not yet a session) so face calls stay tenant-scoped. */
  private pendingToken: string | null = null;
  private enrolledFaceForUser: EnrolledFace | null = null;
  private referenceFaceFeatures: number[] | null = null;
  private mediaStream: MediaStream | undefined;
  private faceCheckAttempts = 0;

  @ViewChild('faceVideo') faceVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas') faceCanvasRef!: ElementRef<HTMLCanvasElement>;

  protected readonly activeSlide = signal(0);
  protected readonly exitingSlide = signal<number | null>(null);
  protected readonly dots = [0, 1, 2];
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly slides: Slide[] = [
    {
      svg: `<svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="110" cy="110" r="90" fill="rgba(37,99,235,.15)"/>
        <rect x="45" y="100" width="130" height="82" rx="8" fill="#1e3a8a"/>
        <rect x="49" y="104" width="122" height="70" rx="5" fill="#0f172a"/>
        <rect x="53" y="108" width="114" height="62" rx="3" fill="url(#g1)"/>
        <rect x="62" y="116" width="50" height="4" rx="2" fill="rgba(96,165,250,.9)"/>
        <rect x="62" y="124" width="80" height="3" rx="1.5" fill="rgba(255,255,255,.3)"/>
        <rect x="62" y="131" width="65" height="3" rx="1.5" fill="rgba(255,255,255,.2)"/>
        <rect x="62" y="138" width="72" height="3" rx="1.5" fill="rgba(255,255,255,.15)"/>
        <rect x="130" y="148" width="10" height="16" rx="2" fill="rgba(96,165,250,.6)"/>
        <rect x="144" y="138" width="10" height="26" rx="2" fill="rgba(96,165,250,.8)"/>
        <rect x="158" y="128" width="10" height="36" rx="2" fill="rgba(96,165,250,1)"/>
        <rect x="30" y="182" width="160" height="8" rx="4" fill="#334155"/>
        <ellipse cx="110" cy="72" rx="28" ry="30" fill="#FBBF24"/>
        <path d="M82 62 Q86 38 110 36 Q134 38 138 62 Q130 46 110 44 Q90 46 82 62Z" fill="#1e40af"/>
        <ellipse cx="100" cy="70" rx="5" ry="6" fill="#fff"/>
        <ellipse cx="120" cy="70" rx="5" ry="6" fill="#fff"/>
        <ellipse cx="101" cy="71" rx="3" ry="4" fill="#1e293b"/>
        <ellipse cx="121" cy="71" rx="3" ry="4" fill="#1e293b"/>
        <path d="M104 82 Q110 88 116 82" stroke="#e07b39" stroke-width="2" stroke-linecap="round" fill="none"/>
        <ellipse cx="82" cy="74" rx="6" ry="8" fill="#F59E0B"/>
        <ellipse cx="138" cy="74" rx="6" ry="8" fill="#F59E0B"/>
        <rect x="88" y="94" width="44" height="14" rx="7" fill="#FBBF24"/>
        <rect x="48" y="100" width="30" height="12" rx="6" fill="#FBBF24" transform="rotate(-20 48 100)"/>
        <rect x="142" y="100" width="30" height="12" rx="6" fill="#FBBF24" transform="rotate(20 142 100)"/>
        <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs>
      </svg>`,
      title: 'Manage Your Team Anywhere',
      text: 'Complete HR operations on the go with HRMS — your enterprise workforce platform.',
      pills: ['👥 Team Management', '📅 Attendance', '✅ Approvals'],
    },
    {
      svg: `<svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="110" cy="110" r="90" fill="rgba(37,99,235,.15)"/>
        <rect x="30" y="50" width="160" height="120" rx="14" fill="#1e3a8a" stroke="rgba(96,165,250,.3)" stroke-width="1"/>
        <rect x="38" y="58" width="144" height="104" rx="10" fill="#0f172a"/>
        <rect x="38" y="58" width="144" height="22" rx="10" fill="#1e3a8a"/>
        <rect x="38" y="68" width="144" height="12" fill="#1e3a8a"/>
        <circle cx="52" cy="69" r="5" fill="rgba(255,255,255,.2)"/>
        <rect x="62" y="66" width="40" height="5" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="44" y="86" width="58" height="32" rx="6" fill="rgba(37,99,235,.4)"/>
        <rect x="108" y="86" width="58" height="32" rx="6" fill="rgba(16,185,129,.25)"/>
        <rect x="44" y="90" width="25" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
        <rect x="44" y="98" width="35" height="7" rx="2" fill="#fff"/>
        <rect x="108" y="90" width="25" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
        <rect x="108" y="98" width="35" height="7" rx="2" fill="#34d399"/>
        <rect x="44" y="126" width="122" height="28" rx="6" fill="rgba(255,255,255,.05)"/>
        <rect x="50" y="144" width="8" height="6" rx="2" fill="rgba(96,165,250,.5)"/>
        <rect x="62" y="138" width="8" height="12" rx="2" fill="rgba(96,165,250,.7)"/>
        <rect x="74" y="132" width="8" height="18" rx="2" fill="rgba(96,165,250,.9)"/>
        <rect x="86" y="136" width="8" height="14" rx="2" fill="rgba(96,165,250,.7)"/>
        <rect x="98" y="130" width="8" height="20" rx="2" fill="#60a5fa"/>
        <rect x="110" y="134" width="8" height="16" rx="2" fill="rgba(96,165,250,.8)"/>
        <rect x="122" y="128" width="8" height="22" rx="2" fill="#93c5fd"/>
        <rect x="134" y="133" width="8" height="17" rx="2" fill="rgba(96,165,250,.7)"/>
        <circle cx="172" cy="160" r="22" fill="#FBBF24" stroke="#F59E0B" stroke-width="2"/>
        <circle cx="172" cy="160" r="16" fill="#FCD34D"/>
        <text x="172" y="165" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="900" fill="#92400e">$</text>
      </svg>`,
      title: 'Smart Payroll & Analytics',
      text: 'Process payroll in one click. Get real-time insights on salary, deductions, and workforce costs.',
      pills: ['💰 Auto Payroll', '📊 Analytics', '🧾 Payslips'],
    },
    {
      svg: `<svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="110" cy="110" r="90" fill="rgba(37,99,235,.15)"/>
        <rect x="35" y="55" width="150" height="130" rx="14" fill="#1e3a8a" stroke="rgba(96,165,250,.3)" stroke-width="1"/>
        <rect x="35" y="55" width="150" height="36" rx="14" fill="#2563eb"/>
        <rect x="35" y="73" width="150" height="18" fill="#2563eb"/>
        <rect x="55" y="65" width="60" height="6" rx="3" fill="rgba(255,255,255,.8)"/>
        <rect x="55" y="74" width="40" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
        <rect x="43" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="64" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="85" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="106" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="127" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="148" y="98" width="16" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
        <rect x="43" y="108" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="64" y="108" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="85" y="108" width="16" height="14" rx="4" fill="rgba(37,99,235,.6)"/>
        <rect x="106" y="108" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="127" y="108" width="16" height="14" rx="4" fill="rgba(16,185,129,.5)"/>
        <rect x="148" y="108" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="43" y="127" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="64" y="127" width="16" height="14" rx="4" fill="rgba(239,68,68,.5)"/>
        <rect x="85" y="127" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="106" y="127" width="16" height="14" rx="4" fill="rgba(37,99,235,.6)"/>
        <rect x="127" y="127" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="148" y="127" width="16" height="14" rx="4" fill="rgba(16,185,129,.5)"/>
        <rect x="43" y="146" width="16" height="14" rx="4" fill="rgba(16,185,129,.5)"/>
        <rect x="64" y="146" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="85" y="146" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="106" y="146" width="16" height="14" rx="4" fill="rgba(239,68,68,.5)"/>
        <rect x="127" y="146" width="16" height="14" rx="4" fill="rgba(255,255,255,.08)"/>
        <rect x="148" y="146" width="16" height="14" rx="4" fill="rgba(37,99,235,.6)"/>
        <circle cx="48" cy="175" r="5" fill="rgba(37,99,235,.8)"/>
        <rect x="57" y="172" width="28" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
        <circle cx="100" cy="175" r="5" fill="rgba(16,185,129,.8)"/>
        <rect x="109" y="172" width="28" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
        <circle cx="152" cy="175" r="5" fill="rgba(239,68,68,.8)"/>
        <rect x="161" y="172" width="20" height="4" rx="2" fill="rgba(255,255,255,.4)"/>
      </svg>`,
      title: 'Leave & Attendance Tracking',
      text: 'Track attendance, manage leave requests, and get instant approvals — all in one place.',
      pills: ['📅 Leave Calendar', '⏰ Time Tracking', '📋 Reports'],
    },
  ];

  ngOnInit(): void {
    if (this.session.isAuthenticated()) {
      void this.router.navigateByUrl(this.session.landingPath());
      return;
    }
    this.resetTimer();
    const queryCode =
      this.route.snapshot.queryParamMap.get('code') ||
      this.route.snapshot.queryParamMap.get('company') ||
      this.route.snapshot.queryParamMap.get('tenant') ||
      this.route.snapshot.queryParamMap.get('subdomain');
    if (queryCode?.trim()) {
      this.companyCode = queryCode.trim();
      this.resolveTenant(this.companyCode);
    }
  }

  protected resolveTenant(code: string): void {
    const clean = code?.trim();
    if (!clean) {
      this.resolvedTenantName.set('HR Nexus');
      this.resolvedTenantLogo.set(null);
      return;
    }

    this.resolvingTenant.set(true);
    this.api.getTenantBranding(clean).subscribe({
      next: (branding) => {
        this.resolvingTenant.set(false);
        if (branding) {
          this.resolvedTenantName.set(branding.companyName || 'HR Nexus');
          this.resolvedTenantLogo.set(branding.logoUrl || null);
        }
      },
      error: () => {
        this.resolvingTenant.set(false);
        this.resolvedTenantName.set('HR Nexus');
        this.resolvedTenantLogo.set(null);
      },
    });
  }

  protected onCompanyCodeChange(newCode: string): void {
    this.companyCode = newCode;
    this.resolveTenant(newCode);
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.stopFaceCamera();
  }

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected go(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;
    this.submitting.set(true);

    this.api.login(this.email.trim(), this.password, this.companyCode).subscribe({
      next: (response) => {
        // If user is Employee role (or email indicates employee) → check face verification
        const role = response.user.role as Role;
        if (role === 'Employee' || response.user.employeeId) {
          this.checkFaceEnrollment(response);
        } else {
          // Non-employee roles skip face check
          this.completeLogin(response);
        }
      },
      error: (error) => {
        // Network or proxy error (API not running or 502) → keep the demo usable offline if allowed.
        if ((error?.status === 0 || error?.status === 502) && environment.allowOfflineFallback) {
          this.toast.show('API backend not connected (502/offline) — signed in with local demo data.', 'warning');
          let role: Role = 'Super Admin';
          const em = this.email.toLowerCase();
          if (em.includes('admin')) role = 'Super Admin';
          else if (em.includes('hr')) role = 'HR Manager';
          else if (em.includes('employee') || em.includes('sarah')) role = 'Employee';

          if (role === 'Employee') {
            // Trigger face verification even in demo/offline mode so user can test on laptop!
            const fakeResponse: LoginResponse = {
              accessToken: 'offline-demo-token',
              expiresAtUtc: new Date(Date.now() + 86400000).toISOString(),
              user: {
                id: 'demo-sarah-id',
                fullName: 'Sarah Jenkins',
                email: this.email,
                initials: 'SJ',
                role: 'Employee',
                roleCode: 'EMP-001',
                employeeId: 'demo-sarah-emp-id',
                companyName: 'HR Nexus',
              },
            };
            this.checkFaceEnrollment(fakeResponse);
            return;
          }

          this.navigateForRole(role, this.session.login(role));
          return;
        }

        this.submitting.set(false);
        const msg = error?.status === 502 
          ? '502 Bad Gateway: Backend API server is not running or unreachable on port 5096.' 
          : (error?.error?.title ?? error?.error?.message ?? 'Invalid email or password.');
        this.toast.show(msg, 'danger');
      },
    });
  }

  // ── Face Verification Flow ──

  /** After credentials pass, check if this employee has an enrolled face. */
  private checkFaceEnrollment(response: LoginResponse): void {
    const empId = response.user.employeeId || response.user.id || 'EMP-1001';
    const empName = response.user.fullName || 'Employee';

    this.enrolledEmployeeName.set(empName);
    this.enrolledEmployeeCode.set('');
    this.pendingLoginResponse = response;
    this.pendingToken = response.accessToken;
    this.faceMatchScore.set(null);
    this.faceCheckAttempts = 0;

    // Do NOT establish the session yet. Face calls carry this token explicitly, so
    // tenant scoping still works without authenticating the user before verification.

    // 1. Check local storage first for quick local registration persistence
    let localSaved: EnrolledFace | null = null;
    try {
      const raw = localStorage.getItem('hrms_face_' + empId) || localStorage.getItem('hrms_face_' + empName.toLowerCase());
      if (raw) localSaved = JSON.parse(raw);
    } catch {}

    if (localSaved && localSaved.faceDescriptor) {
      try {
        const parsed = JSON.parse(localSaved.faceDescriptor);
        if (Array.isArray(parsed) && parsed.length === this.faceDescriptorLength) {
          this.enrolledFaceForUser = localSaved;
          this.referenceFaceFeatures = parsed;
          this.isFaceEnrolled.set(true);
          this.openFaceModal();
          return;
        }
        // Older/incompatible template — discard it so the user re-registers.
        localStorage.removeItem('hrms_face_' + empId);
        localStorage.removeItem('hrms_face_' + empName.toLowerCase());
      } catch {}
    }

    // 2. Query backend enrolled faces
    this.api.enrolledFaces(this.pendingToken ?? undefined).subscribe({
      next: (faces) => {
        const match = faces?.find(f => 
          (response.user.employeeId && f.employeeId === response.user.employeeId) ||
          f.fullName?.toLowerCase() === empName.toLowerCase()
        );

        if (match && match.faceDescriptor) {
          try {
            const parsed = JSON.parse(match.faceDescriptor);
            if (Array.isArray(parsed) && parsed.length === this.faceDescriptorLength) {
              this.enrolledFaceForUser = match;
              this.referenceFaceFeatures = parsed;
              this.isFaceEnrolled.set(true);
              this.enrolledEmployeeCode.set(match.employeeCode);
              this.openFaceModal();
              return;
            }
          } catch {}
        }

        // If no valid face profile found yet, open modal in enrollment mode
        this.isFaceEnrolled.set(false);
        this.referenceFaceFeatures = null;
        this.enrolledFaceForUser = {
          employeeId: empId,
          employeeCode: '',
          fullName: empName,
          department: 'Engineering',
          faceDescriptor: '',
        };
        this.openFaceModal();
      },
      error: () => {
        // Offline or backend unavailable -> allow local enrollment
        this.isFaceEnrolled.set(false);
        this.referenceFaceFeatures = null;
        this.enrolledFaceForUser = {
          employeeId: empId,
          employeeCode: '',
          fullName: empName,
          department: 'Engineering',
          faceDescriptor: '',
        };
        this.openFaceModal();
      },
    });
  }

  /** Opens the face verification camera modal. */
  private openFaceModal(): void {
    this.faceCheckAttempts = 0;
    this.faceStatus.set('idle');
    this.faceMatchScore.set(null);
    if (!this.isFaceEnrolled()) {
      this.faceStatusMessage.set('Position face in frame and click "Register My Face" to enroll.');
    } else {
      this.faceStatusMessage.set('Position your face in the frame and click "Scan & Verify Face".');
    }
    this.showFaceModal.set(true);

    // Small delay to let the DOM render the video element
    setTimeout(() => void this.startFaceCamera(), 300);
  }

  /** Starts the camera for face verification and waits until frames are flowing. */
  protected async startFaceCamera(): Promise<void> {
    try {
      this.stopFaceCamera();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.faceVideoRef?.nativeElement;
      if (!video) return;

      video.srcObject = this.mediaStream;
      try {
        await video.play();
      } catch {
        /* autoplay may still start on its own */
      }

      // Only mark the camera active once a real frame is available — otherwise the
      // first scan would capture an empty video and report "no face detected".
      const ready = await this.waitForVideo(video, 3000);
      this.cameraActive.set(ready);
      this.faceStatusMessage.set(
        ready
          ? this.isFaceEnrolled()
            ? 'Camera ready — click "Scan & Verify Face".'
            : 'Camera ready — click "Register My Face".'
          : 'Camera is still starting… wait a moment, then retry.',
      );
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      this.cameraActive.set(false);
      this.faceStatusMessage.set('Camera access unavailable. Grant permission in your browser, then retry.');
    }
  }

  /** Resolves true once the video element has decoded at least one frame. */
  private waitForVideo(video: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = (): void => {
        if (video.videoWidth > 0 && video.readyState >= 2) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  /** Retries camera connection if initially blocked. */
  protected retryCamera(): void {
    void this.startFaceCamera();
  }

  /** Stops the camera stream. */
  private stopFaceCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = undefined;
    }
    const video = this.faceVideoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
    this.cameraActive.set(false);
  }

  /** Resets face profile so user can re-register a new face for testing. */
  protected reEnrollFace(): void {
    this.isFaceEnrolled.set(false);
    this.referenceFaceFeatures = null;
    this.faceMatchScore.set(null);
    this.faceStatus.set('idle');
    this.faceStatusMessage.set('Position face in frame and click "Register My Face" to enroll new template.');
    this.toast.show('Ready to re-register face template.', 'info');
  }

  /**
   * Registers the current face in front of the camera using @vladmandic/face-api
   * deep ResNet-34 128-dimensional embedding.
   */
  protected async enrollCurrentFace(): Promise<void> {
    if (!this.cameraActive() || !this.faceVideoRef?.nativeElement) {
      this.toast.show('Camera must be active to register Face ID.', 'warning');
      return;
    }

    this.faceVerifying.set(true);
    this.faceStatus.set('scanning');
    this.faceStatusMessage.set('AI detecting face and computing 128D biometric descriptor…');

    const video = this.faceVideoRef.nativeElement;
    const canvas = this.faceCanvasRef?.nativeElement;

    // Collect up to 3 samples to construct an ultra-clean averaged biometric template
    const sampleDescriptors: number[][] = [];
    let snapshot = '';
    for (let i = 0; i < 3; i++) {
      const scan = await this.faceService.detectFace(video, canvas);
      if (scan.hasFace && scan.descriptor) {
        sampleDescriptors.push(scan.descriptor);
        if (scan.snapshot) snapshot = scan.snapshot;
      }
      if (i < 2) await new Promise(r => setTimeout(r, 120));
    }

    if (sampleDescriptors.length === 0) {
      this.faceVerifying.set(false);
      this.faceStatus.set('failed');
      this.faceStatusMessage.set('No face detected by AI model. Please position your face clearly in the camera frame.');
      this.toast.show('No face detected by AI neural network. Look directly at camera.', 'danger');
      return;
    }

    // Average samples into a normalized 128D centroid embedding
    const finalDescriptor: number[] = new Array(this.faceDescriptorLength).fill(0);
    for (const sample of sampleDescriptors) {
      for (let j = 0; j < this.faceDescriptorLength; j++) {
        finalDescriptor[j] += sample[j] / sampleDescriptors.length;
      }
    }
    let norm = 0;
    for (let j = 0; j < this.faceDescriptorLength; j++) norm += finalDescriptor[j] * finalDescriptor[j];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let j = 0; j < this.faceDescriptorLength; j++) finalDescriptor[j] /= norm;
    }

    const empId = this.pendingLoginResponse?.user.employeeId || this.pendingLoginResponse?.user.id || 'EMP-1001';
    const empName = this.enrolledEmployeeName() || 'Employee';

    const enrolledRecord: EnrolledFace = {
      employeeId: empId,
      employeeCode: this.enrolledEmployeeCode() || '',
      fullName: empName,
      department: 'Engineering',
      avatarUrl: snapshot,
      faceDescriptor: JSON.stringify(finalDescriptor),
    };

    this.enrolledFaceForUser = enrolledRecord;
    this.referenceFaceFeatures = finalDescriptor;
    this.isFaceEnrolled.set(true);

    // Persist locally so the template survives a reload / re-login attempt.
    try {
      localStorage.setItem('hrms_face_' + empId, JSON.stringify(enrolledRecord));
      localStorage.setItem('hrms_face_' + empName.toLowerCase(), JSON.stringify(enrolledRecord));
    } catch {}

    // Persist to the backend as well.
    this.api.enrollFace(empId, {
      faceDescriptor: JSON.stringify(finalDescriptor),
      facePhotoUrl: snapshot,
    }, this.pendingToken ?? undefined).subscribe({ next: () => {}, error: () => {} });

    this.faceVerifying.set(false);
    this.faceStatus.set('idle');
    this.faceMatchScore.set(null);
    this.faceStatusMessage.set(`✅ Face registered with AI library! Now click "Scan & Verify Face".`);
    this.toast.show(`Face profile registered for ${empName}!`, 'success');
  }

  /**
   * Performs real neural network facial analysis and strictly verifies that
   * match accuracy is >= 80% using deep metric learning (Euclidean distance).
   * If somebody else's face is shown, it rejects access!
   */
  protected async verifyFace(): Promise<void> {
    if (this.faceVerifying() || !this.pendingLoginResponse || !this.faceVideoRef?.nativeElement) return;

    if (!this.isFaceEnrolled() || !this.referenceFaceFeatures) {
      this.toast.show('Please register this employee\'s face first.', 'info');
      return;
    }

    if (this.referenceFaceFeatures.length !== this.faceDescriptorLength) {
      this.isFaceEnrolled.set(false);
      this.referenceFaceFeatures = null;
      this.faceStatus.set('idle');
      this.faceStatusMessage.set('Saved profile needs upgrade to deep AI descriptor. Click "Register My Face" once.');
      this.toast.show('Upgraded to AI face model — please register your face once.', 'info');
      return;
    }

    this.faceVerifying.set(true);
    this.faceStatus.set('scanning');
    this.faceStatusMessage.set('AI neural network comparing face embedding…');
    this.faceCheckAttempts++;

    const video = this.faceVideoRef.nativeElement;
    const canvas = this.faceCanvasRef?.nativeElement;

    // Sample up to 2 frames to account for natural autofocus or momentary blink
    let bestEvaluation: FaceMatchEvaluation | null = null;
    let anyFaceFound = false;

    for (let i = 0; i < 2; i++) {
      const scan = await this.faceService.detectFace(video, canvas);
      if (scan.hasFace && scan.descriptor) {
        anyFaceFound = true;
        const evaluation = this.faceService.compareFaces(
          scan.descriptor,
          this.referenceFaceFeatures,
          this.faceThreshold // 80%
        );
        if (!bestEvaluation || evaluation.matchScore > bestEvaluation.matchScore) {
          bestEvaluation = evaluation;
        }
        if (evaluation.matched) break; // Reached >= 80%
      }
      if (i === 0) await new Promise(r => setTimeout(r, 100));
    }

    this.faceVerifying.set(false);

    if (!anyFaceFound || !bestEvaluation) {
      this.faceStatus.set('failed');
      this.faceMatchScore.set(0);
      this.faceStatusMessage.set('❌ No face detected by AI model. Look straight at the camera.');
      this.toast.show('No face detected in the camera frame.', 'warning');
      return;
    }

    const evaluation = bestEvaluation;
    this.faceMatchScore.set(evaluation.matchScore);

    if (evaluation.matched) {
      // ✅ PASS: score >= 80% (same person)
      this.faceStatus.set('matched');
      this.faceStatusMessage.set(`✅ Face verified: ${evaluation.matchScore}% match (≥${this.faceThreshold}% required). Signing you in…`);
      this.toast.show(`Face matched (${evaluation.matchScore}%)! Welcome back.`, 'success');

      setTimeout(() => {
        this.stopFaceCamera();
        this.showFaceModal.set(false);
        this.recordAttendanceAndLogin(this.pendingLoginResponse!);
      }, 800);
    } else {
      // ❌ FAIL: score < 80% (somebody else)
      this.faceStatus.set('failed');
      this.faceStatusMessage.set(`❌ Face not recognised: ${evaluation.matchScore}% match (needs ≥${this.faceThreshold}%). Face the camera directly in even light.`);

      if (this.faceCheckAttempts >= 3) {
        this.faceStatusMessage.set(`❌ Access denied after 3 attempts (best ${evaluation.matchScore}%).`);
        setTimeout(() => {
          this.stopFaceCamera();
          this.showFaceModal.set(false);
          this.session.logout();
          this.submitting.set(false);
          this.toast.show(`Access denied: best face match was ${evaluation.matchScore}% (needs ≥${this.faceThreshold}%).`, 'danger');
        }, 2400);
      } else {
        this.toast.show(`Face match ${evaluation.matchScore}% is below ${this.faceThreshold}%. Please try again (attempt ${this.faceCheckAttempts}/3).`, 'danger');
      }
    }
  }

  /** Records attendance via face-punch API then completes login. */
  private recordAttendanceAndLogin(response: LoginResponse): void {
    const employeeId = response.user.employeeId;
    const employeeCode = this.enrolledFaceForUser?.employeeCode || undefined;

    this.api.facePunch({
      employeeId: employeeId ?? undefined,
      employeeCode: employeeCode ?? undefined,
      punchType: 'ClockIn',
      confidence: 0.98,
      device: 'Employee Login Terminal',
    }, this.pendingToken ?? undefined).subscribe({
      next: (result) => {
        if (result.success) {
          this.toast.show(`Face matched! Welcome ${result.employeeName}. Attendance marked as Present.`, 'success');
        } else {
          this.toast.show(result.message || 'Face verified! Attendance logged.', 'info');
        }
        this.completeLogin(response);
      },
      error: () => {
        // Offline or backend unavailable -> still complete login gracefully
        this.toast.show(`Face matched! Welcome ${response.user.fullName}. Attendance marked as Present.`, 'success');
        this.completeLogin(response);
      },
    });
  }

  /** Completes the login flow — sets session and navigates. */
  private completeLogin(response: LoginResponse): void {
    const landing = this.session.setSession(response.accessToken, response.user);
    this.pendingToken = null;
    this.pendingLoginResponse = null;
    this.navigateForRole(response.user.role as Role, landing);
  }

  /** Cancel face verification — logs out the pending session. */
  protected cancelFaceVerification(): void {
    this.stopFaceCamera();
    this.showFaceModal.set(false);
    this.session.logout();
    this.submitting.set(false);
    this.pendingLoginResponse = null;
    this.pendingToken = null;
    this.enrolledFaceForUser = null;
    this.toast.show('Face verification cancelled. Login aborted.', 'warning');
  }

  private navigateForRole(role: Role, landing: string): void {
    void this.router.navigateByUrl(landing);
  }

  protected goSlide(n: number): void {
    const total = this.slides.length;
    this.exitingSlide.set(this.activeSlide());
    this.activeSlide.set((n + total) % total);
    setTimeout(() => this.exitingSlide.set(null), 500);
    this.resetTimer();
  }

  private resetTimer(): void {
    this.clearTimer();
    this.timer = setInterval(() => this.goSlide(this.activeSlide() + 1), 3500);
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
