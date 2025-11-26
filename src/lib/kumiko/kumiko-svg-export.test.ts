import { describe, expect, it } from "vitest";
import type { DesignStrip, Group, Piece } from "./kumiko-core";
import {
	generateGroupSVG,
	hasDoubleSidedStrips,
} from "./kumiko-svg-export";

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
	// Short, user-friendly display code; tests can override if needed.
	displayCode: overrides?.displayCode ?? "CODE",
});

const makePiece = (overrides?: Partial<Piece>): Piece => ({
	id: overrides?.id ?? "piece",
	lineId: overrides?.lineId ?? "strip",
	x: overrides?.x ?? 0,
	y: overrides?.y ?? 0,
	rowIndex: overrides?.rowIndex ?? 0,
});

const makeGroup = (overrides?: Partial<Group>): Group => ({
	id: overrides?.id ?? "g1",
	name: overrides?.name ?? "Group 1",
	pieces: overrides?.pieces ?? new Map(),
	fullCuts: overrides?.fullCuts ?? new Map(),
});

const countOccurrences = (haystack: string, needle: string): number =>
	haystack.split(needle).length - 1;

describe("generateGroupSVG()", () => {
	it("returns null when group is missing or has no pieces", () => {
		const strips: DesignStrip[] = [];
		const stockLength = 300;
		const bitSize = 2;

		expect(
			generateGroupSVG({
				group: undefined,
				designStrips: strips,
				bitSize,
				stockLength,
			}),
		).toBeNull();

		const emptyGroup = makeGroup({ pieces: new Map() });
		expect(
			generateGroupSVG({
				group: emptyGroup,
				designStrips: strips,
				bitSize,
				stockLength,
			}),
		).toBeNull();
	});

	it("emits cut and notch lines at expected counts for a simple layout", () => {
		const strips: DesignStrip[] = [
			makeStrip({
				id: "s1",
				lengthMM: 100,
				notches: [
					{ id: "s1n1", otherLineId: "x", dist: 10, fromTop: true },
					{ id: "s1n2", otherLineId: "x", dist: 60, fromTop: false },
				],
			}),
			makeStrip({
				id: "s2",
				lengthMM: 50,
				notches: [{ id: "s2n1", otherLineId: "x", dist: 25, fromTop: true }],
			}),
		];

		const pieces = new Map<string, Piece>();
		pieces.set(
			"p1",
			makePiece({ id: "p1", lineId: "s1", rowIndex: 0, x: 0, y: 0 }),
		);
		pieces.set(
			"p2",
			makePiece({ id: "p2", lineId: "s2", rowIndex: 0, x: 150, y: 0 }),
		);

		const group = makeGroup({ pieces });
		const stockLength = 300;
		const bitSize = 2;

		const svg = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
		});
		expect(svg).not.toBeNull();

		const svgString = svg as string;
		expect(svgString).toContain("<svg");
		expect(svgString).toContain("<line");

		// Two strips -> 3 cut columns (start, between strips, end)
		const cutCount = countOccurrences(svgString, 'stroke="#000000"');
		expect(cutCount).toBe(3);

		// Three notches total across both strips
		const notchCount = countOccurrences(svgString, 'stroke="#808080"');
		expect(notchCount).toBe(3);

		// Bounding box uses stockLength in cm (300mm -> 30.000cm)
		expect(svgString).toContain('width="30.000"');
	});

	it("merges vertical segments across multiple rows at the same X coordinate", () => {
		const strips: DesignStrip[] = [
			makeStrip({ id: "s1", lengthMM: 100 }),
			makeStrip({ id: "s2", lengthMM: 50 }),
		];

		const piecesRow0 = new Map<string, Piece>();
		piecesRow0.set(
			"p1",
			makePiece({ id: "p1", lineId: "s1", rowIndex: 0, x: 0, y: 0 }),
		);
		piecesRow0.set(
			"p2",
			makePiece({ id: "p2", lineId: "s2", rowIndex: 0, x: 150, y: 0 }),
		);

		const piecesRow1 = new Map<string, Piece>();
		piecesRow1.set(
			"p3",
			makePiece({ id: "p3", lineId: "s1", rowIndex: 1, x: 0, y: 0 }),
		);
		piecesRow1.set(
			"p4",
			makePiece({ id: "p4", lineId: "s2", rowIndex: 1, x: 150, y: 0 }),
		);

		const allPieces = new Map<string, Piece>([...piecesRow0, ...piecesRow1]);
		const group = makeGroup({ pieces: allPieces });

		const stockLength = 300;
		const bitSize = 2;
		const svg = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
		});
		expect(svg).not.toBeNull();

		const svgString = svg as string;

		// Even with two rows, the number of cut columns should match the simple case
		const cutCount = countOccurrences(svgString, 'stroke="#000000"');
		expect(cutCount).toBe(3);
	});

	it("handles double-sided strips correctly", () => {
		const strips: DesignStrip[] = [
			makeStrip({
				id: "s1",
				lengthMM: 100,
				notches: [
					{ id: "n1", otherLineId: "x", dist: 10, fromTop: true },
					{ id: "n2", otherLineId: "x", dist: 60, fromTop: false },
				],
			}),
		];

		const pieces = new Map<string, Piece>();
		pieces.set(
			"p1",
			makePiece({ id: "p1", lineId: "s1", rowIndex: 0, x: 0, y: 0 }),
		);

		const group = makeGroup({ pieces });
		const stockLength = 300;
		const bitSize = 2;

		// Check detection
		expect(hasDoubleSidedStrips(group, strips)).toBe(true);

		// Pass 1: Top
		const svgTop = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "top",
		});
		expect(svgTop).not.toBeNull();
		// Should have 0 cuts (profile) and 1 notch (top).

		// Pass 2: Bottom
		const svgBottom = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "bottom",
		});
		expect(svgBottom).not.toBeNull();
		// Should have 2 cuts (profile) and 1 notch (bottom).
	});

	it("inverts notch direction when flip is true", () => {
		// Create a strip with one bottom notch
		const strips: DesignStrip[] = [
			makeStrip({
				id: "s1",
				lengthMM: 100,
				notches: [
					{ id: "n1", otherLineId: "x", dist: 50, fromTop: false }, // Bottom notch
				],
			}),
		];

		const pieces = new Map<string, Piece>();
		pieces.set(
			"p1",
			makePiece({ id: "p1", lineId: "s1", rowIndex: 0, x: 0, y: 0 }),
		);

		const group = makeGroup({ pieces });
		const stockLength = 200;
		const bitSize = 2;

		// 1. Generate with pass="top", flip=false (should be empty of notches because it's a bottom notch)
		const svgNormal = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "top",
			flip: false,
		}) as string;

		// 2. Generate with pass="top", flip=true (should have notches because bottom became top)
		const svgFlipped = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "top",
			flip: true,
		}) as string;

		// Check that normal has no notch lines (grey)
		// Note: It might still have cut lines (black) if they are emitted in top pass?
		// Actually, looking at code: "Only add profile cuts if we are in "all" or "bottom" pass."
		// So top pass should have NO cut lines either.
		
		// So svgNormal might be null or just the bounding box?
		// If cutsByX is empty, it returns null.
		// If there are no notches and no cuts, it returns null.
		
		expect(svgNormal).toBeNull();

		// Flipped should have the notch
		expect(svgFlipped).not.toBeNull();
		expect(svgFlipped).toContain('stroke="#808080"'); // Notch color
	});

	it("inverts top notch to bottom notch when flip is true", () => {
		// Create a strip with one top notch
		const strips: DesignStrip[] = [
			makeStrip({
				id: "s2",
				lengthMM: 100,
				notches: [
					{ id: "n2", otherLineId: "x", dist: 50, fromTop: true }, // Top notch
				],
			}),
		];

		const pieces = new Map<string, Piece>();
		pieces.set(
			"p2",
			makePiece({ id: "p2", lineId: "s2", rowIndex: 0, x: 0, y: 0 }),
		);

		const group = makeGroup({ pieces });
		const stockLength = 200;
		const bitSize = 2;

		// 1. Generate with pass="bottom", flip=false (should be empty of notches because it's a top notch)
		// Note: "bottom" pass usually includes profile cuts.
		// So we expect cuts, but NO notches.
		const svgNormal = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "bottom",
			flip: false,
		}) as string;

		expect(svgNormal).not.toBeNull();
		// Should have cuts (black)
		expect(svgNormal).toContain('stroke="#000000"');
		// Should NOT have notches (grey)
		expect(svgNormal).not.toContain('stroke="#808080"');

		// 2. Generate with pass="bottom", flip=true (should have notches because top became bottom)
		const svgFlipped = generateGroupSVG({
			group,
			designStrips: strips,
			bitSize,
			stockLength,
			pass: "bottom",
			flip: true,
		}) as string;

		expect(svgFlipped).not.toBeNull();
		// Should have cuts
		expect(svgFlipped).toContain('stroke="#000000"');
		// Should HAVE notches
		expect(svgFlipped).toContain('stroke="#808080"');
	});
});
