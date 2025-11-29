import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, useGridViewSettings } from "./useGridViewSettings";

describe("useGridViewSettings", () => {
	// Mock localStorage
	const localStorageMock = (() => {
		let store: Record<string, string> = {};
		return {
			getItem: vi.fn((key: string) => store[key] || null),
			setItem: vi.fn((key: string, value: string) => {
				store[key] = value;
			}),
			removeItem: vi.fn((key: string) => {
				delete store[key];
			}),
			clear: vi.fn(() => {
				store = {};
			}),
		};
	})();

	beforeEach(() => {
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			writable: true,
		});
	});

	afterEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it("should initialize with default settings", () => {
		const { result } = renderHook(() => useGridViewSettings());

		expect(result.current.state.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("should load settings from localStorage", () => {
		const savedSettings = {
			showNotchPositions: false,
			showHelpText: false,
			showLineIds: true,
			showDimensions: true,
			enableHighlighting: false,
		};
		localStorageMock.setItem(
			"kumiko-grid-view-settings",
			JSON.stringify(savedSettings),
		);

		const { result } = renderHook(() => useGridViewSettings());

		expect(result.current.state.settings).toEqual(savedSettings);
	});

	it("should update showNotchPositions", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setShowNotchPositions(false);
		});

		expect(result.current.state.settings.showNotchPositions).toBe(false);
	});

	it("should update showHelpText", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setShowHelpText(false);
		});

		expect(result.current.state.settings.showHelpText).toBe(false);
	});

	it("should update showLineIds", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setShowLineIds(false);
		});

		expect(result.current.state.settings.showLineIds).toBe(false);
	});

	it("should update showDimensions", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setShowDimensions(true);
		});

		expect(result.current.state.settings.showDimensions).toBe(true);
	});

	it("should update enableHighlighting", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setEnableHighlighting(false);
		});

		expect(result.current.state.settings.enableHighlighting).toBe(false);
	});

	it("should reset settings to defaults", () => {
		const { result } = renderHook(() => useGridViewSettings());

		// Change some settings first
		act(() => {
			result.current.actions.setShowNotchPositions(false);
			result.current.actions.setShowHelpText(false);
		});

		expect(result.current.state.settings.showNotchPositions).toBe(false);
		expect(result.current.state.settings.showHelpText).toBe(false);

		// Reset to defaults
		act(() => {
			result.current.actions.resetSettings();
		});

		expect(result.current.state.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("should persist settings to localStorage on change", () => {
		const { result } = renderHook(() => useGridViewSettings());

		act(() => {
			result.current.actions.setShowDimensions(true);
		});

		// Check localStorage was called with the updated settings
		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			"kumiko-grid-view-settings",
			expect.stringContaining('"showDimensions":true'),
		);
	});

	it("should handle corrupted localStorage data gracefully", () => {
		localStorageMock.setItem("kumiko-grid-view-settings", "not valid json");

		const { result } = renderHook(() => useGridViewSettings());

		// Should fall back to defaults
		expect(result.current.state.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("should merge partial settings with defaults", () => {
		// Only save partial settings
		const partialSettings = {
			showNotchPositions: false,
		};
		localStorageMock.setItem(
			"kumiko-grid-view-settings",
			JSON.stringify(partialSettings),
		);

		const { result } = renderHook(() => useGridViewSettings());

		// Should use saved value for showNotchPositions but defaults for others
		expect(result.current.state.settings.showNotchPositions).toBe(false);
		expect(result.current.state.settings.showHelpText).toBe(
			DEFAULT_SETTINGS.showHelpText,
		);
		expect(result.current.state.settings.showLineIds).toBe(
			DEFAULT_SETTINGS.showLineIds,
		);
		expect(result.current.state.settings.showDimensions).toBe(
			DEFAULT_SETTINGS.showDimensions,
		);
		expect(result.current.state.settings.enableHighlighting).toBe(
			DEFAULT_SETTINGS.enableHighlighting,
		);
	});
});
