import type { GridViewState } from "./types";

export type { GridViewState };

export interface SavedDesignPayload {
	version: 1;
	// core params
	units: "mm" | "in";
	bitSize: number;
	cutDepth: number;
	halfCutDepth: number;
	/**
	 * Physical size of a single grid cell in mm (design scale).
	 * All persisted designs must provide this.
	 */
	gridCellSize: number;
	/**
	 * Physical board/stock length in mm used in layout and SVG export.
	 */
	stockLength: number;

	// design
	lines: {
		id: string;
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	}[];

	// intersection states (id -> line1Over boolean)
	intersectionStates?: [string, boolean][];

	/**
	 * Optional persisted view state for the grid designer.
	 * Older payloads may omit this, in which case sensible defaults are used.
	 */
	gridViewState?: GridViewState;

	// layout
	groups: {
		id: string;
		name: string;
		pieces: {
			id: string;
			lineId: string;
			x: number;
			y: number;
			rowIndex: number;
		}[];
		fullCuts: {
			id: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
		}[];
	}[];
	activeGroupId: string;
	designName?: string;
}

const STORAGE_KEY = "kumiko-designer-v1";
const STORAGE_KEY_LIST = "kumiko-designer-list-v1";

function isBrowser(): boolean {
	return (
		typeof window !== "undefined" && typeof window.localStorage !== "undefined"
	);
}

export function saveDesign(payload: SavedDesignPayload): void {
	if (!isBrowser()) return;

	try {
		const data = JSON.stringify(payload);
		window.localStorage.setItem(STORAGE_KEY, data);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to save design", error);
	}
}

export function loadDesign(): SavedDesignPayload | null {
	if (!isBrowser()) return null;

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			console.log("[kumiko-storage] No saved design found in localStorage");
			return null;
		}

		const parsed = JSON.parse(raw) as SavedDesignPayload;
		if (parsed.version !== 1) return null;

		if (!parsed.lines || !parsed.groups) return null;
		if (typeof parsed.gridCellSize !== "number") return null;
		if (typeof parsed.stockLength !== "number") return null;

		return parsed;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to load design", error);
		return null;
	}
}

export function clearDesign(): void {
	if (!isBrowser()) return;

	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to clear design", error);
	}
}

/**
 * Named design storage (hybrid model)
 *
 * We keep the existing implicit autosave under STORAGE_KEY for the "current working design".
 * In addition, we support explicit named snapshots in a small index stored at STORAGE_KEY_LIST.
 */

export interface NamedDesignSummary {
	name: string;
	savedAt: string; // ISO date
}

/**
 * Return all saved named designs (index only).
 */
export function listNamedDesigns(): NamedDesignSummary[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY_LIST);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as NamedDesignSummary[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(d) => typeof d.name === "string" && typeof d.savedAt === "string",
		);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to list named designs", error);
		return [];
	}
}

/**
 * Internal helper to persist the index of named designs.
 */
function saveNamedIndex(index: NamedDesignSummary[]): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(index));
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to save named design index", error);
	}
}

/**
 * Save a full design payload under the given name.
 * Overwrites existing entry of the same name.
 */
export function saveNamedDesign(
	name: string,
	payload: SavedDesignPayload,
): void {
	if (!isBrowser()) return;
	if (!name.trim()) return;

	try {
		const safeName = name.trim();
		const key = `kumiko-designer-named-${safeName}`;

		const toStore: SavedDesignPayload = {
			...payload,
			designName: safeName,
		};

		window.localStorage.setItem(key, JSON.stringify(toStore));

		const index = listNamedDesigns();
		const existingIdx = index.findIndex((d) => d.name === safeName);
		const entry: NamedDesignSummary = {
			name: safeName,
			savedAt: new Date().toISOString(),
		};

		if (existingIdx >= 0) {
			index[existingIdx] = entry;
		} else {
			index.push(entry);
		}
		saveNamedIndex(index);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to save named design", error);
	}
}

/**
 * Load a named design payload by name.
 */
export function loadNamedDesign(name: string): SavedDesignPayload | null {
	if (!isBrowser()) return null;
	if (!name.trim()) return null;

	try {
		const safeName = name.trim();
		const key = `kumiko-designer-named-${safeName}`;
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as SavedDesignPayload;
		if (parsed.version !== 1) return null;
		if (!parsed.lines || !parsed.groups) return null;
		if (typeof parsed.gridCellSize !== "number") return null;
		if (typeof parsed.stockLength !== "number") return null;
		return parsed;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to load named design", error);
		return null;
	}
}

/**
 * Delete a named design and update the index.
 */
export function deleteNamedDesign(name: string): void {
	if (!isBrowser()) return;
	if (!name.trim()) return;

	try {
		const safeName = name.trim();
		const key = `kumiko-designer-named-${safeName}`;
		window.localStorage.removeItem(key);

		const index = listNamedDesigns().filter((d) => d.name !== safeName);
		saveNamedIndex(index);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error("[kumiko-storage] Failed to delete named design", error);
	}
}

// =============================================================================
// Payload Serialization
// =============================================================================

import type { Group, Line } from "./types";

export interface CreateDesignPayloadOptions {
	units: "mm" | "in";
	bitSize: number;
	cutDepth: number;
	halfCutDepth: number;
	gridCellSize: number;
	stockLength: number;
	lines: Map<string, Line>;
	groups: Map<string, Group>;
	activeGroupId: string;
	designName?: string;
	intersectionStates: Map<string, boolean>;
	gridViewState?: GridViewState;
}

/**
 * Create a SavedDesignPayload from the current application state.
 * This centralizes the serialization logic used for autosave, save-as, and export.
 */
export function createDesignPayload(
	options: CreateDesignPayloadOptions,
): SavedDesignPayload {
	const {
		units,
		bitSize,
		cutDepth,
		halfCutDepth,
		gridCellSize,
		stockLength,
		lines,
		groups,
		activeGroupId,
		designName,
		intersectionStates,
		gridViewState,
	} = options;

	return {
		version: 1 as const,
		units,
		bitSize,
		cutDepth,
		halfCutDepth,
		gridCellSize,
		stockLength,
		lines: Array.from(lines.values()),
		groups: Array.from(groups.values()).map((g) => ({
			id: g.id,
			name: g.name,
			pieces: Array.from(g.pieces.values()),
			fullCuts: Array.from(g.fullCuts.values()),
		})),
		activeGroupId,
		designName: designName || undefined,
		intersectionStates: Array.from(intersectionStates.entries()),
		gridViewState,
	};
}
