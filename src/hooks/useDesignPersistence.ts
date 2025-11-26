/**
 * Hook for managing design persistence - save, load, import, export operations
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationType, NotifyCallback } from "../lib/errors";
import type { Group, Line, SavedDesignPayload } from "../lib/kumiko";
import {
	clearDesign,
	createDesignPayload,
	deleteNamedDesign,
	getDefaultTemplateId,
	listNamedDesigns,
	loadDesign,
	loadNamedDesign,
	loadTemplate,
	saveNamedDesign,
} from "../lib/kumiko";
import { downloadJSON } from "../lib/utils/download";

export interface DesignPersistenceState {
	designName: string;
	namedDesigns: { name: string; savedAt: string }[];
	isInitialized: boolean;
	showLoadDialog: boolean;
	showTemplateDialog: boolean;
}

export interface ApplyDesignParams {
	paramActions: {
		setUnits: (units: "mm" | "in") => void;
		setBitSize: (size: number) => void;
		setCutDepth: (depth: number) => void;
		setHalfCutDepth: (depth: number) => void;
		setGridCellSize: (size: number) => void;
		setStockLength: (length: number) => void;
	};
	designActions: {
		setGridViewState: (
			state: SavedDesignPayload["gridViewState"] | undefined,
		) => void;
		setLines: (
			updater: (lines: Map<string, Line>) => Map<string, Line>,
		) => void;
		setIntersectionStates: (states: Map<string, boolean>) => void;
		clearDesignState: () => void;
	};
	layoutActions: {
		setGroups: (
			updater: (groups: Map<string, Group>) => Map<string, Group>,
		) => void;
		setActiveGroupId: (id: string) => void;
		clearLayoutState: () => void;
	};
}

/** Data needed to create a design payload for saving/exporting */
export interface DesignPayloadData {
	units: "mm" | "in";
	bitSize: number;
	cutDepth: number;
	halfCutDepth: number;
	gridCellSize: number;
	stockLength: number;
	lines: Map<string, Line>;
	groups: Map<string, Group>;
	activeGroupId: string;
	intersectionStates: Map<string, boolean>;
	gridViewState?: SavedDesignPayload["gridViewState"];
}

export interface UseDesignPersistenceOptions extends ApplyDesignParams {
	/** Function to get current design data for saving/exporting */
	getCurrentPayloadData: () => DesignPayloadData;
	/** Optional callback for showing notifications to the user */
	onNotify?: NotifyCallback;
}

export interface DesignPersistenceActions {
	setDesignName: (name: string) => void;
	setShowLoadDialog: (show: boolean) => void;
	setShowTemplateDialog: (show: boolean) => void;
	handleClear: () => void;
	handleSaveAs: () => void;
	handleLoadNamed: (name: string) => void;
	handleDeleteNamed: (name: string) => void;
	handleLoadTemplate: (templateId: string) => Promise<void>;
	handleExportJSON: () => void;
	handleImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
	refreshNamedDesigns: () => void;
}

