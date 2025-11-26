/**
 * Hook for managing design persistence - save, load, import, export operations
 */
import { useCallback, useEffect, useState } from "react";
import type { Group, Line, SavedDesignPayload } from "../lib/kumiko";
import {
	createDesignPayload,
	deleteNamedDesign,
	getDefaultTemplateId,
	listNamedDesigns,
	loadDesign,
	loadNamedDesign,
	loadTemplate,
	saveDesign,
	saveNamedDesign,
} from "../lib/kumiko";
import { downloadJSON, downloadSVG } from "../lib/utils/download";

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
	};
	layoutActions: {
		setGroups: (
			updater: (groups: Map<string, Group>) => Map<string, Group>,
		) => void;
		setActiveGroupId: (id: string) => void;
	};
}

export interface UseDesignPersistenceOptions extends ApplyDesignParams {}

export interface DesignPersistenceActions {
	setDesignName: (name: string) => void;
	setShowLoadDialog: (show: boolean) => void;
	setShowTemplateDialog: (show: boolean) => void;
	handleClear: () => void;
	handleSaveAs: () => void;
	handleLoadNamed: (name: string) => void;
	handleDeleteNamed: (name: string) => void;
	handleLoadTemplate: (templateId: string) => Promise<void>;
	handleExportJSON: (currentDesignPayload: SavedDesignPayload) => void;
	handleImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
	refreshNamedDesigns: () => void;
}

export function useDesignPersistence({
	paramActions,
	designActions,
	layoutActions,
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
						pieces: new Map(g.pieces.map((p) => [p.id, { ...p }])),
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
		if (
			!window.confirm(
				"Clear all lines and reset layout? This cannot be undone.",
			)
		)
			return;

		designActions.setLines(() => new Map());
		designActions.setIntersectionStates(new Map());

		layoutActions.setGroups(() => {
			const newGroup: Group = {
				id: "group1",
				name: "Default Group",
				pieces: new Map(),
				fullCuts: new Map(),
			};
			return new Map([[newGroup.id, newGroup]]);
		});
		layoutActions.setActiveGroupId("group1");
		setDesignName("");
	}, [designActions, layoutActions]);

	const handleSaveAs = useCallback(() => {
		const newName = window.prompt("Enter design name:", designName);
		if (!newName?.trim()) return;
		setDesignName(newName.trim());
	}, [designName]);

	const handleLoadNamed = useCallback(
		(name: string) => {
			const loaded = loadNamedDesign(name);
			if (loaded) {
				applyLoadedDesign(loaded);
				setShowLoadDialog(false);
			}
		},
		[applyLoadedDesign],
	);

	const handleDeleteNamed = useCallback(
		(name: string) => {
			if (!window.confirm(`Delete "${name}"?`)) return;
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
			}
		},
		[applyLoadedDesign],
	);

	const handleExportJSON = useCallback(
		(currentDesignPayload: SavedDesignPayload) => {
			const filename = `${currentDesignPayload.designName || "kumiko-design"}-${Date.now()}.json`;
			downloadJSON(currentDesignPayload, filename);
		},
		[],
	);

	const handleImportJSON = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const data = JSON.parse(e.target?.result as string);
					// Basic validation - ensure it's our payload format
					if (data.version !== 1 || !Array.isArray(data.lines)) {
						window.alert("Invalid design file format.");
						return;
					}
					applyLoadedDesign(data as SavedDesignPayload);
					window.alert(`Imported design: ${data.designName || "(unnamed)"}`);
				} catch {
					window.alert("Failed to parse JSON file.");
				}
			};
			reader.readAsText(file);
			// Reset the input so the same file can be re-imported
			event.target.value = "";
		},
		[applyLoadedDesign],
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

/** Helper to trigger autosave */
export function triggerAutosave(payload: SavedDesignPayload): void {
	saveDesign(payload);
}

/** Helper to trigger named save */
export function triggerNamedSave(
	designName: string,
	payload: SavedDesignPayload,
): void {
	if (designName.trim()) {
		saveNamedDesign(designName.trim(), payload);
	}
}
