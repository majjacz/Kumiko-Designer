import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGridCoordinates } from "./useGridCoordinates";

describe("useGridCoordinates", () => {
	const cellSize = 10;
	const gridExtentCells = 100;

	it("should convert grid coordinates to SVG coordinates", () => {
		const svgRef = { current: null };
		const contentGroupRef = { current: null };

		const { result } = renderHook(() =>
			useGridCoordinates({
				svgRef,
				contentGroupRef,
				cellSize,
				gridExtentCells,
			}),
		);

		const svgPoint = result.current.gridToSvg({ x: 5, y: 5 });
		expect(svgPoint).toEqual({ x: 50, y: 50 });
	});

	it("should convert screen coordinates to grid coordinates", () => {
		// Mock SVG elements and methods
		const mockMatrix = {
			inverse: () => ({
				a: 1,
				b: 0,
				c: 0,
				d: 1,
				e: 0,
				f: 0,
				multiply: () => {},
			}),
		};

		const mockPoint = {
			x: 0,
			y: 0,
			matrixTransform: (_matrix: DOMMatrix) => ({ x: 50, y: 50 }), // Mock result: 50px -> 5 grid units
		};

		const mockSvg = {
			createSVGPoint: () => mockPoint,
			getScreenCTM: () => mockMatrix,
		} as unknown as SVGSVGElement;

		const svgRef = { current: mockSvg };
		const contentGroupRef = { current: null };

		const { result } = renderHook(() =>
			useGridCoordinates({
				svgRef,
				contentGroupRef,
				cellSize,
				gridExtentCells,
			}),
		);

		const gridPoint = result.current.screenToGrid(100, 100); // Inputs don't matter due to mock
		expect(gridPoint).toEqual({ x: 5, y: 5 });
	});

	it("should return null if screen coordinates are out of bounds", () => {
		const mockMatrix = {
			inverse: () => ({}),
		};

		const mockPoint = {
			x: 0,
			y: 0,
			matrixTransform: () => ({ x: -10, y: -10 }), // Out of bounds
		};

		const mockSvg = {
			createSVGPoint: () => mockPoint,
			getScreenCTM: () => mockMatrix,
		} as unknown as SVGSVGElement;

		const svgRef = { current: mockSvg };
		const contentGroupRef = { current: null };

		const { result } = renderHook(() =>
			useGridCoordinates({
				svgRef,
				contentGroupRef,
				cellSize,
				gridExtentCells,
			}),
		);

		const gridPoint = result.current.screenToGrid(0, 0);
		expect(gridPoint).toBeNull();
	});
});