export function useDesignPersistence({
	paramActions,
	designActions,
	layoutActions,
	getCurrentPayloadData,
	onNotify,
}: UseDesignPersistenceOptions): {
	state: DesignPersistenceState;
	actions: DesignPersistenceActions;
} {
	const [designName, setDesignName] = useState<string>("");
	const [namedDesigns, setNamedDesigns] = useState<
		{ name: string; savedAt: string }[]
	>([]);
	const [isInitialized, setIsInitialized] = useState(false);
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [showTemplateDialog, setShowTemplateDialog] = useState(false);

	// Keep a ref for the design name so we can access it in callbacks
	const designNameRef = useRef(designName);
	designNameRef.current = designName;

	// Keep a ref for getCurrentPayloadData to avoid dependency issues
	const getCurrentPayloadDataRef = useRef(getCurrentPayloadData);
	getCurrentPayloadDataRef.current = getCurrentPayloadData;

	// Keep ref for notify callback
	const onNotifyRef = useRef(onNotify);
	onNotifyRef.current = onNotify;

	/** Helper to show notification if callback is provided */
	const notify = useCallback((type: NotificationType, message: string) => {
		onNotifyRef.current?.(type, message);
	}, []);

	// Helper to apply a loaded design payload into state
	const applyLoadedDesign = useCallback(
		(loaded: SavedDesignPayload | null) => {
			if (!loaded) return;
			console.log("Applying loaded design:", loaded.designName);

			paramActions.setUnits(loaded.units);
			paramActions.setBitSize(loaded.bitSize);
			paramActions.setCutDepth(loaded.cutDepth);
			paramActions.setHalfCutDepth(loaded.halfCutDepth);
			paramActions.setGridCellSize(loaded.gridCellSize);
			paramActions.setStockLength(
				typeof loaded.stockLength === "number" ? loaded.stockLength : 600,
			);
			designActions.setGridViewState(loaded.gridViewState);

			designActions.setLines(() => {
				const next = new Map<string, Line>();
				for (const line of loaded.lines) {
					next.set(line.id, { ...line });
				}
				return next;
			});

			layoutActions.setGroups(() => {
				const next = new Map<string, Group>();
				for (const g of loaded.groups) {
					next.set(g.id, {
						id: g.id,
						name: g.name,
						pieces: new Map(
							g.pieces.map((p) => {
								// Ensure rowIndex is present, computing from y if needed
								// GRID_CELL_HEIGHT is 20mm
								const rowIndex =
									typeof p.rowIndex === "number"
										? p.rowIndex
										: Math.floor(p.y / 20);
								return [p.id, { ...p, rowIndex }];
							}),
						),
						fullCuts: new Map(g.fullCuts.map((c) => [c.id, { ...c }])),
					});
				}
				return next;
			});

			layoutActions.setActiveGroupId(loaded.activeGroupId);
			setDesignName(loaded.designName ?? "");

			// Load intersection states if available
			if (loaded.intersectionStates) {
				designActions.setIntersectionStates(new Map(loaded.intersectionStates));
			} else {
				designActions.setIntersectionStates(new Map());
			}
			setIsInitialized(true);
		},
		[paramActions, designActions, layoutActions],
	);

	// On mount, load the last working design or default template
	useEffect(() => {
		let ignore = false;
		const loaded = loadDesign();
		if (loaded) {
			if (!ignore) applyLoadedDesign(loaded);
		} else {
			// Load default template if no saved design exists
			const defaultTemplateId = getDefaultTemplateId();
			if (defaultTemplateId) {
				loadTemplate(defaultTemplateId)
					.then((template) => {
						if (ignore) return;
						if (template) {
							applyLoadedDesign(template);
						}
					})
					.catch((err) =>
						console.error("Failed to load default template", err),
					);
			}
		}
		return () => {
			ignore = true;
		};
	}, [applyLoadedDesign]);

	// Load named designs list
	const refreshNamedDesigns = useCallback(() => {
		setNamedDesigns(listNamedDesigns());
	}, []);

	useEffect(() => {
		refreshNamedDesigns();
	}, [refreshNamedDesigns]);

	const handleClear = useCallback(() => {
		// Clear persisted autosave
		clearDesign();

		// Reset design state
		designActions.clearDesignState();

		// Reset layout state
		layoutActions.clearLayoutState();

		// Reset design name
		setDesignName("");
	}, [designActions, layoutActions]);

	// Save As - prompts for a new name
	const handleSaveAs = useCallback(() => {
		const currentName = designNameRef.current.trim();
		const newName = window.prompt(
			"Save design as:",
			currentName || "My Design",
		);

		if (newName === null) {
			// User cancelled
			return;
		}

		const trimmedName = newName.trim();
		if (!trimmedName) {
			notify("warning", "Design name cannot be empty.");
			return;
		}

		// Update the design name in state
		setDesignName(trimmedName);

		const data = getCurrentPayloadDataRef.current();
		const payload = createDesignPayload({
			...data,
			designName: trimmedName,
		});

		saveNamedDesign(trimmedName, payload);
		setNamedDesigns(listNamedDesigns());
		notify("success", `Saved design as "${trimmedName}".`);
	}, [notify]);

	const handleLoadNamed = useCallback(
		(name: string) => {
			const loaded = loadNamedDesign(name);
			if (loaded) {
				applyLoadedDesign(loaded);
				setShowLoadDialog(false);
			} else {
				notify("error", `No data found for design "${name}".`);
			}
		},
		[applyLoadedDesign, notify],
	);

	const handleDeleteNamed = useCallback(
		(name: string) => {
			deleteNamedDesign(name);
			refreshNamedDesigns();
		},
		[refreshNamedDesigns],
	);

	const handleLoadTemplate = useCallback(
		async (templateId: string) => {
			const template = await loadTemplate(templateId);
			if (template) {
				applyLoadedDesign(template);
				setShowTemplateDialog(false);
			} else {
				notify("error", "Failed to load template.");
			}
		},
		[applyLoadedDesign, notify],
	);

	const handleExportJSON = useCallback(() => {
		const data = getCurrentPayloadDataRef.current();
		const currentName = designNameRef.current;
		const payload = createDesignPayload({
			...data,
			designName: currentName || undefined,
		});
		downloadJSON(payload, currentName || "kumiko-design");
	}, []);

	const handleImportJSON = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const content = e.target?.result as string;
					const parsed = JSON.parse(content) as SavedDesignPayload;

					if (parsed.version !== 1) {
						notify("error", "Invalid file format or version.");
						return;
					}

					if (!parsed.lines || !parsed.groups) {
						notify("error", "Invalid design file: missing required data.");
						return;
					}

					if (
						typeof parsed.gridCellSize !== "number" ||
						typeof parsed.stockLength !== "number"
					) {
						notify(
							"error",
							"Invalid design file: missing required scale information.",
						);
						return;
					}

					applyLoadedDesign(parsed);
					notify(
						"success",
						`Design "${parsed.designName || "Untitled"}" imported successfully!`,
					);
				} catch (error) {
					console.error("Failed to import design:", error);
					notify(
						"error",
						"Failed to import design. Please check the file format.",
					);
				}
			};
			reader.readAsText(file);

			// Reset the input so the same file can be imported again
			event.target.value = "";
		},
		[applyLoadedDesign, notify],
	);

	return {
		state: {
			designName,
			namedDesigns,
			isInitialized,
			showLoadDialog,
			showTemplateDialog,
		},
		actions: {
			setDesignName,
			setShowLoadDialog,
			setShowTemplateDialog,
			handleClear,
			handleSaveAs,
			handleLoadNamed,
			handleDeleteNamed,
			handleLoadTemplate,
			handleExportJSON,
			handleImportJSON,
			refreshNamedDesigns,
		},
	};
}
