import { describe, expect, it } from "vitest";
import {
	computeLineOverlapForSingleLine,
	distancePointToSegment,
	findIntersection,
	gcd,
} from "./geometry";
import type { Line } from "./kumiko-core";

describe("findIntersection()", () => {
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

	it("returns an intersection point for crossing segments", () => {
		const h = makeLine("h", 0, 0, 10, 0);
		const v = makeLine("v", 5, -5, 5, 5);

		const p = findIntersection(h, v);

		expect(p).not.toBeNull();
		expect(p).toEqual({ x: 5, y: 0 });
	});

	it("returns null for parallel segments", () => {
		const a = makeLine("a", 0, 0, 10, 0);
		const b = makeLine("b", 0, 1, 10, 1);

		expect(findIntersection(a, b)).toBeNull();
	});

	it("returns null when lines would intersect outside segment ranges", () => {
		const short = makeLine("short", 0, 0, 1, 0);
		const far = makeLine("far", 5, -1, 5, 1);

		expect(findIntersection(short, far)).toBeNull();
	});

	it("returns intersection at segment endpoints", () => {
		const h = makeLine("h", 0, 0, 5, 0);
		const v = makeLine("v", 5, 0, 5, 5);

		const p = findIntersection(h, v);

		expect(p).toEqual({ x: 5, y: 0 });
	});

	it("handles diagonal lines", () => {
		const d1 = makeLine("d1", 0, 0, 10, 10);
		const d2 = makeLine("d2", 0, 10, 10, 0);

		const p = findIntersection(d1, d2);

		expect(p).toEqual({ x: 5, y: 5 });
	});
});

describe("computeLineOverlapForSingleLine()", () => {
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

	it("returns null for non-collinear segments", () => {
		const line = makeLine("h", 0, 0, 10, 0);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 0, y: 1 },
			{ x: 10, y: 1 },
		);

		expect(result).toBeNull();
	});

	it("returns null for collinear but non-overlapping segments", () => {
		const line = makeLine("h", 0, 0, 10, 0);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 15, y: 0 },
			{ x: 20, y: 0 },
		);

		expect(result).toBeNull();
	});

	it("returns overlap for collinear overlapping segments", () => {
		const line = makeLine("h", 0, 0, 10, 0);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 5, y: 0 },
			{ x: 15, y: 0 },
		);

		expect(result).not.toBeNull();
		expect(result?.tStart).toBeCloseTo(0.5);
		expect(result?.tEnd).toBeCloseTo(1);
	});

	it("returns overlap for segment fully inside line", () => {
		const line = makeLine("h", 0, 0, 10, 0);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 2, y: 0 },
			{ x: 8, y: 0 },
		);

		expect(result).not.toBeNull();
		expect(result?.tStart).toBeCloseTo(0.2);
		expect(result?.tEnd).toBeCloseTo(0.8);
	});

	it("returns null for segments that only touch at endpoints", () => {
		const line = makeLine("h", 0, 0, 10, 0);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 10, y: 0 },
			{ x: 15, y: 0 },
		);

		expect(result).toBeNull();
	});

	it("handles vertical lines", () => {
		const line = makeLine("v", 5, 0, 5, 10);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 5, y: 3 },
			{ x: 5, y: 7 },
		);

		expect(result).not.toBeNull();
		expect(result?.tStart).toBeCloseTo(0.3);
		expect(result?.tEnd).toBeCloseTo(0.7);
	});

	it("returns null for degenerate (zero-length) base line", () => {
		const line = makeLine("point", 5, 5, 5, 5);
		const result = computeLineOverlapForSingleLine(
			line,
			{ x: 5, y: 5 },
			{ x: 10, y: 5 },
		);

		expect(result).toBeNull();
	});
});

describe("gcd()", () => {
	it("returns the gcd of two positive numbers", () => {
		expect(gcd(12, 8)).toBe(4);
		expect(gcd(15, 5)).toBe(5);
		expect(gcd(7, 3)).toBe(1);
	});

	it("handles negative numbers", () => {
		expect(gcd(-12, 8)).toBe(4);
		expect(gcd(12, -8)).toBe(4);
		expect(gcd(-12, -8)).toBe(4);
	});

	it("handles zero", () => {
		expect(gcd(0, 5)).toBe(5);
		expect(gcd(5, 0)).toBe(5);
		expect(gcd(0, 0)).toBe(1); // Returns 1 for (0,0) to avoid division by zero
	});

	it("returns 1 for coprime numbers", () => {
		expect(gcd(17, 13)).toBe(1);
		expect(gcd(8, 9)).toBe(1);
	});
});

describe("distancePointToSegment()", () => {
	it("returns perpendicular distance when projection is on segment", () => {
		// Point (5, 3) to horizontal segment from (0, 0) to (10, 0)
		const d = distancePointToSegment(5, 3, 0, 0, 10, 0);
		expect(d).toBeCloseTo(3);
	});

	it("returns distance to start point when projection is before segment", () => {
		// Point (-2, 0) to horizontal segment from (0, 0) to (10, 0)
		const d = distancePointToSegment(-2, 0, 0, 0, 10, 0);
		expect(d).toBeCloseTo(2);
	});

	it("returns distance to end point when projection is after segment", () => {
		// Point (12, 0) to horizontal segment from (0, 0) to (10, 0)
		const d = distancePointToSegment(12, 0, 0, 0, 10, 0);
		expect(d).toBeCloseTo(2);
	});

	it("returns 0 when point is on the segment", () => {
		const d = distancePointToSegment(5, 0, 0, 0, 10, 0);
		expect(d).toBeCloseTo(0);
	});

	it("handles diagonal segments", () => {
		// Point (0, 5) to diagonal segment from (0, 0) to (10, 10)
		// Perpendicular distance to line y=x from (0, 5) is 5/sqrt(2)
		const d = distancePointToSegment(0, 5, 0, 0, 10, 10);
		expect(d).toBeCloseTo(5 / Math.sqrt(2));
	});

	it("handles vertical segments", () => {
		// Point (3, 5) to vertical segment from (0, 0) to (0, 10)
		const d = distancePointToSegment(3, 5, 0, 0, 0, 10);
		expect(d).toBeCloseTo(3);
	});

	it("returns distance to nearest endpoint for point beyond segment", () => {
		// Point (5, 15) to vertical segment from (0, 0) to (0, 10)
		const d = distancePointToSegment(5, 15, 0, 0, 0, 10);
		expect(d).toBeCloseTo(Math.hypot(5, 5));
	});
});
