import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '@/engine/modules/base-module';
import type { BodyTracker } from '@/engine/tracking/body-tracker';
import type { BodyLandmark } from '@/engine/tracking/body-tracker';

export class BodyInput extends BaseModule {
  readonly type = 'BodyInput';

  private tracker: BodyTracker | null = null;

  getSchema(): ModuleSchema {
    return {
      skeleton: {
        type: 'boolean',
        label: 'Show Skeleton',
        default: true,
      },
      matchPose: {
        type: 'string',
        label: 'Match Pose',
        default: '',
      },
      tolerance: {
        type: 'range',
        label: 'Tolerance',
        default: 0.3,
        min: 0.1,
        max: 0.5,
        step: 0.05,
      },
    };
  }

  setTracker(tracker: BodyTracker): void {
    this.tracker = tracker;
  }

  update(_dt: number): void {
    if (!this.tracker) return;

    const result = this.tracker.getLastResult();
    if (!result || !result.detected) return;

    this.emit('input:body:move', { landmarks: result.landmarks });

    // Basic pose matching stub — emits when a named pose is configured
    const matchPose: string = this.params.matchPose ?? '';
    if (matchPose) {
      const match = this.checkPoseMatch(result.landmarks, matchPose);
      this.emit('input:body:pose', {
        pose: matchPose,
        matched: match,
      });
    }
  }

  getLandmarks(): BodyLandmark[] | null {
    const result = this.tracker?.getLastResult();
    if (!result || !result.detected) return null;
    return result.landmarks;
  }

  /**
   * Simple pose matching based on predefined poses.
   * Returns true if the current body landmarks roughly match
   * the named pose within the configured tolerance.
   */
  private checkPoseMatch(
    landmarks: BodyLandmark[],
    _poseName: string,
  ): boolean {
    const tolerance: number = this.params.tolerance ?? 0.3;

    // Example: 'handsUp' — both wrists above shoulders
    if (_poseName === 'handsUp') {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      if (leftShoulder && rightShoulder && leftWrist && rightWrist) {
        return (
          leftWrist.y < leftShoulder.y - tolerance &&
          rightWrist.y < rightShoulder.y - tolerance
        );
      }
    }

    // Example: 'tPose' — arms extended horizontally
    if (_poseName === 'tPose') {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      if (leftShoulder && rightShoulder && leftWrist && rightWrist) {
        const leftArmLevel =
          Math.abs(leftWrist.y - leftShoulder.y) < tolerance;
        const rightArmLevel =
          Math.abs(rightWrist.y - rightShoulder.y) < tolerance;
        return leftArmLevel && rightArmLevel;
      }
    }

    return false;
  }
}
