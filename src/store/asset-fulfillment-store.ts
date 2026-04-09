/**
 * Singleton Zustand store that exposes the currently active asset
 * fulfillment run so unrelated UI (e.g. StudioChatPanel) can subscribe to
 * its `isActive` state and trigger `cancel()` without needing to share React
 * state with the hook that started the run.
 *
 * The hook `useStreamingAssetFulfillment` is the only writer; other
 * components are read-only consumers via `useAssetFulfillmentStore`.
 */
import { create } from 'zustand';

export interface FulfillmentController {
  /** Abort the in-flight fulfillment and collapse its progress message. */
  cancel: () => void;
}

interface AssetFulfillmentStore {
  isActive: boolean;
  controller: FulfillmentController | null;
  setActive: (active: boolean, controller?: FulfillmentController | null) => void;
  cancel: () => void;
}

export const useAssetFulfillmentStore = create<AssetFulfillmentStore>((set, get) => ({
  isActive: false,
  controller: null,

  setActive: (active, controller) =>
    set({
      isActive: active,
      controller: active ? (controller ?? null) : null,
    }),

  cancel: () => {
    const c = get().controller;
    c?.cancel();
  },
}));
