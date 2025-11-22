import { describe, expect, it } from "vitest";
import type { Intersection, Line, Point } from "./kumiko-core";
import {
	checkLineOverlap,
	computeDesignStrips,
	computeIntersections,
	findLineEndingAt,
} from "./kumiko-design-logic";

const makeLine = (
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

describe("computeIntersections()", () => {
	it("detects a single intersection with horizontal-over-vertical heuristic", () => {
		const lines = new Map<string, Line>();
		lines.set("h", makeLine("h", 0, 0, 10, 0));
		lines.set("v", makeLine("v", 5, -5, 5, 5));

		const intersectionStates = new Map<string, boolean>();
		const intersections = computeIntersections(lines, intersectionStates);

		expect(intersections.size).toBe(1);
		const int = Array.from(intersections.values())[0];

		expect(int.id).toBe("int_h_v");
		expect(int.line1Id).toBe("h");
		expect(int.line2Id).toBe("v");
		expect(int.x).toBe(5);
		expect(int.y).toBe(0);
		// horizontal line (h) should be on top by default
		expect(int.line1Over).toBe(true);
	});

	it("uses stored intersection state when present", () => {
		const lines = new Map<string, Line>();
		lines.set("h", makeLine("h", 0, 0, 10, 0));
		lines.set("v", makeLine("v", 5, -5, 5, 5));

		const intersectionStates = new Map<string, boolean>();
		intersectionStates.set("int_h_v", false);

		const intersections = computeIntersections(lines, intersectionStates);
		const int = Array.from(intersections.values())[0];

		expect(int.line1Over).toBe(false);
	});

	it("ensures only one intersection per coordinate", () => {
		const lines = new Map<string, Line>();
		lines.set("h", makeLine("h", 0, 0, 10, 0));
		// two vertical lines crossing at the same grid coordinate
		lines.set("v1", makeLine("v1", 5, -5, 5, 5));
		lines.set("v2", makeLine("v2", 5, -10, 5, 10));

		const intersections = computeIntersections(lines, new Map());

		expect(intersections.size).toBe(1);
	});
});

describe("computeDesignStrips()", () => {
	it("computes strip lengths and notches from intersections", () => {
		const lines = new Map<string, Line>();
		lines.set("h", makeLine("h", 0, 0, 10, 0));
		lines.set("v", makeLine("v", 5, -5, 5, 5));

		const intersectionStates = new Map<string, boolean>();
		const intersections = computeIntersections(lines, intersectionStates);

		const gridCellSize = 1; // 1 unit == 1 mm
		const bitSize = 3.175;
		const strips = computeDesignStrips(
			lines,
			intersections,
			gridCellSize,
			bitSize,
		);

		// both strips should be non-degenerate and present
		expect(strips).toHaveLength(2);

		// Identify horizontal vs vertical strips by orientation, not by id
		const horizontal = strips.find((s) => s.y1 === s.y2 && s.x1 !== s.x2);
		const vertical = strips.find((s) => s.x1 === s.x2 && s.y1 !== s.y2);

		if (!horizontal || !vertical) {
			throw new Error("Horizontal or vertical strip not found");
		}

		expect(horizontal.lengthMM).toBeCloseTo(10, 5);
		expect(vertical.lengthMM).toBeCloseTo(10, 5);

		expect(horizontal.notches).toHaveLength(1);
		expect(vertical.notches).toHaveLength(1);

		expect(horizontal.notches[0].otherLineId).toBe("v");
		expect(vertical.notches[0].otherLineId).toBe("h");

		// distances from respective start points should both be 5 mm
		expect(horizontal.notches[0].dist).toBeCloseTo(5, 5);
		expect(vertical.notches[0].dist).toBeCloseTo(5, 5);

		// with horizontal on top, vertical should get a notch from the top,
		// horizontal from the bottom
		expect(horizontal.notches[0].fromTop).toBe(false);
		expect(vertical.notches[0].fromTop).toBe(true);
	});

	it("produces stable geometry-based ids for identical strip geometry", () => {
		// First map: line from (0,0) to (10,0)
		const lines1 = new Map<string, Line>();
		lines1.set("a", makeLine("a", 0, 0, 10, 0));

		// Second map: same physical segment but reversed and with a different id
		const lines2 = new Map<string, Line>();
		lines2.set("b", makeLine("b", 10, 0, 0, 0));

		const intersections = new Map<string, Intersection>();
		const gridCellSize = 1;
		const bitSize = 3.175;
	
		const strips1 = computeDesignStrips(
			lines1,
			intersections,
			gridCellSize,
			bitSize,
		);
		const strips2 = computeDesignStrips(
			lines2,
			intersections,
			gridCellSize,
			bitSize,
		);

		expect(strips1).toHaveLength(1);
		expect(strips2).toHaveLength(1);

		// Geometry-derived ids should be identical even though sourceLineId and
		// orientation differ.
		expect(strips1[0].id).toBe(strips2[0].id);
		expect(strips1[0].sourceLineId).toBe("a");
		expect(strips2[0].sourceLineId).toBe("b");
	});

	it("filters out degenerate short strips", () => {
		const lines = new Map<string, Line>();
		// ~0.5 mm long segment
		lines.set("short", makeLine("short", 0, 0, 0.5, 0));

		const intersections = new Map<string, Intersection>();
		const gridCellSize = 1;
		const bitSize = 3.175;
	
		const strips = computeDesignStrips(
			lines,
			intersections,
			gridCellSize,
			bitSize,
		);

		expect(strips).toHaveLength(0);
	});
});

describe("findLineEndingAt()", () => {
	it("finds a line whose end matches the given point", () => {
		const lines = new Map<string, Line>();
		const target = makeLine("target", 0, 0, 5, 5);
		lines.set("a", makeLine("a", 0, 0, 1, 1));
		lines.set("target", target);

		const point: Point = { x: 5, y: 5 };
		const result = findLineEndingAt(lines, point);

		expect(result).toEqual(target);
	});

	it("returns null when no line ends at the given point", () => {
		const lines = new Map<string, Line>();
		lines.set("a", makeLine("a", 0, 0, 1, 1));

		const point: Point = { x: 5, y: 5 };
		const result = findLineEndingAt(lines, point);

		expect(result).toBeNull();
	});
});

describe("checkLineOverlap()", () => {
	it("detects overlapping collinear segments and returns parametric range", () => {
		const lines = new Map<string, Line>();
		// base line from 0 to 10 on the x-axis
		const base = makeLine("base", 0, 0, 10, 0);
		lines.set(base.id, base);

		// candidate overlapping segment from x=2 to x=8
		const start: Point = { x: 2, y: 0 };
		const end: Point = { x: 8, y: 0 };

		const overlap = checkLineOverlap(lines, start, end);

		expect(overlap).not.toBeNull();
		expect(overlap?.line).toEqual(base);
		expect(overlap?.tStart).toBeCloseTo(0.2, 5);
		expect(overlap?.tEnd).toBeCloseTo(0.8, 5);
	});

	it("ignores segments that only touch at endpoints", () => {
		const lines = new Map<string, Line>();
		const base = makeLine("base", 0, 0, 10, 0);
		lines.set(base.id, base);

		// candidate starts exactly at the end of the base line
		const start: Point = { x: 10, y: 0 };
		const end: Point = { x: 15, y: 0 };

		const overlap = checkLineOverlap(lines, start, end);

		expect(overlap).toBeNull();
	});

	it("ignores non-collinear segments", () => {
		const lines = new Map<string, Line>();
		const base = makeLine("base", 0, 0, 10, 0);
		lines.set(base.id, base);

		const start: Point = { x: 0, y: 1 };
		const end: Point = { x: 10, y: 1 };

		const overlap = checkLineOverlap(lines, start, end);

		expect(overlap).toBeNull();
	});
});
