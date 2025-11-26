/**
 * Layout helper functions for computing strip layouts.
 * These are pure functions that can be used by both components and tests.
 */

import type { DesignStrip, Piece } from "./types";

/**
 * Generate a unique key for a strip based on its configuration.
 * Accounts for horizontal and vertical flips - strips are the same if:
 * 1. Same length
 * 2. Same notch positions (measured from edge)
 * 3. Same notch orientations (after accounting for possible flips)
 */
export function getStripConfigKey(strip: DesignStrip): string {
	const length = strip.lengthMM;

	// Generate all 4 possible orientations of the strip
	const orientations = [
		// Original
		strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "T" : "B"}`),
		// Horizontal flip: distances measured from other end
		strip.notches.map(
			(n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "T" : "B"}`,
		),
		// Vertical flip: top becomes bottom
		strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "B" : "T"}`),
		// Both flips
		strip.notches.map(
			(n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "B" : "T"}`,
		),
	];

	// Sort notches within each orientation and join
	const orientationKeys = orientations.map((notches) =>
		notches.sort().join("|"),
	);

	// Use the lexicographically smallest representation as canonical form
	const canonicalNotchesKey = orientationKeys.sort()[0];

	return `${length.toFixed(2)}_${canonicalNotchesKey}`;
}

/**
 * Compute layout rows with kerf-adjusted positions.
 */
export function computeKerfedLayoutRows(
	pieces: Piece[],
	designStrips: DesignStrip[],
	bitSize: number,
): Map<number, Piece[]> {
	const rows = new Map<number, Piece[]>();
	for (const piece of pieces) {
		const rowIndex = piece.rowIndex;
		if (!rows.has(rowIndex)) {
			rows.set(rowIndex, []);
		}
		const rowPiecesForIndex = rows.get(rowIndex);
		if (rowPiecesForIndex) {
			rowPiecesForIndex.push(piece);
		}
	}

	// Sort pieces in each row by x position to establish order
	for (const rowPieces of rows.values()) {
		rowPieces.sort((a, b) => a.x - b.x);
	}

	// Create new pieces with adjusted x positions for kerf
	const adjustedRows = new Map<number, Piece[]>();
	for (const [rowIndex, rowPieces] of rows) {
		const adjustedPieces: Piece[] = [];
		let currentX = 0;
		for (const piece of rowPieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (strip) {
				adjustedPieces.push({ ...piece, x: currentX });
				currentX += strip.lengthMM + bitSize;
			}
		}
		adjustedRows.set(rowIndex, adjustedPieces);
	}

	return adjustedRows;
}

/**
 * Compute the total length of each row based on pieces and strips.
 */
export function computeRowLengths(
	layoutData: Map<number, Piece[]>,
	designStrips: DesignStrip[],
): Map<number, number> {
	const lengths = new Map<number, number>();
	for (const [rowIndex, rowPieces] of layoutData) {
		let rowLength = 0;
		if (rowPieces.length > 0) {
			const lastPiece = rowPieces[rowPieces.length - 1];
			const strip = designStrips.find((s) => s.id === lastPiece.lineId);
			if (strip) {
				// The length is the x of the last piece + its length.
				// The space after is not part of the length.
				rowLength = lastPiece.x + strip.lengthMM;
			}
		}
		lengths.set(rowIndex, rowLength);
	}
	return lengths;
}

/**
 * Validate if a strip can be placed at a given position within stock constraints.
 */
export function validateStripPlacement(
	stripLength: number,
	startPosition: number,
	stockLength: number,
	stripWidth: number,
): boolean {
	const stripEnd = startPosition + stripLength;
	const allowedOverhang = stripWidth / 2;
	return stripEnd <= stockLength + allowedOverhang;
}
