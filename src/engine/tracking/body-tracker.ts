import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface BodyLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface BodyTrackingResult {
  detected: boolean;
  landmarks: BodyLandmark[];
  // Key landmark indices:
  //   nose(0), leftShoulder(11), rightShoulder(12),
  //   leftHip(23), rightHip(24)
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export class BodyTracker {
  private landmarker: PoseLandmarker | null = null;
  private lastResult: BodyTrackingResult | null = null;

  async init(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch {
      // Browser APIs not available — e.g. Node/test environment
      this.landmarker = null;
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): BodyTrackingResult | null {
    if (!this.landmarker) return null;

    let raw: PoseLandmarkerResult;
    try {
      raw = this.landmarker.detectForVideo(video, timestamp);
    } catch {
      return null;
    }

    if (!raw.landmarks || raw.landmarks.length === 0) {
      const noBody: BodyTrackingResult = { detected: false, landmarks: [] };
      this.lastResult = noBody;
      return noBody;
    }

    const poseLandmarks = raw.landmarks[0];
    const landmarks: BodyLandmark[] = poseLandmarks.map((lm: { x: number; y: number; z: number; visibility?: number }) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));

    const result: BodyTrackingResult = {
      detected: true,
      landmarks,
    };

    this.lastResult = result;
    return result;
  }

  getLastResult(): BodyTrackingResult | null {
    return this.lastResult;
  }

  destroy(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastResult = null;
  }
}
