export interface Point {
	x: number;
	y: number;
}

export interface Line {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * View state for the grid designer.
 * Used for persisting and restoring the user's viewport settings.
 */
export interface GridViewState {
	zoom: number;
	panX: number;
	panY: number;
	showNotchPositions: boolean;
	showHelpText: boolean;
	showLineIds: boolean;
}

export interface Intersection {
	id: string;
	x: number;
	y: number;
	line1Id: string;
	line2Id: string;
	line1Over: boolean;
}

export interface Notch {
	id: string;
	otherLineId: string;
	dist: number;
	fromTop: boolean;
}

/**
 * DesignStrip represents a physical strip derived from a grid Line plus
 * intersections.
 *
 * - `id` is a geometry-derived identifier (length + notch pattern) used as the
 *   canonical strip ID in the layout (Piece.lineId, strip bank, export, etc.).
 * - `sourceLineId` keeps a reference to the originating grid Line.id so the
 *   grid UI can still label and highlight lines even though strips are
 *   deduplicated by geometry.
 */
export interface DesignStrip extends Line {
	lengthMM: number;
	notches: Notch[];
	/**
	 * The originating grid Line.id this strip was derived from. This is used
	 * for correlating strips back to particular lines in the grid UI.
	 */
	sourceLineId: string;
	/**
	 * Short, user-friendly code (e.g. 4-character base36) derived from the
	 * strip's geometry. This is what we show in the grid and layout UIs.
	 *
	 * It is stable for identical geometry and independent of sourceLineId.
	 */
	displayCode: string;
}

export interface Piece {
	id: string;
	lineId: string;
	x: number;
	y: number;
	/**
	 * The row index this piece is placed on in the layout.
	 * Row 0 is the top row.
	 */
	rowIndex: number;
}

export interface Cut {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Group {
	id: string;
	name: string;
	pieces: Map<string, Piece>;
	fullCuts: Map<string, Cut>;
}

export const INCH_TO_MM = 25.4;
export const MM_TO_INCH = 1 / INCH_TO_MM;

export const convertUnit = (
	value: number,
	fromUnit: "mm" | "in",
	toUnit: "mm" | "in",
): number => {
	if (fromUnit === toUnit || !value) return value;
	if (fromUnit === "mm" && toUnit === "in") return value * MM_TO_INCH;
	if (fromUnit === "in" && toUnit === "mm") return value * INCH_TO_MM;
	return value;
};

export const formatValue = (
	mmValue: number,
	displayUnit: "mm" | "in",
): string => {
	const value = convertUnit(mmValue, "mm", displayUnit);
	return value.toFixed(displayUnit === "mm" ? 1 : 3);
};

export const newId = (): string =>
	`id_${Math.random().toString(36).substr(2, 9)}`;

// Re-export geometry utilities for backward compatibility
export { findIntersection } from "./geometry";
