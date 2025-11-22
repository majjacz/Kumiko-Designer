import { describe, expect, it } from "vitest";
import type { DesignStrip, Piece } from "./kumiko-core";
import {
	computeKerfedLayoutRows,
	computeRowLengths,
	GRID_CELL_HEIGHT,
	getStripConfigKey,
	validateStripPlacement,
} from "./kumiko-layout-editor";

const makeStrip = (overrides?: Partial<DesignStrip>): DesignStrip => ({
	id: overrides?.id ?? "strip",
	x1: overrides?.x1 ?? 0,
	y1: overrides?.y1 ?? 0,
	x2: overrides?.x2 ?? 100,
	y2: overrides?.y2 ?? 0,
	lengthMM: overrides?.lengthMM ?? 100,
	notches: overrides?.notches ?? [],
	// Test helper: default sourceLineId to the same value as id unless overridden.
	sourceLineId: overrides?.sourceLineId ?? overrides?.id ?? "strip",
	// Simple default display code; tests can override when needed.
	displayCode: overrides?.displayCode ?? "CODE",
});

const makePiece = (overrides?: Partial<Piece>): Piece => ({
	id: overrides?.id ?? "piece",
	lineId: overrides?.lineId ?? "strip",
	x: overrides?.x ?? 0,
	y: overrides?.y ?? 0,
	rotation: overrides?.rotation ?? 0,
});

describe("getStripConfigKey()", () => {
	it("treats strips with flipped orientations as equivalent", () => {
		const base: DesignStrip = makeStrip({
			id: "base",
			lengthMM: 100,
			notches: [
				{ id: "n1", otherLineId: "x", dist: 10, fromTop: true },
				{ id: "n2", otherLineId: "x", dist: 50, fromTop: false },
				{ id: "n3", otherLineId: "x", dist: 90, fromTop: true },
			],
		});

		const horizontalFlip: DesignStrip = makeStrip({
			id: "hflip",
			lengthMM: 100,
			notches: [
				{ id: "n1", otherLineId: "x", dist: 90, fromTop: true },
				{ id: "n2", otherLineId: "x", dist: 50, fromTop: false },
				{ id: "n3", otherLineId: "x", dist: 10, fromTop: true },
			],
		});

		const verticalFlip: DesignStrip = makeStrip({
			id: "vflip",
			lengthMM: 100,
			notches: [
				{ id: "n1", otherLineId: "x", dist: 10, fromTop: false },
				{ id: "n2", otherLineId: "x", dist: 50, fromTop: true },
				{ id: "n3", otherLineId: "x", dist: 90, fromTop: false },
			],
		});

		const bothFlip: DesignStrip = makeStrip({
			id: "both",
			lengthMM: 100,
			notches: [
				{ id: "n1", otherLineId: "x", dist: 90, fromTop: false },
				{ id: "n2", otherLineId: "x", dist: 50, fromTop: true },
				{ id: "n3", otherLineId: "x", dist: 10, fromTop: false },
			],
		});

		const keyBase = getStripConfigKey(base);
		expect(getStripConfigKey(horizontalFlip)).toBe(keyBase);
		expect(getStripConfigKey(verticalFlip)).toBe(keyBase);
		expect(getStripConfigKey(bothFlip)).toBe(keyBase);
	});

	it("distinguishes strips with different notch patterns", () => {
		const a: DesignStrip = makeStrip({
			id: "a",
			lengthMM: 100,
			notches: [{ id: "n1", otherLineId: "x", dist: 10, fromTop: true }],
		});

		const b: DesignStrip = makeStrip({
			id: "b",
			lengthMM: 100,
			notches: [{ id: "n1", otherLineId: "x", dist: 20, fromTop: true }],
		});

		expect(getStripConfigKey(a)).not.toBe(getStripConfigKey(b));
	});
});

