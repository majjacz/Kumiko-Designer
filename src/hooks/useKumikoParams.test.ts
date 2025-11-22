import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useKumikoParams } from "./useKumikoParams";

describe("useKumikoParams", () => {
	it("should initialize with default values", () => {
		const { result } = renderHook(() => useKumikoParams());

		expect(result.current.params.units).toBe("mm");
		expect(result.current.params.bitSize).toBe(6.35);
		expect(result.current.params.cutDepth).toBe(19);
		expect(result.current.params.halfCutDepth).toBe(9.5);
		expect(result.current.params.gridCellSize).toBe(10);
		expect(result.current.params.stockLength).toBe(600);
	});

	it("should toggle units", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			result.current.actions.toggleUnits();
		});
		expect(result.current.params.units).toBe("in");

		act(() => {
			result.current.actions.toggleUnits();
		});
		expect(result.current.params.units).toBe("mm");
	});

	it("should update bit size", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			result.current.actions.setBitSize(3);
		});
		expect(result.current.params.bitSize).toBe(3);
	});

	it("should update cut depth and automatically update half cut depth", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			// Using handleParamChange wrapper which contains the logic
			result.current.actions.handleParamChange(
				result.current.actions.setCutDepth,
			)(20);
		});
		expect(result.current.params.cutDepth).toBe(20);
		expect(result.current.params.halfCutDepth).toBe(10);
	});

	it("should update half cut depth independently", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			result.current.actions.handleHalfCutParamChange(
				result.current.actions.setHalfCutDepth,
			)(5);
		});
		expect(result.current.params.halfCutDepth).toBe(5);
		// Cut depth should remain unchanged
		expect(result.current.params.cutDepth).toBe(19);
	});

	it("should update grid cell size", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			result.current.actions.setGridCellSize(15);
		});
		expect(result.current.params.gridCellSize).toBe(15);
	});

	it("should update stock length", () => {
		const { result } = renderHook(() => useKumikoParams());

		act(() => {
			result.current.actions.setStockLength(1000);
		});
		expect(result.current.params.stockLength).toBe(1000);
	});
});
