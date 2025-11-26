import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useDesignPersistence } from "../hooks/useDesignPersistence";
import { useKumikoDesign } from "../hooks/useKumikoDesign";
import { useKumikoLayout } from "../hooks/useKumikoLayout";
import { useKumikoParams } from "../hooks/useKumikoParams";
import type { NotificationType } from "../lib/errors";
import type {
	DesignStrip,
	GridViewState,
	Group,
	Intersection,
	Line,
	Point,
} from "../lib/kumiko";
import {
	createDesignPayload,
	type NamedDesignSummary,
	saveDesign,
} from "../lib/kumiko/kumiko-storage";
import {
	analyzeGroupPasses,
	generateGroupSVG,
} from "../lib/kumiko/kumiko-svg-export";
import { downloadSVG } from "../lib/utils/download";
import { useToastOptional } from "./ToastContext";

export type AppStep = "design" | "layout";

// ============================================================================
// Context Value Interface
// ============================================================================

export interface KumikoContextValue {
	// Current workflow step
	step: AppStep;
	setStep: (step: AppStep) => void;

	// Parameters
	params: {
		units: "mm" | "in";
		bitSize: number;
		cutDepth: number;
		halfCutDepth: number;
		gridCellSize: number;
		stockLength: number;
	};
	paramActions: {
		setUnits: (units: "mm" | "in") => void;
		setBitSize: (size: number) => void;
		setCutDepth: (depth: number) => void;
		setHalfCutDepth: (depth: number) => void;
		setGridCellSize: (size: number) => void;
		setStockLength: (length: number) => void;
		toggleUnits: () => void;
		handleParamChange: (
			setter: (value: number) => void,
		) => (mmValue: number) => void;
		handleHalfCutParamChange: (
			setter: (value: number) => void,
		) => (mmValue: number) => void;
	};

	// Design state
	designState: {
		lines: Map<string, Line>;
		drawingLine: Point | null;
		isDeleting: boolean;
		intersectionStates: Map<string, boolean>;
		gridViewState: GridViewState | undefined;
		intersections: Map<string, Intersection>;
		designStrips: DesignStrip[];
		lineLabelById: Map<string, string>;
	};
	designActions: {
		setLines: (
			updater:
				| Map<string, Line>
				| ((lines: Map<string, Line>) => Map<string, Line>),
		) => void;
		setIntersectionStates: (
			updater:
				| Map<string, boolean>
				| ((states: Map<string, boolean>) => Map<string, boolean>),
		) => void;
		setGridViewState: (state: GridViewState | undefined) => void;
		handleGridClick: (point: Point) => void;
		handleDragUpdate: (start: Point, end: Point, isDeleting: boolean) => void;
		handleCreateLine: (start: Point, end: Point) => void;
		toggleIntersection: (id: string) => void;
		clearDesignState: () => void;
	};

	// Layout state
	layoutState: {
		groups: Map<string, Group>;
		activeGroupId: string;
		selectedPieceId: string | null;
		hoveredStripId: string | null;
		activeGroup: Group | undefined;
	};
	layoutActions: {
		setGroups: (
			updater:
				| Map<string, Group>
				| ((groups: Map<string, Group>) => Map<string, Group>),
		) => void;
		setActiveGroupId: React.Dispatch<React.SetStateAction<string>>;
		setSelectedPieceId: React.Dispatch<React.SetStateAction<string | null>>;
		setHoveredStripId: (id: string | null) => void;
		addNewGroup: () => void;
		deleteGroup: (id: string) => void;
		renameGroup: (id: string, newName: string) => void;
		handleLayoutClick: (point: Point, rowIndex: number) => void;
		deleteLayoutItem: (type: "piece", id: string) => void;
		clearLayoutState: () => void;
	};

	// Persistence state
	persistenceState: {
		designName: string;
		isInitialized: boolean;
		showLoadDialog: boolean;
		showTemplateDialog: boolean;
		namedDesigns: NamedDesignSummary[];
	};
	persistenceActions: {
		setDesignName: (name: string) => void;
		setShowLoadDialog: (show: boolean) => void;
		setShowTemplateDialog: (show: boolean) => void;
		refreshNamedDesigns: () => void;
		handleSaveAs: () => void;
		handleExportJSON: () => void;
		handleImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
		handleLoadNamed: (name: string) => void;
		handleDeleteNamed: (name: string) => void;
		handleLoadTemplate: (templateId: string) => void;
		handleClear: () => void;
	};

	// UI helpers
	openLoadDialog: () => void;
	openTemplateDialog: () => void;
	handleDownloadSVG: () => void;
	handleDownloadAllGroupsSVG: () => void;

