import { useEffect, useRef, useState } from 'react';
import { FaceTracker } from '@/engine/tracking/face-tracker.ts';

/**
 * Hook that acquires the user-facing camera stream, creates a hidden <video> element,
 * and initialises a FaceTracker.
 *
 * Strategy A: Requests 9:16 portrait resolution (ideal 720x1280) to match the game canvas.
 * If the camera doesn't support 9:16, the actual resolution is exposed via videoDimensionsRef
 * so downstream consumers can apply "cover" scaling (Strategy B fallback).
 *
 * Returns refs to the video element, tracker, actual video dimensions, plus a `ready` flag
 * that becomes true once both the camera stream and tracker initialisation have completed.
 *
 * Cleanup: stops all media stream tracks and destroys the tracker on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        // Strategy A: Request 9:16 portrait resolution to match game canvas
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Create hidden video element
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.muted = true;
        video.srcObject = stream;
        video.style.display = 'none';
        document.body.appendChild(video);
        await video.play();

        // Wait for actual dimensions to be available
        if (video.videoWidth === 0) {
          await new Promise<void>((resolve, reject) => {
            if (video.videoWidth > 0) { resolve(); return; }
            const onMeta = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              video.removeEventListener('error', onErr);
              resolve();
            };
            const onErr = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              video.removeEventListener('error', onErr);
              reject(new Error('Video metadata load failed'));
            };
            video.addEventListener('loadedmetadata', onMeta);
            video.addEventListener('error', onErr);
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          video.remove();
          return;
        }

        // Expose actual video dimensions for Strategy B fallback
        videoDimensionsRef.current = {
          width: video.videoWidth,
          height: video.videoHeight,
        };

        videoRef.current = video;

        // Initialise face tracker
        const tracker = new FaceTracker();
        await tracker.init();

        if (cancelled) {
          tracker.destroy();
          stream.getTracks().forEach((t) => t.stop());
          video.remove();
          return;
        }

        trackerRef.current = tracker;
        setReady(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Camera/FaceTracker setup failed';
        setError(message);
      }
    }

    setup();

    return () => {
      cancelled = true;

      // Stop media stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Remove hidden video element
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }

      // Destroy tracker
      if (trackerRef.current) {
        trackerRef.current.destroy();
        trackerRef.current = null;
      }

      videoDimensionsRef.current = null;
      setReady(false);
    };
  }, []);

  return { videoRef, trackerRef, videoDimensionsRef, ready, error };
}
