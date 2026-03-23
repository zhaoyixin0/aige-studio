import {
  GestureRecognizer,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';

export interface HandTrackingResult {
  detected: boolean;
  x: number;  // palm center normalized 0-1
  y: number;  // palm center normalized 0-1
  gesture: string | null; // 'open'|'closed'|'pointing'|'thumbsUp'|'peace' etc.
  landmarks: Array<{ x: number; y: number; z: number }>;
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export class HandTracker {
  private recognizer: GestureRecognizer | null = null;
  private lastResult: HandTrackingResult | null = null;

  async init(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this.recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } catch {
      // Browser APIs not available — e.g. Node/test environment
      this.recognizer = null;
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): HandTrackingResult | null {
    if (!this.recognizer) return null;

    let raw: GestureRecognizerResult;
    try {
      raw = this.recognizer.recognizeForVideo(video, timestamp);
    } catch {
      return null;
    }

    if (!raw.landmarks || raw.landmarks.length === 0) {
      const noHand: HandTrackingResult = {
        detected: false,
        x: 0,
        y: 0,
        gesture: null,
        landmarks: [],
      };
      this.lastResult = noHand;
      return noHand;
    }

    const handLandmarks = raw.landmarks[0];

    // Palm center: average of wrist(0), index_mcp(5), middle_mcp(9), ring_mcp(13), pinky_mcp(17)
    const palmIndices = [0, 5, 9, 13, 17];
    let cx = 0;
    let cy = 0;
    for (const idx of palmIndices) {
      cx += handLandmarks[idx].x;
      cy += handLandmarks[idx].y;
    }
    cx /= palmIndices.length;
    cy /= palmIndices.length;

    // Map MediaPipe gesture names to friendly names
    let gesture: string | null = null;
    if (raw.gestures && raw.gestures.length > 0) {
      const topGesture = raw.gestures[0][0];
      if (topGesture) {
        gesture = mapGestureName(topGesture.categoryName);
      }
    }

    const landmarks = handLandmarks.map((lm: { x: number; y: number; z: number }) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
    }));

    const result: HandTrackingResult = {
      detected: true,
      x: cx,
      y: cy,
      gesture,
      landmarks,
    };

    this.lastResult = result;
    return result;
  }

  getLastResult(): HandTrackingResult | null {
    return this.lastResult;
  }

  destroy(): void {
    this.recognizer?.close();
    this.recognizer = null;
    this.lastResult = null;
  }
}

function mapGestureName(raw: string): string {
  const map: Record<string, string> = {
    'Closed_Fist': 'closed',
    'Open_Palm': 'open',
    'Pointing_Up': 'pointing',
    'Thumb_Up': 'thumbsUp',
    'Thumb_Down': 'thumbsDown',
    'Victory': 'peace',
    'ILoveYou': 'iLoveYou',
    'None': 'none',
  };
  return map[raw] ?? raw.toLowerCase();
}
