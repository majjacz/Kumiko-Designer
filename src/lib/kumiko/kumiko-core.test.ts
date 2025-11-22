import { describe, expect, it } from "vitest";
import {
	convertUnit,
	findIntersection,
	formatValue,
	type Line,
} from "./kumiko-core";

describe("convertUnit()", () => {
	it("converts mm to in", () => {
		expect(convertUnit(25.4, "mm", "in")).toBeCloseTo(1, 5);
	});

	it("converts in to mm", () => {
		expect(convertUnit(1, "in", "mm")).toBeCloseTo(25.4, 5);
	});

	it("returns the same value when units are identical", () => {
		expect(convertUnit(10, "mm", "mm")).toBe(10);
		expect(convertUnit(3, "in", "in")).toBe(3);
	});

	it("handles zero without conversion noise", () => {
		expect(convertUnit(0, "mm", "in")).toBe(0);
		expect(convertUnit(0, "in", "mm")).toBe(0);
	});
});

describe("formatValue()", () => {
	it("formats mm with one decimal place", () => {
		expect(formatValue(10, "mm")).toBe("10.0");
		expect(formatValue(10.04, "mm")).toBe("10.0");
		expect(formatValue(10.05, "mm")).toBe("10.1");
	});

	it("formats inches with three decimal places", () => {
		expect(formatValue(25.4, "in")).toBe("1.000");
		expect(formatValue(12.7, "in")).toBe("0.500");
	});
});

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
});
