/**
 * Notification and error handling utilities for the Kumiko Designer application
 */

/**
 * Notification type for toast messages
 */
export type NotificationType = "success" | "error" | "warning" | "info";

/**
 * Callback type for showing notifications to the user.
 * Used by hooks and components that need to display toast messages.
 */
export type NotifyCallback = (type: NotificationType, message: string) => void;

/**
 * Interface for notification messages displayed to users
 */
export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	duration?: number; // Auto-dismiss after ms, undefined = manual dismiss
}

/**
 * Default notification durations by type (in milliseconds)
 */
export const DEFAULT_NOTIFICATION_DURATIONS: Record<NotificationType, number> =
	{
		success: 3000,
		info: 4000,
		warning: 5000,
		error: 6000,
	};
