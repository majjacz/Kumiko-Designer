import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useKumikoDesign } from "./useKumikoDesign";

describe("useKumikoDesign", () => {
	const gridCellSize = 10;
	const bitSize = 3.175;

	it("should initialize with empty state", () => {
		const { result } = renderHook(() =>
			useKumikoDesign(gridCellSize, bitSize),
		);

		expect(result.current.state.lines.size).toBe(0);
		expect(result.current.state.intersections.size).toBe(0);
		expect(result.current.state.designStrips.length).toBe(0);
		expect(result.current.state.drawingLine).toBeNull();
	});

	it("should add a line when creating a line", () => {
		const { result } = renderHook(() =>
			useKumikoDesign(gridCellSize, bitSize),
		);

		act(() => {
			result.current.actions.handleCreateLine({ x: 0, y: 0 }, { x: 10, y: 0 });
		});

		expect(result.current.state.lines.size).toBe(1);
		const line = Array.from(result.current.state.lines.values())[0];
		expect(line.x1).toBe(0);
		expect(line.y1).toBe(0);
		expect(line.x2).toBe(10);
		expect(line.y2).toBe(0);
	});

	it("should handle drawing state", () => {
		const { result } = renderHook(() =>
			useKumikoDesign(gridCellSize, bitSize),
		);

		act(() => {
			result.current.actions.handleGridClick({ x: 0, y: 0 });
		});

		expect(result.current.state.drawingLine).toEqual({ x: 0, y: 0 });

		act(() => {
			result.current.actions.handleGridClick({ x: 10, y: 0 });
		});

		expect(result.current.state.drawingLine).toBeNull();
		expect(result.current.state.lines.size).toBe(1);
	});

	it("should clear the design", () => {
		const { result } = renderHook(() =>
			useKumikoDesign(gridCellSize, bitSize),
		);

		act(() => {
			result.current.actions.handleCreateLine({ x: 0, y: 0 }, { x: 10, y: 0 });
		});
		expect(result.current.state.lines.size).toBe(1);

		act(() => {
			result.current.actions.clearDesignState();
		});
		expect(result.current.state.lines.size).toBe(0);
		expect(result.current.state.intersections.size).toBe(0);
	});

	it("should toggle intersection state", () => {
		const { result } = renderHook(() =>
			useKumikoDesign(gridCellSize, bitSize),
		);

		// Create two crossing lines to generate an intersection
		act(() => {
			result.current.actions.handleCreateLine({ x: 0, y: 5 }, { x: 10, y: 5 }); // Horizontal
			result.current.actions.handleCreateLine({ x: 5, y: 0 }, { x: 5, y: 10 }); // Vertical
		});

		expect(result.current.state.intersections.size).toBe(1);
		const intersectionId = Array.from(
			result.current.state.intersections.keys(),
		)[0];
		const initialOver =
			result.current.state.intersections.get(intersectionId)?.line1Over;

		act(() => {
			result.current.actions.toggleIntersection(intersectionId);
		});

		const toggledOver =
			result.current.state.intersections.get(intersectionId)?.line1Over;
		expect(toggledOver).toBe(!initialOver);
	});
});