describe("computeKerfedLayoutRows()", () => {
	it("sorts pieces by x within each row and applies kerf spacing", () => {
		const strips: DesignStrip[] = [
			makeStrip({ id: "s1", lengthMM: 100 }),
			makeStrip({ id: "s2", lengthMM: 50 }),
		];

		const pieces: Piece[] = [
			// out of order x to verify sorting
			makePiece({ id: "p2", lineId: "s2", rotation: 0, x: 200, y: 0 }),
			makePiece({ id: "p1", lineId: "s1", rotation: 0, x: 0, y: 0 }),
		];

		const bitSize = 2;
		const rows = computeKerfedLayoutRows(pieces, strips, bitSize);

		const row0 = rows.get(0);
		expect(row0).toBeDefined();
		expect(row0?.map((p) => p.id)).toEqual(["p1", "p2"]);

		// first piece should start at x = 0
		expect(row0?.[0].x).toBe(0);
		// second piece should start after first strip length + kerf
		expect(row0?.[1].x).toBe(100 + bitSize);
	});

	it("separates pieces into distinct rows by rotation", () => {
		const strips: DesignStrip[] = [makeStrip({ id: "s1", lengthMM: 100 })];

		const pieces: Piece[] = [
			makePiece({ id: "p0", lineId: "s1", rotation: 0 }),
			makePiece({ id: "p1", lineId: "s1", rotation: 1 }),
		];

		const rows = computeKerfedLayoutRows(pieces, strips, 2);

		expect(rows.get(0)).toHaveLength(1);
		expect(rows.get(1)).toHaveLength(1);
	});
});

describe("computeRowLengths()", () => {
	it("computes per-row physical lengths from layout data", () => {
		const strips: DesignStrip[] = [
			makeStrip({ id: "s1", lengthMM: 100 }),
			makeStrip({ id: "s2", lengthMM: 50 }),
		];

		const pieces: Piece[] = [
			makePiece({ id: "p1", lineId: "s1", rotation: 0 }),
			makePiece({ id: "p2", lineId: "s2", rotation: 0 }),
		];

		const bitSize = 2;
		const layoutRows = computeKerfedLayoutRows(pieces, strips, bitSize);

		const lengths = computeRowLengths(layoutRows, strips);
		const lengthRow0 = lengths.get(0);

		// row length is lastPiece.x + its strip length
		expect(lengthRow0).toBe(100 + bitSize + 50);
	});

	it("returns zero length for empty rows", () => {
		const strips: DesignStrip[] = [makeStrip({ id: "s1", lengthMM: 100 })];
		const layoutRows = new Map<number, Piece[]>();
		layoutRows.set(0, []);

		const lengths = computeRowLengths(layoutRows, strips);

		expect(lengths.get(0)).toBe(0);
	});
});

describe("GRID_CELL_HEIGHT", () => {
	it("defines the row height used in layout rendering", () => {
		expect(GRID_CELL_HEIGHT).toBeGreaterThan(0);
	});
});

describe("validateStripPlacement()", () => {
	const stockLength = 100;
	const stripWidth = 20; // GRID_CELL_HEIGHT

	it("allows placement within stock length", () => {
		// Strip length 50, start 0 -> end 50 <= 100
		expect(validateStripPlacement(50, 0, stockLength, stripWidth)).toBe(true);
	});

	it("allows placement exactly at stock length", () => {
		// Strip length 50, start 50 -> end 100 <= 100
		expect(validateStripPlacement(50, 50, stockLength, stripWidth)).toBe(true);
	});

	it("allows placement with small overhang (<= half width)", () => {
		// Strip length 50, start 55 -> end 105. Overhang 5. Half width 10. 5 <= 10.
		expect(validateStripPlacement(50, 55, stockLength, stripWidth)).toBe(true);

		// Exact boundary
		// Strip length 50, start 60 -> end 110. Overhang 10. Half width 10. 10 <= 10.
		expect(validateStripPlacement(50, 60, stockLength, stripWidth)).toBe(true);
	});

	it("disallows placement with large overhang (> half width)", () => {
		// Strip length 50, start 61 -> end 111. Overhang 11. Half width 10. 11 > 10.
		expect(validateStripPlacement(50, 61, stockLength, stripWidth)).toBe(false);
	});
});
