import { describe, expect, it } from "vitest";
import type { DesignStrip, Group, Piece } from "./kumiko-core";
import { generateGroupSVG } from "./kumiko-svg-export";

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
	rotation: overrides?.rotation ?? 0,
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
			makePiece({ id: "p1", lineId: "s1", rotation: 0, x: 0, y: 0 }),
		);
		pieces.set(
			"p2",
			makePiece({ id: "p2", lineId: "s2", rotation: 0, x: 150, y: 0 }),
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
			makePiece({ id: "p1", lineId: "s1", rotation: 0, x: 0, y: 0 }),
		);
		piecesRow0.set(
			"p2",
			makePiece({ id: "p2", lineId: "s2", rotation: 0, x: 150, y: 0 }),
		);

		const piecesRow1 = new Map<string, Piece>();
		piecesRow1.set(
			"p3",
			makePiece({ id: "p3", lineId: "s1", rotation: 1, x: 0, y: 0 }),
		);
		piecesRow1.set(
			"p4",
			makePiece({ id: "p4", lineId: "s2", rotation: 1, x: 150, y: 0 }),
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
});
