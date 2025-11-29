/**
 * Shared test fixture factories for Kumiko design tests.
 * These helpers create consistent test data structures across multiple test files.
 */
import type { DesignStrip, Line, Piece } from "./types";

/**
 * Creates a DesignStrip with sensible defaults.
 * Any property can be overridden via the `overrides` parameter.
 */
export const makeStrip = (overrides?: Partial<DesignStrip>): DesignStrip => ({
	id: overrides?.id ?? "strip",
	x1: overrides?.x1 ?? 0,
	y1: overrides?.y1 ?? 0,
	x2: overrides?.x2 ?? 100,
	y2: overrides?.y2 ?? 0,
	lengthMM: overrides?.lengthMM ?? 100,
	notches: overrides?.notches ?? [],
	// Test helper: default sourceLineId to the same value as id unless overridden.
	sourceLineId: overrides?.sourceLineId ?? overrides?.id ?? "strip",
	// Short, user-friendly display code; tests can override if needed.
	displayCode: overrides?.displayCode ?? "CODE",
});

/**
 * Creates a Piece with sensible defaults.
 * Any property can be overridden via the `overrides` parameter.
 */
export const makePiece = (overrides?: Partial<Piece>): Piece => ({
	id: overrides?.id ?? "piece",
	lineId: overrides?.lineId ?? "strip",
	x: overrides?.x ?? 0,
	y: overrides?.y ?? 0,
	rowIndex: overrides?.rowIndex ?? 0,
});

/**
 * Creates a Line with required parameters.
 */
export const makeLine = (
	id: string,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): Line => ({
	id,
	x1,
	y1,
	x2,
	y2,
});
