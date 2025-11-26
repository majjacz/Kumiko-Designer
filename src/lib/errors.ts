/**
 * Typed error classes for the Kumiko Designer application
 */

/**
 * Base error class for all Kumiko-related errors
 */
export class KumikoError extends Error {
	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = "KumikoError";
	}
}

/**
 * Errors related to design validation
 */
export class DesignValidationError extends KumikoError {
	constructor(message: string) {
		super(message, "DESIGN_VALIDATION_ERROR");
		this.name = "DesignValidationError";
	}
}

/**
 * Errors related to import operations
 */
export class ImportError extends KumikoError {
	constructor(message: string) {
		super(message, "IMPORT_ERROR");
		this.name = "ImportError";
	}
}

/**
 * Errors related to export operations
 */
export class ExportError extends KumikoError {
	constructor(message: string) {
		super(message, "EXPORT_ERROR");
		this.name = "ExportError";
	}
}

/**
 * Errors related to storage operations (localStorage)
 */
export class StorageError extends KumikoError {
	constructor(message: string) {
		super(message, "STORAGE_ERROR");
		this.name = "StorageError";
	}
}

/**
 * Errors related to template loading
 */
export class TemplateError extends KumikoError {
	constructor(message: string) {
		super(message, "TEMPLATE_ERROR");
		this.name = "TemplateError";
	}
}

/**
 * Errors related to layout operations
 */
export class LayoutError extends KumikoError {
	constructor(message: string) {
		super(message, "LAYOUT_ERROR");
		this.name = "LayoutError";
	}
}

/**
 * Notification type for toast messages
 */
export type NotificationType = "success" | "error" | "warning" | "info";

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
