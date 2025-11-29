/**
 * Hook for managing grid view settings (UI toggles).
 *
 * This hook manages the UI toggle state separately from zoom/pan state,
 * providing a cleaner separation of concerns and simpler persistence.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "kumiko-grid-view-settings";

/**
 * Settings that control what elements are visible in the grid designer.
 * These are pure UI preferences, separate from zoom/pan transform state.
 */
export interface GridViewSettings {
	showNotchPositions: boolean;
	showHelpText: boolean;
	showLineIds: boolean;
	showDimensions: boolean;
	enableHighlighting: boolean;
}

const DEFAULT_SETTINGS: GridViewSettings = {
	showNotchPositions: true,
	showHelpText: true,
	showLineIds: true,
	showDimensions: false,
	enableHighlighting: true,
};

/**
 * Load settings from localStorage, returning defaults if not found or invalid.
 */
function loadSettings(): GridViewSettings {
	if (typeof window === "undefined") return DEFAULT_SETTINGS;

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_SETTINGS;

		const parsed = JSON.parse(raw);
		// Validate and merge with defaults to handle missing keys
		return {
			showNotchPositions:
				typeof parsed.showNotchPositions === "boolean"
					? parsed.showNotchPositions
					: DEFAULT_SETTINGS.showNotchPositions,
			showHelpText:
				typeof parsed.showHelpText === "boolean"
					? parsed.showHelpText
					: DEFAULT_SETTINGS.showHelpText,
			showLineIds:
				typeof parsed.showLineIds === "boolean"
					? parsed.showLineIds
					: DEFAULT_SETTINGS.showLineIds,
			showDimensions:
				typeof parsed.showDimensions === "boolean"
					? parsed.showDimensions
					: DEFAULT_SETTINGS.showDimensions,
			enableHighlighting:
				typeof parsed.enableHighlighting === "boolean"
					? parsed.enableHighlighting
					: DEFAULT_SETTINGS.enableHighlighting,
		};
	} catch {
		return DEFAULT_SETTINGS;
	}
}

/**
 * Save settings to localStorage.
 */
function saveSettings(settings: GridViewSettings): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (error) {
		console.error("[useGridViewSettings] Failed to save settings", error);
	}
}

export interface GridViewSettingsState {
	settings: GridViewSettings;
}

export interface GridViewSettingsActions {
	setShowNotchPositions: (value: boolean) => void;
	setShowHelpText: (value: boolean) => void;
	setShowLineIds: (value: boolean) => void;
	setShowDimensions: (value: boolean) => void;
	setEnableHighlighting: (value: boolean) => void;
	resetSettings: () => void;
}

/**
 * Hook for managing grid view settings with automatic localStorage persistence.
 *
 * Settings are loaded from localStorage on mount and saved automatically on change.
 */
export function useGridViewSettings(): {
	state: GridViewSettingsState;
	actions: GridViewSettingsActions;
} {
	// Use lazy initialization to load settings from localStorage
	const [settings, setSettings] = useState<GridViewSettings>(() => {
		const loaded = loadSettings();
		return loaded;
	});

	// Track if we've completed initial mount to avoid saving defaults over stored values
	const isInitialMount = useRef(true);

	// Persist settings to localStorage whenever they change (but not on initial mount)
	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
			return;
		}
		saveSettings(settings);
	}, [settings]);

	const setShowNotchPositions = useCallback((value: boolean) => {
		setSettings((prev) => ({ ...prev, showNotchPositions: value }));
	}, []);

	const setShowHelpText = useCallback((value: boolean) => {
		setSettings((prev) => ({ ...prev, showHelpText: value }));
	}, []);

	const setShowLineIds = useCallback((value: boolean) => {
		setSettings((prev) => ({ ...prev, showLineIds: value }));
	}, []);

	const setShowDimensions = useCallback((value: boolean) => {
		setSettings((prev) => ({ ...prev, showDimensions: value }));
	}, []);

	const setEnableHighlighting = useCallback((value: boolean) => {
		setSettings((prev) => ({ ...prev, enableHighlighting: value }));
	}, []);

	const resetSettings = useCallback(() => {
		setSettings(DEFAULT_SETTINGS);
	}, []);

	const state = useMemo(() => ({ settings }), [settings]);

	const actions = useMemo(
		() => ({
			setShowNotchPositions,
			setShowHelpText,
			setShowLineIds,
			setShowDimensions,
			setEnableHighlighting,
			resetSettings,
		}),
		[
			setShowNotchPositions,
			setShowHelpText,
			setShowLineIds,
			setShowDimensions,
			setEnableHighlighting,
			resetSettings,
		],
	);

	return { state, actions };
}

export { DEFAULT_SETTINGS };
