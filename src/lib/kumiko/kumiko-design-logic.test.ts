import { describe, expect, it } from "vitest";
import {
	computeDesignStrips,
	computeIntersections,
} from "./kumiko-design-logic";
import { makeLine } from "./test-fixtures";
import type { Intersection, Line } from "./types";

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

	it("does not create intersection for butting lines (both endpoints meet)", () => {
		const lines = new Map<string, Line>();
		// Horizontal line ends at (5, 0)
		lines.set("h", makeLine("h", 0, 0, 5, 0));
		// Vertical line starts at (5, 0)
		lines.set("v", makeLine("v", 5, 0, 5, 5));

		const intersections = computeIntersections(lines, new Map());

		// No intersection should be created because both lines meet at their endpoints
		expect(intersections.size).toBe(0);
	});

	it("does not create intersection for T-joint (one line butts against another)", () => {
		const lines = new Map<string, Line>();
		// Horizontal line goes through (5, 0)
		lines.set("h", makeLine("h", 0, 0, 10, 0));
		// Vertical line starts at (5, 0) - a T-joint where vertical butts against horizontal
		lines.set("v", makeLine("v", 5, 0, 5, 5));

		const intersections = computeIntersections(lines, new Map());

		// No intersection should be created because vertical line butts against horizontal
		// (no notch is needed - the vertical strip just ends at the horizontal strip)
		expect(intersections.size).toBe(0);
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

	it("produces same id for flipped strips (notch orientation invariance)", () => {
		// Two crossing lines: horizontal and vertical
		// The horizontal strip with a notch from the bottom is physically
		// identical to a vertical strip with a notch from the top when flipped.
		const lines1 = new Map<string, Line>();
		lines1.set("h", makeLine("h", 0, 0, 10, 0)); // horizontal
		lines1.set("v", makeLine("v", 5, -5, 5, 5)); // vertical crossing at (5,0)

		const intersectionStates = new Map<string, boolean>();
		const intersections1 = computeIntersections(lines1, intersectionStates);

		const gridCellSize = 1;
		const bitSize = 3.175;

		const strips1 = computeDesignStrips(
			lines1,
			intersections1,
			gridCellSize,
			bitSize,
		);

		// Find horizontal and vertical strips
		const horizontal = strips1.find((s) => s.y1 === s.y2);
		const vertical = strips1.find((s) => s.x1 === s.x2);

		if (!horizontal || !vertical) {
			throw new Error("Horizontal or vertical strip not found");
		}

		// Both strips have the same length and notch at the midpoint.
		// The only difference is fromTop (one is T, other is B).
		// They should have the same geometry ID because the strip can be flipped.
		expect(horizontal.id).toBe(vertical.id);
		expect(horizontal.displayCode).toBe(vertical.displayCode);
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
