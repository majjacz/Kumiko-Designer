import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useZoomPan } from "./useZoomPan";

describe("useZoomPan", () => {
	const cellSize = 10;
	const designWidth = 1000;
	const designHeight = 1000;
	const lines = new Map();

	it("should initialize with default zoom and pan", () => {
		const svgRef = { current: null };
		const contentGroupRef = { current: null };

		const { result } = renderHook(() =>
			useZoomPan({
				svgRef,
				contentGroupRef,
				lines,
				cellSize,
				designWidth,
				designHeight,
			}),
		);

		expect(result.current.state.zoom).toBe(40); // DEFAULT_ZOOM
		expect(result.current.state.panX).toBe(0);
		expect(result.current.state.panY).toBe(0);
		expect(typeof result.current.actions.resetView).toBe("function");
		expect(typeof result.current.actions.zoomBy).toBe("function");
	});

	it("should initialize with provided zoom/pan state", () => {
		const svgRef = { current: null };
		const contentGroupRef = { current: null };
		const zoomPanState = {
			zoom: 100,
			panX: 50,
			panY: 50,
		};

		const { result } = renderHook(() =>
			useZoomPan({
				svgRef,
				contentGroupRef,
				lines,
				cellSize,
				designWidth,
				designHeight,
				zoomPanState,
			}),
		);

		expect(result.current.state.zoom).toBe(100);
		expect(result.current.state.panX).toBe(50);
		expect(result.current.state.panY).toBe(50);
	});
});
