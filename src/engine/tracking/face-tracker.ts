import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface FaceTrackingResult {
  headX: number;          // normalized 0-1
  headY: number;          // normalized 0-1
  headRotation: number;   // radians
  mouthOpen: number;      // 0-1
  leftEyeBlink: number;   // 0-1
  rightEyeBlink: number;  // 0-1
  smile: number;          // 0-1
  eyebrowRaise: number;   // 0-1
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class FaceTracker {
  private landmarker: FaceLandmarker | null = null;
  private lastResult: FaceTrackingResult | null = null;

  async init(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    } catch {
      // Browser APIs (WebGL/video) not available — e.g. Node/test environment
      this.landmarker = null;
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceTrackingResult | null {
    if (!this.landmarker) return null;

    let raw: FaceLandmarkerResult;
    try {
      raw = this.landmarker.detectForVideo(video, timestamp);
    } catch {
      return null;
    }

    if (!raw.faceLandmarks || raw.faceLandmarks.length === 0) return null;

    const landmarks = raw.faceLandmarks[0];
    // Nose tip is landmark index 1
    const noseTip = landmarks[1];
    const headX = noseTip?.x ?? 0.5;
    const headY = noseTip?.y ?? 0.5;

    // Compute rough head rotation from left ear (234) to right ear (454)
    const leftEar = landmarks[234];
    const rightEar = landmarks[454];
    const headRotation =
      leftEar && rightEar
        ? Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x)
        : 0;

    // Extract blendshapes
    const blendshapes = raw.faceBlendshapes?.[0]?.categories ?? [];
    const blend = (name: string): number => {
      const entry = blendshapes.find((b: { categoryName: string; score: number }) => b.categoryName === name);
      return entry?.score ?? 0;
    };

    const result: FaceTrackingResult = {
      headX,
      headY,
      headRotation,
      mouthOpen: blend('jawOpen'),
      leftEyeBlink: blend('eyeBlinkLeft'),
      rightEyeBlink: blend('eyeBlinkRight'),
      smile: (blend('mouthSmileLeft') + blend('mouthSmileRight')) / 2,
      eyebrowRaise:
        (blend('browOuterUpLeft') + blend('browOuterUpRight')) / 2,
    };

    this.lastResult = result;
    return result;
  }

  getLastResult(): FaceTrackingResult | null {
    return this.lastResult;
  }

  destroy(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastResult = null;
  }
}
