import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { EnrolledFace } from '../../core/api/api.models';
import { IconDirective } from '../../core/icons/icon.directive';
import { FaceRecognitionService } from '../../core/services/face-recognition.service';
import { ToastService } from '../../core/services/toast.service';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { KeyGroupSelectComponent } from '../../shared/key-select.component';

/**
 * First-run welcome onboarding — ported from pages/emp-onboarding.html.
 * Standalone (rendered without the app shell) 3-step wizard. The original used
 * EmailJS with placeholder credentials; here the "send email" step is simulated
 * and the same success screen + 5s redirect is preserved.
 */
@Component({
  selector: 'app-emp-onboarding',
  imports: [CommonModule, IconDirective, KeyGroupSelectComponent],
  template: `
    <div class="ob-page">
      <div class="ob-card">
        <!-- Header -->
        <div class="ob-header">
          <div class="ob-header-inner">
            <div class="ob-logo">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1>Welcome to HRNexus! 🎉</h1>
            <p>Complete your profile in 3 quick steps to get started</p>
          </div>
        </div>

        <!-- Stepper -->
        <div class="ob-stepper">
          @for (label of stepLabels; track label; let i = $index) {
            <div class="ob-step" [class.done]="i < step()" [class.active]="i === step()">
              <div class="ob-circle">
                @if (i < step()) {
                  <span [appIcon]="'check'"></span>
                } @else {
                  {{ i + 1 }}
                }
              </div>
              <div class="ob-label">{{ label }}</div>
            </div>
          }
        </div>

        <!-- Body -->
        <div class="ob-body">
          @if (phase() === 'form') {
            <div class="ob-step-title">{{ stepTitles[step()] }}</div>

            <!-- STEP 0: PERSONAL -->
            @if (step() === 0) {
              <div class="ob-grid ob-grid-3">
                <div>
                  <label class="form-label">First Name<span class="req">*</span></label>
                  <input class="form-control" placeholder="John" [class.invalid]="isInvalid('firstName')" [value]="personal().firstName" (input)="patchP('firstName', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Middle Name</label>
                  <input class="form-control" placeholder="Michael" [value]="personal().middleName" (input)="patchP('middleName', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Last Name<span class="req">*</span></label>
                  <input class="form-control" placeholder="Doe" [class.invalid]="isInvalid('lastName')" [value]="personal().lastName" (input)="patchP('lastName', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Email Address<span class="req">*</span></label>
                  <input class="form-control" type="email" placeholder="john@company.com" [class.invalid]="isInvalid('email')" [value]="personal().email" (input)="patchP('email', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Phone Number<span class="req">*</span></label>
                  <input class="form-control" type="tel" placeholder="+971 50 123 4567" [class.invalid]="isInvalid('phone')" [value]="personal().phone" (input)="patchP('phone', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Date of Birth</label>
                  <input class="form-control" type="date" [value]="personal().dob" (input)="patchP('dob', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Gender</label>
                  <app-key-select groupCode="GENDER" [value]="personal().gender" (valueChange)="patchP('gender', $event)" width="100%" />
                </div>
                <div>
                  <label class="form-label">Marital Status</label>
                  <app-key-select groupCode="MARITAL_STATUS" [value]="personal().maritalStatus" (valueChange)="patchP('maritalStatus', $event)" width="100%" />
                </div>
                <div>
                  <label class="form-label">Blood Group</label>
                  <app-key-select groupCode="BLOOD_GROUP" [value]="personal().bloodGroup" (valueChange)="patchP('bloodGroup', $event)" width="100%" />
                </div>
                <div>
                  <label class="form-label">City</label>
                  <input class="form-control" placeholder="Dubai" [value]="personal().city" (input)="patchP('city', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">State</label>
                  <input class="form-control" placeholder="Dubai" [value]="personal().state" (input)="patchP('state', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Country</label>
                  <input class="form-control" placeholder="UAE" [value]="personal().country" (input)="patchP('country', $any($event.target).value)" />
                </div>
                <div style="grid-column: 1/-1">
                  <label class="form-label">Address</label>
                  <input class="form-control" placeholder="Apt 4B, Marina Tower, Dubai" [value]="personal().address" (input)="patchP('address', $any($event.target).value)" />
                </div>
              </div>
            }

            <!-- STEP 1: BANK -->
            @if (step() === 1) {
              <div class="ob-grid ob-grid-2">
                <div>
                  <label class="form-label">Bank Name<span class="req">*</span></label>
                  <input class="form-control" placeholder="Emirates NBD" [class.invalid]="isInvalid('bankName')" [value]="bank().bankName" (input)="patchB('bankName', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Account Holder Name<span class="req">*</span></label>
                  <input class="form-control" placeholder="John Doe" [class.invalid]="isInvalid('accountName')" [value]="bank().accountName" (input)="patchB('accountName', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Account Number<span class="req">*</span></label>
                  <input class="form-control" placeholder="1234567890" [class.invalid]="isInvalid('accountNumber')" [value]="bank().accountNumber" (input)="patchB('accountNumber', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">IBAN</label>
                  <input class="form-control" placeholder="AE07 0331 2345 6789 0123 456" [value]="bank().iban" (input)="patchB('iban', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Swift Code</label>
                  <input class="form-control" placeholder="EBILAEAD" [value]="bank().swift" (input)="patchB('swift', $any($event.target).value)" />
                </div>
                <div>
                  <label class="form-label">Branch</label>
                  <input class="form-control" placeholder="Dubai Marina" [value]="bank().branch" (input)="patchB('branch', $any($event.target).value)" />
                </div>
              </div>
            }

            <!-- STEP 2: DOCUMENTS -->
            @if (step() === 2) {
              <p style="margin-bottom: 16px; font-size: 0.84rem; color: var(--muted)">
                Upload your identity and legal documents. You can also do this later from your profile.
              </p>
              <div class="ob-grid ob-grid-3">
                @for (doc of docSlots; track doc.key) {
                  <div>
                    <label class="form-label">{{ doc.label }}</label>
                    <div class="doc-upload" (click)="triggerUpload(doc.key)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <div class="doc-upload-title">{{ uploadedLabel(doc.key) }}</div>
                      <div class="doc-upload-sub">PDF, JPG, PNG · 10MB</div>
                    </div>
                    <input [id]="'file_' + doc.key" type="file" accept=".pdf,.jpg,.jpeg,.png" style="display: none" (change)="onUpload(doc.key, $event)" />
                  </div>
                }
              </div>
            }

            <!-- STEP 3: FACE BIOMETRICS -->
            @if (step() === 3) {
              <div style="max-width: 500px; margin: 0 auto; text-align: center;">
                <p style="margin-bottom: 16px; font-size: 0.85rem; color: var(--muted); line-height: 1.5;">
                  Register your facial biometrics to enable 1-second Face ID login and automated Clock In &amp; Clock Out.
                </p>

                <div class="emp-face-viewport">
                  <video #empFaceVideo class="emp-face-video" playsinline muted autoplay></video>
                  <canvas #empFaceCanvas class="emp-face-canvas"></canvas>

                  @if (!empCameraActive() || faceService.loadingModels()) {
                    <div class="emp-face-loading">
                      <div class="face-spinner"></div>
                      <div style="font-size: 13px; font-weight: 600; color: #e2e8f0;">
                        {{ faceService.loadingModels() ? 'Loading Face AI Neural Networks…' : 'Initializing webcam…' }}
                      </div>
                      <div style="font-size: 11px; color: #94a3b8;">Center your face in front of the camera</div>
                    </div>
                  }

                  <div class="face-hud-reticle" [class.scanning]="empFaceCapturing()" [class.matched]="isEmpFaceEnrolled()">
                    <div class="reticle-corner tl"></div>
                    <div class="reticle-corner tr"></div>
                    <div class="reticle-corner bl"></div>
                    <div class="reticle-corner br"></div>
                    <div class="reticle-laser" [class.active]="empFaceCapturing()"></div>
                  </div>
                </div>

                <div class="emp-face-status" [class.success]="isEmpFaceEnrolled()">
                  <span>{{ empFaceMsg() }}</span>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px;">
                  <button
                    type="button"
                    class="btn-ob-primary"
                    [disabled]="empFaceCapturing() || !empCameraActive()"
                    (click)="captureEmpFace()"
                  >
                    @if (empFaceCapturing()) {
                      Analyzing Biometrics…
                    } @else if (isEmpFaceEnrolled()) {
                      🔄 Re-scan Face ID
                    } @else {
                      📸 Scan &amp; Register Face ID
                    }
                  </button>
                </div>
              </div>
            }
            <div style="height: 16px"></div>
          } @else if (phase() === 'sending') {
            <div class="ob-success">
              <div class="ob-success-icon" style="background: #f59e0b">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h2>Sending Welcome Email…</h2>
              <p style="color: var(--muted)">
                Please wait while we send your welcome email to<br /><strong>{{ personal().email }}</strong>
              </p>
            </div>
          } @else {
            <div class="ob-success">
              <div class="ob-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2>All Set! 🎉</h2>
              <p>
                Your profile has been created successfully.<br />
                A welcome email has been sent to <strong>{{ personal().email }}</strong>
              </p>

              <!-- Email preview card -->
              <div class="ob-email-card">
                <div class="ob-email-header">
                  <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin-bottom: 4px">🎉 Welcome to HRNexus!</div>
                  <div style="color: rgba(255,255,255,.75); font-size: 12px">Your onboarding is complete</div>
                </div>
                <div class="ob-email-body">
                  <p style="margin: 0 0 12px; color: var(--text)">Hi <strong>{{ personal().firstName || 'there' }}</strong>,</p>
                  <p style="margin: 0 0 12px; color: var(--muted); line-height: 1.6">
                    Welcome to the team! Your profile has been successfully set up. You can now access your employee dashboard.
                  </p>
                  <div style="background: var(--bg); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px">
                    @for (row of emailRows(); track row[0]) {
                      <div class="ob-email-row">
                        <span style="color: var(--muted)">{{ row[0] }}</span>
                        <span>{{ row[1] }}</span>
                      </div>
                    }
                  </div>
                  <div style="text-align: center">
                    <span style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px">🚀 Go to Dashboard</span>
                  </div>
                </div>
                <div class="ob-email-footer">
                  <span style="font-size: 11px; color: var(--muted)">
                    HRNexus &bull; hr@hrnexus.com &bull; <span style="color: #16a34a; font-weight: 600">✓ Email Sent</span>
                  </span>
                </div>
              </div>

              <button class="btn-ob-primary" (click)="goDashboard()">
                Go to Dashboard
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          }
        </div>

        <!-- Footer -->
        @if (phase() === 'form') {
          <div class="ob-footer">
            <div class="ob-step-info">Step <span>{{ step() + 1 }}</span> of 4</div>
            <div class="ob-btns">
              @if (step() > 0) {
                <button class="btn-ob-outline" (click)="prevStep()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
              }
              <button class="btn-ob-primary" (click)="nextStep()">
                {{ step() === 3 ? 'Complete Setup' : 'Next' }}
                @if (step() === 3) {
                  <span [appIcon]="'check'"></span>
                } @else {
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                }
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .ob-page {
        min-height: 100vh;
        background: var(--bg);
        padding: 15px;
      }
      .ob-card {
        width: 100%;
        max-width: 100%;
        background: var(--surface);
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
      }
      .ob-header {
        background: linear-gradient(135deg, var(--p) 0%, #1e40af 100%);
        padding: 20px;
        text-align: center;
        color: #fff;
        position: relative;
        overflow: hidden;
      }
      .ob-header-inner {
        position: relative;
        z-index: 1;
      }
      .ob-logo {
        width: 54px;
        height: 54px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 14px;
        border: 3px solid rgba(255, 255, 255, 0.3);
      }
      .ob-header h1 {
        font-size: 1.5rem;
        font-weight: 800;
        margin-bottom: 5px;
      }
      .ob-header p {
        font-size: 0.88rem;
        opacity: 0.85;
        margin: 0;
      }
      .ob-stepper {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 20px 16px 16px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      .ob-step {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        max-width: 140px;
        position: relative;
      }
      .ob-step:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 17px;
        left: calc(50% + 22px);
        right: calc(-50% + 22px);
        height: 2px;
        background: var(--border);
        z-index: 0;
        transition: background 0.3s;
      }
      .ob-step.done:not(:last-child)::after {
        background: var(--p);
      }
      .ob-circle {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.82rem;
        font-weight: 700;
        border: 2px solid var(--border);
        background: var(--surface);
        color: var(--muted);
        z-index: 1;
        position: relative;
        transition: all 0.3s;
      }
      .ob-step.done .ob-circle {
        background: var(--p);
        border-color: var(--p);
        color: #fff;
      }
      .ob-step.active .ob-circle {
        background: var(--surface);
        border-color: var(--p);
        color: var(--p);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
      }
      .ob-label {
        font-size: 0.72rem;
        font-weight: 600;
        margin-top: 7px;
        color: var(--muted);
        text-align: center;
        white-space: nowrap;
      }
      .ob-step.active .ob-label {
        color: var(--p);
        font-weight: 700;
      }
      .ob-step.done .ob-label {
        color: var(--text);
      }
      .ob-body {
        padding: 24px 20px 8px;
      }
      .ob-step-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 18px;
      }
      .form-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 5px;
      }
      .req {
        color: #ef4444;
        margin-left: 2px;
      }
      .form-control {
        width: 100%;
        font-size: 14px;
        color: var(--text);
        border: 1.5px solid var(--border);
        border-radius: 6px;
        padding: 7px 10px;
        transition: 0.2s;
        background: var(--surface);
      }
      .form-control:focus {
        border-color: var(--p);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        outline: none;
      }
      .form-control.invalid {
        border-color: #ef4444;
      }
      .ob-grid {
        display: grid;
        gap: 16px;
      }
      .ob-grid-2 {
        grid-template-columns: repeat(2, 1fr);
      }
      .ob-grid-3 {
        grid-template-columns: repeat(3, 1fr);
      }
      .doc-upload {
        border: 2px dashed var(--border);
        border-radius: 10px;
        padding: 18px 12px;
        text-align: center;
        cursor: pointer;
        transition: 0.2s;
        background: var(--bg);
      }
      .doc-upload:hover {
        border-color: var(--p);
        background: var(--p-soft);
      }
      .doc-upload svg {
        width: 28px;
        height: 28px;
        color: var(--p);
        margin-bottom: 6px;
      }
      .doc-upload-title {
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 3px;
      }
      .doc-upload-sub {
        font-size: 0.72rem;
        color: var(--muted);
      }
      .ob-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--border);
        background: var(--bg);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ob-step-info {
        font-size: 0.8rem;
        color: var(--muted);
      }
      .ob-btns {
        display: flex;
        gap: 8px;
      }
      .btn-ob-outline,
      .btn-ob-primary {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 9px 18px;
        border-radius: 8px;
        font-size: 0.84rem;
        cursor: pointer;
        font-family: inherit;
        transition: 0.2s;
      }
      .btn-ob-outline {
        font-weight: 600;
        background: var(--surface);
        border: 1.5px solid var(--border);
        color: var(--text);
      }
      .btn-ob-outline:hover {
        border-color: var(--p);
        color: var(--p);
      }
      .btn-ob-primary {
        font-weight: 700;
        background: var(--p);
        color: #fff;
        border: none;
        padding: 9px 20px;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
      .btn-ob-primary:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
      }
      .ob-success {
        text-align: center;
        padding: 15px 0;
      }
      .ob-success-icon {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--p);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        animation: scaleIn 0.5s ease;
      }
      .ob-success-icon svg {
        width: 20px;
        height: 20px;
      }
      @keyframes scaleIn {
        from {
          transform: scale(0);
        }
        to {
          transform: scale(1);
        }
      }
      .ob-success h2 {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 10px;
      }
      .ob-success p {
        font-size: 0.85rem;
        color: var(--muted);
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .ob-email-card {
        max-width: 576px;
        margin: 20px auto 24px;
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
        text-align: left;
        font-size: 13px;
      }
      .ob-email-header {
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        padding: 15px;
      }
      .ob-email-body {
        padding: 15px;
        background: var(--surface);
      }
      .ob-email-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px solid var(--border);
      }
      .ob-email-row:last-child {
        border-bottom: none;
      }
      .ob-email-row span:last-child {
        font-weight: 600;
        color: var(--text);
        text-align: right;
        word-break: break-all;
      }
      .ob-email-footer {
        padding: 12px;
        background: var(--bg);
        border-top: 1px solid var(--border);
        text-align: center;
      }
      @media (max-width: 900px) {
        .ob-grid-3 {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .ob-grid-2,
        .ob-grid-3 {
          grid-template-columns: 1fr;
        }
        .ob-body {
          padding: 10px;
        }
        .ob-step-info {
          display: none;
        }
        .emp-face-viewport {
          position: relative; width: 100%; height: 270px; border-radius: 12px;
          overflow: hidden; background: #020617; border: 1px solid rgba(255,255,255,0.1);
        }
        .emp-face-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block; }
        .emp-face-canvas { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; z-index: 2; }
        .emp-face-loading {
          position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column;
          align-items: center; justify-content: center; background: rgba(2,6,23,0.92); gap: 8px;
        }
        .face-spinner {
          width: 34px; height: 34px; border: 3px solid rgba(59,130,246,0.2);
          border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .face-hud-reticle {
          position: absolute; top: 12%; left: 20%; right: 20%; bottom: 18%;
          border: 1.5px dashed rgba(59,130,246,0.5); border-radius: 20px;
          pointer-events: none; z-index: 3; transition: all 0.3s ease;
        }
        .face-hud-reticle.scanning { border-color: #60a5fa; box-shadow: 0 0 20px rgba(59,130,246,0.4); }
        .face-hud-reticle.matched { border-color: #10b981; border-style: solid; box-shadow: 0 0 25px rgba(16,185,129,0.5); }
        .reticle-corner { position: absolute; width: 12px; height: 12px; border: 2.5px solid #60a5fa; }
        .reticle-corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; border-top-left-radius: 6px; }
        .reticle-corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; border-top-right-radius: 6px; }
        .reticle-corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; border-bottom-left-radius: 6px; }
        .reticle-corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; border-bottom-right-radius: 6px; }
        .reticle-laser {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #38bdf8 30%, #ffffff 50%, #38bdf8 70%, transparent);
          box-shadow: 0 0 10px #38bdf8; opacity: 0;
        }
        .reticle-laser.active { opacity: 1; animation: laserSweep 1.5s ease-in-out infinite alternate; }
        @keyframes laserSweep { 0% { top: 5%; } 100% { top: 92%; } }
        .emp-face-status {
          margin-top: 10px; padding: 8px 14px; border-radius: 8px;
          background: var(--bg); border: 1px solid var(--border); font-size: 12px; color: var(--muted);
        }
        .emp-face-status.success { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #059669; font-weight: 600; }
      }
    `,
  ],
})
export class EmpOnboardingComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);
  protected readonly faceService = inject(FaceRecognitionService);

  @ViewChild('empFaceVideo') private empFaceVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('empFaceCanvas') private empFaceCanvasRef?: ElementRef<HTMLCanvasElement>;
  private empMediaStream?: MediaStream;

  protected readonly empCameraActive = signal(false);
  protected readonly empFaceCapturing = signal(false);
  protected readonly empFaceDescriptor = signal<number[] | null>(null);
  protected readonly empFacePhoto = signal<string | null>(null);
  protected readonly isEmpFaceEnrolled = computed(() => this.empFaceDescriptor() !== null);
  protected readonly empFaceMsg = signal('Position face in reticle and click Scan & Register Face ID');

  protected readonly step = signal(0);
  protected readonly phase = signal<'form' | 'sending' | 'done'>('form');
  protected readonly invalid = signal<Set<string>>(new Set());
  protected readonly uploaded = signal<Record<string, string>>({});

  protected readonly stepLabels = ['Personal', 'Bank Details', 'Documents', 'Face Biometrics'];
  protected readonly stepTitles = ['Personal Information', 'Bank Details', 'Upload Documents', 'Face Biometric Identity'];

  protected readonly genderOptions: SelectOption[] = [
    { v: '', l: 'Select' },
    { v: 'Male', l: 'Male' },
    { v: 'Female', l: 'Female' },
    { v: 'Other', l: 'Other' },
    { v: 'Prefer not to say', l: 'Prefer not to say' },
  ];
  protected readonly maritalOptions: SelectOption[] = [
    { v: '', l: 'Select' },
    { v: 'Single', l: 'Single' },
    { v: 'Married', l: 'Married' },
    { v: 'Divorced', l: 'Divorced' },
    { v: 'Widowed', l: 'Widowed' },
  ];
  protected readonly bloodOptions: SelectOption[] = [
    { v: '', l: 'Select' },
    ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({ v: b, l: b })),
  ];

  protected readonly docSlots = [
    { key: 'passport', label: 'Passport Copy' },
    { key: 'emiratesId', label: 'Emirates ID / National ID' },
    { key: 'eduCert', label: 'Educational Certificates' },
  ];

  protected readonly personal = signal({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    bloodGroup: '',
    city: '',
    state: '',
    country: '',
    address: '',
  });

  protected readonly bank = signal({
    bankName: '',
    accountName: '',
    accountNumber: '',
    iban: '',
    swift: '',
    branch: '',
  });

  protected readonly emailRows = () => [
    ['Name', [this.personal().firstName, this.personal().lastName].filter(Boolean).join(' ') || '—'],
    ['Email', this.personal().email || '—'],
    ['Phone', this.personal().phone || '—'],
    ['Join Date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })],
  ];

  protected isInvalid(field: string): boolean {
    return this.invalid().has(field);
  }

  protected patchP(key: keyof ReturnType<typeof this.personal>, value: string): void {
    this.personal.update((p) => ({ ...p, [key]: value }));
  }

  protected patchB(key: keyof ReturnType<typeof this.bank>, value: string): void {
    this.bank.update((b) => ({ ...b, [key]: value }));
  }

  protected uploadedLabel(key: string): string {
    const name = this.uploaded()[key];
    if (!name) return 'Click to Upload';
    return `✓ ${name.length > 20 ? `${name.substring(0, 20)}…` : name}`;
  }

  protected triggerUpload(key: string): void {
    document.getElementById(`file_${key}`)?.click();
  }

  protected onUpload(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploaded.update((u) => ({ ...u, [key]: file.name }));
  }

  protected nextStep(): void {
    if (!this.validate()) return;
    if (this.step() < 3) {
      this.step.update((s) => s + 1);
      if (this.step() === 3) {
        setTimeout(() => void this.startEmpCamera(), 200);
      } else {
        this.stopEmpCamera();
      }
    } else {
      this.stopEmpCamera();
      this.complete();
    }
  }

  protected prevStep(): void {
    if (this.step() > 0) {
      this.stopEmpCamera();
      this.step.update((s) => s - 1);
    }
  }

  ngOnDestroy(): void {
    this.stopEmpCamera();
  }

  private async startEmpCamera(): Promise<void> {
    try {
      this.stopEmpCamera();
      await this.faceService.loadModels();

      this.empMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.empFaceVideoRef?.nativeElement;
      if (!video) return;

      video.srcObject = this.empMediaStream;
      try {
        await video.play();
      } catch {}

      this.empCameraActive.set(true);
      this.empFaceMsg.set('Camera stream live. Center face in frame and click Register.');
    } catch (err) {
      console.warn('Webcam blocked in employee onboarding:', err);
      this.empCameraActive.set(false);
      this.empFaceMsg.set('Camera access denied or unavailable in your browser.');
    }
  }

  private stopEmpCamera(): void {
    if (this.empMediaStream) {
      this.empMediaStream.getTracks().forEach((t) => t.stop());
      this.empMediaStream = undefined;
    }
    const video = this.empFaceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
    this.empCameraActive.set(false);
  }

  protected async captureEmpFace(): Promise<void> {
    if (!this.empCameraActive() || !this.empFaceVideoRef?.nativeElement) return;

    this.empFaceCapturing.set(true);
    this.empFaceMsg.set('Analyzing facial biometrics and computing 128D AI descriptor…');

    const video = this.empFaceVideoRef.nativeElement;
    const canvas = this.empFaceCanvasRef?.nativeElement;

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

    this.empFaceCapturing.set(false);

    if (samples.length === 0) {
      this.empFaceMsg.set('❌ No face detected. Look directly into the camera.');
      this.toast.show('No face detected. Please face the camera directly.', 'warning');
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

    this.empFaceDescriptor.set(finalDescriptor);
    if (snapshot) this.empFacePhoto.set(snapshot);

    this.empFaceMsg.set('✅ Face Biometrics Captured (128D Deep Neural Embedding)!');
    this.toast.show('Face profile successfully registered!', 'success');
  }

  protected goDashboard(): void {
    void this.router.navigateByUrl('/me/dashboard');
  }

  /** Required-field check per step, mirroring the original's validateStep(). */
  private validate(): boolean {
    const required: Record<number, (keyof ReturnType<typeof this.personal> | keyof ReturnType<typeof this.bank>)[]> = {
      0: ['firstName', 'lastName', 'email', 'phone'],
      1: ['bankName', 'accountName', 'accountNumber'],
      2: [],
      3: [],
    };
    const fields = required[this.step()];
    const missing = fields.filter((f) => {
      const value = this.step() === 0 ? this.personal()[f as keyof ReturnType<typeof this.personal>] : this.bank()[f as keyof ReturnType<typeof this.bank>];
      return !value || !String(value).trim();
    });
    if (missing.length) {
      this.invalid.set(new Set(missing as string[]));
      this.toast.show('Please fill all required fields', 'danger');
      setTimeout(() => this.invalid.set(new Set()), 2000);
      return false;
    }
    return true;
  }

  private complete(): void {
    sessionStorage.setItem('empOnboardingComplete', 'true');
    this.phase.set('sending');

    const personal = this.personal();
    const bank = this.bank();

    this.api.employeeMe().subscribe({
      next: (employee) => {
        this.api
          .updateEmployee(employee.id, {
            firstName: personal.firstName.trim() || employee.firstName,
            middleName: personal.middleName,
            lastName: personal.lastName.trim() || employee.lastName,
            email: personal.email.trim() || employee.email,
            phone: personal.phone,
            departmentId: employee.departmentId,
            designationId: employee.designationId,
            branchId: employee.branchId,
            reportingManagerId: null,
            jobTitle: employee.jobTitle,
            grade: employee.grade,
            employmentType: employee.employmentType,
            status: employee.status,
            joinDate: employee.joinDate,
            noticePeriodDays: employee.noticePeriodDays,
            basicSalary: employee.basicSalary,
            housingAllowance: employee.housingAllowance,
            transportAllowance: employee.transportAllowance,
            mobileAllowance: employee.mobileAllowance,
            otherAllowances: employee.otherAllowances,
            currency: employee.currency,
            bankName: bank.bankName,
            accountName: bank.accountName,
            accountNumber: bank.accountNumber,
            iban: bank.iban,
            ifscCode: employee.ifscCode,
            swiftCode: bank.swift,
            paymentMode: employee.paymentMode,
            wpsId: employee.wpsId,
            passportNumber: employee.passportNumber,
            passportExpiry: employee.passportExpiry,
            visaNumber: employee.visaNumber,
            visaExpiry: employee.visaExpiry,
            emiratesId: employee.emiratesId,
          })
          .subscribe({
            next: () => {
              if (this.empFaceDescriptor()) {
                const descriptorStr = JSON.stringify(this.empFaceDescriptor());
                const photo = this.empFacePhoto() || '';
                const fullName = `${personal.firstName} ${personal.lastName}`.trim();

                const record: EnrolledFace = {
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  fullName,
                  department: employee.department || 'General',
                  avatarUrl: photo,
                  faceDescriptor: descriptorStr,
                };

                try {
                  localStorage.setItem('hrms_face_' + employee.id, JSON.stringify(record));
                  localStorage.setItem('hrms_face_' + employee.employeeCode.toLowerCase(), JSON.stringify(record));
                  localStorage.setItem('hrms_face_' + fullName.toLowerCase(), JSON.stringify(record));
                  localStorage.setItem('hrms_face_' + personal.email.toLowerCase(), JSON.stringify(record));
                } catch {}

                this.api.enrollFace(employee.id, {
                  faceDescriptor: descriptorStr,
                  facePhotoUrl: photo,
                }).subscribe({ next: () => {}, error: () => {} });
              }

              this.phase.set('done');
              setTimeout(() => this.goDashboard(), 5000);
            },
            error: (error) => {
              this.phase.set('form');
              this.toast.show(error?.error?.title ?? 'Could not save your details.', 'danger');
            },
          });
      },
      error: () => {
        this.phase.set('done');
        setTimeout(() => this.goDashboard(), 5000);
      },
    });
  }
}
