import { useEffect, useRef, useState } from 'react';
import { FaceTracker } from '@/engine/tracking/face-tracker.ts';

/**
 * Hook that acquires the user-facing camera stream, creates a hidden <video> element,
 * and initialises a FaceTracker.
 *
 * Returns refs to the video element and tracker, plus a `ready` flag that becomes
 * true once both the camera stream and tracker initialisation have completed.
 *
 * Cleanup: stops all media stream tracks and destroys the tracker on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        // Request user-facing camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
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
      } catch (err) {
        console.warn('Camera/FaceTracker setup failed:', err);
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

      setReady(false);
    };
  }, []);

  return { videoRef, trackerRef, ready };
}
