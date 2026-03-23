declare module '@mediapipe/tasks-vision' {
  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<unknown>;
  }

  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Category {
    categoryName: string;
    score: number;
    index: number;
    displayName: string;
  }

  export interface GestureRecognizerResult {
    landmarks: NormalizedLandmark[][];
    gestures: Category[][];
  }

  export class GestureRecognizer {
    static createFromOptions(
      resolver: unknown,
      options: Record<string, unknown>,
    ): Promise<GestureRecognizer>;
    recognizeForVideo(
      video: HTMLVideoElement,
      timestamp: number,
    ): GestureRecognizerResult;
    close(): void;
  }

  export interface PoseLandmarkerResult {
    landmarks: NormalizedLandmark[][];
  }

  export class PoseLandmarker {
    static createFromOptions(
      resolver: unknown,
      options: Record<string, unknown>,
    ): Promise<PoseLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestamp: number,
    ): PoseLandmarkerResult;
    close(): void;
  }

  export interface FaceLandmarkerResult {
    faceLandmarks: NormalizedLandmark[][];
    faceBlendshapes?: Array<{
      categories: Category[];
    }>;
  }

  export class FaceLandmarker {
    static createFromOptions(
      resolver: unknown,
      options: Record<string, unknown>,
    ): Promise<FaceLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestamp: number,
    ): FaceLandmarkerResult;
    close(): void;
  }
}