	// Notifications
	notify: (type: NotificationType, message: string) => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const KumikoContext = createContext<KumikoContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface KumikoProviderProps {
	children: ReactNode;
}

export function KumikoProvider({ children }: KumikoProviderProps) {
	const [step, setStep] = useState<AppStep>("design");

	// Get toast context if available
	const toast = useToastOptional();

	// Create stable notification callback
	const onNotify = useCallback(
		(type: NotificationType, message: string) => {
			toast?.showToast(type, message);
		},
		[toast],
	);

	// Core hooks
	const { params, actions: paramActions } = useKumikoParams();
	const { state: designState, actions: designActions } = useKumikoDesign(
		params.gridCellSize,
		params.bitSize,
	);
	const { state: layoutState, actions: layoutActions } = useKumikoLayout({
		onNotify,
	});

	// Create stable callback for getting current payload data
	const getCurrentPayloadData = useCallback(
		() => ({
			units: params.units,
			bitSize: params.bitSize,
			cutDepth: params.cutDepth,
			halfCutDepth: params.halfCutDepth,
			gridCellSize: params.gridCellSize,
			stockLength: params.stockLength,
			lines: designState.lines,
			groups: layoutState.groups,
			activeGroupId: layoutState.activeGroupId,
			intersectionStates: designState.intersectionStates,
			gridViewState: designState.gridViewState,
		}),
		[
			params.units,
			params.bitSize,
			params.cutDepth,
			params.halfCutDepth,
			params.gridCellSize,
			params.stockLength,
			designState.lines,
			layoutState.groups,
			layoutState.activeGroupId,
			designState.intersectionStates,
			designState.gridViewState,
		],
	);

	// Memoize action objects to prevent unnecessary recreations
	const persistenceParamActions = useMemo(
		() => ({
			setUnits: paramActions.setUnits,
			setBitSize: paramActions.setBitSize,
			setCutDepth: paramActions.setCutDepth,
			setHalfCutDepth: paramActions.setHalfCutDepth,
			setGridCellSize: paramActions.setGridCellSize,
			setStockLength: paramActions.setStockLength,
		}),
		[
			paramActions.setUnits,
			paramActions.setBitSize,
			paramActions.setCutDepth,
			paramActions.setHalfCutDepth,
			paramActions.setGridCellSize,
			paramActions.setStockLength,
		],
	);

	const persistenceDesignActions = useMemo(
		() => ({
			setGridViewState: designActions.setGridViewState,
			setLines: designActions.setLines as (
				updater: (lines: Map<string, Line>) => Map<string, Line>,
			) => void,
			setIntersectionStates: designActions.setIntersectionStates,
			clearDesignState: designActions.clearDesignState,
		}),
		[
			designActions.setGridViewState,
			designActions.setLines,
			designActions.setIntersectionStates,
			designActions.clearDesignState,
		],
	);

	const persistenceLayoutActions = useMemo(
		() => ({
			setGroups: layoutActions.setGroups as (
				updater: (groups: Map<string, Group>) => Map<string, Group>,
			) => void,
			setActiveGroupId: layoutActions.setActiveGroupId,
			clearLayoutState: layoutActions.clearLayoutState,
		}),
		[
			layoutActions.setGroups,
			layoutActions.setActiveGroupId,
			layoutActions.clearLayoutState,
		],
	);

	// Design persistence hook
	const { state: persistenceState, actions: persistenceActions } =
		useDesignPersistence({
			paramActions: persistenceParamActions,
			designActions: persistenceDesignActions,
			layoutActions: persistenceLayoutActions,
			getCurrentPayloadData,
			onNotify,
		});

	// Autosave effect
	useEffect(() => {
		if (!persistenceState.isInitialized) return;
		const payload = createDesignPayload({
			...getCurrentPayloadData(),
			designName: persistenceState.designName || undefined,
		});
		saveDesign(payload);
	}, [
		getCurrentPayloadData,
		persistenceState.isInitialized,
		persistenceState.designName,
	]);

	// SVG download handlers
	const handleDownloadSVG = useCallback(() => {
		const group = layoutState.activeGroup;
		if (!group) return;

		const baseName = group.name || "kumiko-group";
		const { hasTop, hasBottom } = analyzeGroupPasses(
			group,
			designState.designStrips,
		);

		if (hasTop && hasBottom) {
			// Pass 1: Top
			const svgTop = generateGroupSVG({
				group,
				designStrips: designState.designStrips,
				bitSize: params.bitSize,
				stockLength: params.stockLength,
				pass: "top",
			});
			if (svgTop) {
				downloadSVG(svgTop, `${baseName}_top.svg`);
			}

			// Pass 2: Bottom (delayed slightly to ensure browser handles both)
			setTimeout(() => {
				const svgBottom = generateGroupSVG({
					group,
					designStrips: designState.designStrips,
					bitSize: params.bitSize,
					stockLength: params.stockLength,
					pass: "bottom",
				});
				if (svgBottom) {
					downloadSVG(svgBottom, `${baseName}_bottom.svg`);
				}
			}, 500);

			onNotify(
				"info",
				"Double-sided strips detected. Downloading separate files for Top and Bottom passes.",
			);
		} else if (hasBottom && !hasTop) {
			// Bottom Only -> Auto-flip to Top (Standard)
			const svg = generateGroupSVG({
				group,
				designStrips: designState.designStrips,
				bitSize: params.bitSize,
				stockLength: params.stockLength,
				pass: "all",
				flip: true,
			});
			if (!svg) return;
			downloadSVG(svg, `${baseName}.svg`);
			onNotify(
				"info",
				"Bottom-only strips flipped to top for single-pass cutting.",
			);
		} else {
			// Top Only (Standard)
			const svg = generateGroupSVG({
				group,
				designStrips: designState.designStrips,
				bitSize: params.bitSize,
				stockLength: params.stockLength,
				pass: "all",
			});
			if (!svg) return;
			downloadSVG(svg, `${baseName}.svg`);
		}
	}, [
		layoutState.activeGroup,
		designState.designStrips,
		params.bitSize,
		params.stockLength,
		onNotify,
	]);

	const handleDownloadAllGroupsSVG = useCallback(() => {
		const files: { filename: string; svg: string }[] = [];

		for (const group of layoutState.groups.values()) {
			const baseName = group.name || "kumiko-group";
			const { hasTop, hasBottom } = analyzeGroupPasses(
				group,
				designState.designStrips,
			);

			if (hasTop && hasBottom) {
				const svgTop = generateGroupSVG({
					group,
					designStrips: designState.designStrips,
					bitSize: params.bitSize,
					stockLength: params.stockLength,
					pass: "top",
				});
				if (svgTop) {
					files.push({ filename: `${baseName}_top.svg`, svg: svgTop });
				}

				const svgBottom = generateGroupSVG({
					group,
					designStrips: designState.designStrips,
					bitSize: params.bitSize,
					stockLength: params.stockLength,
					pass: "bottom",
				});
				if (svgBottom) {
					files.push({ filename: `${baseName}_bottom.svg`, svg: svgBottom });
				}
			} else if (hasBottom && !hasTop) {
				// Bottom Only -> Auto-flip
				const svg = generateGroupSVG({
					group,
					designStrips: designState.designStrips,
					bitSize: params.bitSize,
					stockLength: params.stockLength,
					pass: "all",
					flip: true,
				});
				if (svg) {
					files.push({ filename: `${baseName}.svg`, svg });
				}
			} else {
				const svg = generateGroupSVG({
					group,
					designStrips: designState.designStrips,
					bitSize: params.bitSize,
					stockLength: params.stockLength,
					pass: "all",
				});
				if (svg) {
					files.push({ filename: `${baseName}.svg`, svg });
				}
			}
		}

		if (files.length > 0) {
			onNotify(
				"success",
				`Downloading ${files.length} files for ${layoutState.groups.size} groups...`,
			);
		}

		files.forEach((file, index) => {
			window.setTimeout(() => {
				downloadSVG(file.svg, file.filename);
			}, index * 300);
		});
	}, [
		layoutState.groups,
		designState.designStrips,
		params.bitSize,
		params.stockLength,
		onNotify,
	]);

	// Dialog helpers
	const openLoadDialog = useCallback(() => {
		persistenceActions.refreshNamedDesigns();
		persistenceActions.setShowLoadDialog(true);
	}, [persistenceActions]);

	const openTemplateDialog = useCallback(() => {
		persistenceActions.setShowTemplateDialog(true);
	}, [persistenceActions]);

	// Build context value
	const contextValue = useMemo<KumikoContextValue>(
		() => ({
			step,
			setStep,
			params,
			paramActions,
			designState,
			designActions,
			layoutState,
			layoutActions,
			persistenceState,
			persistenceActions,
			openLoadDialog,
			openTemplateDialog,
			handleDownloadSVG,
			handleDownloadAllGroupsSVG,
			notify: onNotify,
		}),
		[
			step,
			params,
			paramActions,
			designState,
			designActions,
			layoutState,
			layoutActions,
			persistenceState,
			persistenceActions,
			openLoadDialog,
			openTemplateDialog,
			handleDownloadSVG,
			handleDownloadAllGroupsSVG,
			onNotify,
		],
	);

	return (
		<KumikoContext.Provider value={contextValue}>
			{children}
		</KumikoContext.Provider>
	);
}

// ============================================================================
// Consumer Hook
// ============================================================================

export function useKumiko(): KumikoContextValue {
	const context = useContext(KumikoContext);
	if (!context) {
		throw new Error("useKumiko must be used within a KumikoProvider");
	}
	return context;
}
