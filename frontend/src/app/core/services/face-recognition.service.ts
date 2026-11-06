import { Injectable, signal } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';

export interface FaceScanResult {
  hasFace: boolean;
  score: number;
  descriptor?: number[];
  box?: { x: number; y: number; width: number; height: number };
  snapshot?: string;
  landmarks?: unknown;
}

export interface FaceMatchEvaluation {
  matched: boolean;
  matchScore: number;
  distance: number;
  threshold: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FaceRecognitionService {
  readonly modelsLoaded = signal(false);
  readonly loadingModels = signal(false);
  private loadPromise: Promise<boolean> | null = null;

  /**
   * Loads the TinyFaceDetector, FaceLandmark68, and FaceRecognition models
   * from the local /models folder.
   */
  async loadModels(): Promise<boolean> {
    if (this.modelsLoaded()) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadingModels.set(true);

    this.loadPromise = (async () => {
      try {
        const modelPath = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        ]);
        this.modelsLoaded.set(true);
        this.loadingModels.set(false);
        return true;
      } catch (err) {
        console.warn('Failed to load local face models, trying CDN fallback:', err);
        try {
          const cdnPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(cdnPath),
            faceapi.nets.faceLandmark68Net.loadFromUri(cdnPath),
            faceapi.nets.faceRecognitionNet.loadFromUri(cdnPath),
          ]);
          this.modelsLoaded.set(true);
          this.loadingModels.set(false);
          return true;
        } catch (cdnErr) {
          console.error('Failed to load face models from CDN:', cdnErr);
          this.loadingModels.set(false);
          return false;
        }
      }
    })();

    return this.loadPromise;
  }

  /**
   * Detects a single face from an HTML video or canvas element, computes 68 landmarks,
   * and generates a 128-dimensional deep metric learning descriptor.
   */
  async detectFace(
    element: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    canvasRef?: HTMLCanvasElement
  ): Promise<FaceScanResult> {
    const ready = await this.loadModels();
    if (!ready) {
      return { hasFace: false, score: 0 };
    }

    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      });

      const detection = await faceapi
        .detectSingleFace(element, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return { hasFace: false, score: 0 };
      }

      // Capture snapshot if canvas provided
      let snapshot: string | undefined;
      if (canvasRef && element instanceof HTMLVideoElement && element.videoWidth > 0) {
        canvasRef.width = element.videoWidth;
        canvasRef.height = element.videoHeight;
        const ctx = canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(element, 0, 0, canvasRef.width, canvasRef.height);
          snapshot = canvasRef.toDataURL('image/jpeg', 0.85);
        }
      }

      const box = detection.detection.box;

      return {
        hasFace: true,
        score: Math.round(detection.detection.score * 100),
        descriptor: Array.from(detection.descriptor),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        snapshot,
        landmarks: detection.landmarks,
      };
    } catch (err) {
      console.warn('Face detection error:', err);
      return { hasFace: false, score: 0 };
    }
  }

  /**
   * Compares two 128-dimensional face descriptors using true Euclidean distance.
   * Standard threshold for face-api.js is distance < 0.55.
   * Converted to 0-100% accuracy:
   *   distance = 0.20 -> 90%
   *   distance = 0.35 -> 82%
   *   distance = 0.40 -> 80% (threshold)
   *   distance = 0.60 -> 50%
   *   distance = 0.80+ -> 0%
   */
  compareFaces(
    liveDescriptor: number[] | Float32Array,
    enrolledDescriptor: number[] | Float32Array,
    requiredThreshold = 80
  ): FaceMatchEvaluation {
    const arr1 = liveDescriptor instanceof Float32Array ? liveDescriptor : new Float32Array(liveDescriptor);
    const arr2 = enrolledDescriptor instanceof Float32Array ? enrolledDescriptor : new Float32Array(enrolledDescriptor);

    const distance = faceapi.euclideanDistance(arr1, arr2);

    // In ResNet-34 face embeddings (L2-normalized 128D space):
    // - Distance 0.00: Identical image (100%)
    // - Distance 0.15 - 0.35: Same person under natural camera variations (85% - 94%)
    // - Distance 0.45: Standard biometric threshold boundary for same person (80%)
    // - Distance 0.55+: Mismatch / different person (drops steeply < 60%)
    // - Distance 0.70+: Stranger / completely different face (< 25%)
    let normalizedScore: number;
    if (distance <= 0.45) {
      // Maps [0.00, 0.45] -> [100%, 80%]
      normalizedScore = Math.round(100 - (distance / 0.45) * 20);
    } else {
      // Maps (0.45, 0.80] -> (80%, 0%]
      normalizedScore = Math.max(0, Math.round(80 - ((distance - 0.45) / 0.35) * 80));
    }

    const matched = normalizedScore >= requiredThreshold;

    let message = '';
    if (matched) {
      message = `✅ Face verified: ${normalizedScore}% match (≥${requiredThreshold}% required, distance: ${distance.toFixed(3)}). Identity confirmed!`;
    } else {
      message = `❌ Face mismatch: ${normalizedScore}% match (Must be ≥ ${requiredThreshold}%, distance: ${distance.toFixed(3)}). Somebody else's face detected! Access denied.`;
    }

    return {
      matched,
      matchScore: normalizedScore,
      distance,
      threshold: requiredThreshold,
      message,
    };
  }
}
