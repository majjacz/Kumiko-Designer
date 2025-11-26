import { describe, expect, it } from "vitest";
import { convertUnit, formatValue } from "./kumiko-core";

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

// findIntersection tests moved to geometry.test.ts
