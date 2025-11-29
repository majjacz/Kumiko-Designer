/**
 * Shared hook for managing notification callbacks in a ref-stable way.
 * This prevents unnecessary re-renders while ensuring the latest callback is always used.
 */
import { useCallback, useRef } from "react";
import type { NotificationType, NotifyCallback } from "../lib/errors";

export interface UseNotifyOptions {
	/** Optional callback for showing notifications to the user */
	onNotify?: NotifyCallback;
}

/**
 * Returns a stable notify function that calls the latest onNotify callback.
 * The returned function is safe to use in callbacks and effects without
 * causing unnecessary re-renders.
 */
export function useNotify(options: UseNotifyOptions = {}) {
	const { onNotify } = options;

	// Keep ref for notify callback
	const onNotifyRef = useRef(onNotify);
	onNotifyRef.current = onNotify;

	/** Helper to show notification if callback is provided */
	const notify = useCallback((type: NotificationType, message: string) => {
		onNotifyRef.current?.(type, message);
	}, []);

	return notify;
}
