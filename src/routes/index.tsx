import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDesignPersistence } from "../hooks/useDesignPersistence";
import { useKumikoDesign } from "../hooks/useKumikoDesign";
import { useKumikoLayout } from "../hooks/useKumikoLayout";
import { useKumikoParams } from "../hooks/useKumikoParams";
import {
	createDesignPayload,
	GridDesigner,
	type Group,
	generateGroupSVG,
	LayoutEditor,
	type Line,
	saveDesign,
} from "../lib/kumiko";
import { downloadSVG } from "../lib/utils/download";
import {
	type AppStep,
	KumikoHeader,
	KumikoLoadDialog,
	KumikoSidebarParams,
	KumikoTemplateDialog,
} from "./-components/KumikoUI";

// Thin route-level App orchestrating state and wiring child modules

function App() {
	const [step, setStep] = useState<AppStep>("design");

	// Hooks
	const { params, actions: paramActions } = useKumikoParams();
	const { state: designState, actions: designActions } = useKumikoDesign(
		params.gridCellSize,
		params.bitSize,
	);
	const { state: layoutState, actions: layoutActions } = useKumikoLayout();

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

	// Design persistence hook - handles save/load/import/export and autosave
	const { state: persistenceState, actions: persistenceActions } =
		useDesignPersistence({
			paramActions: persistenceParamActions,
			designActions: persistenceDesignActions,
			layoutActions: persistenceLayoutActions,
			getCurrentPayloadData,
		});

	// Autosave: persist to local storage whenever design/layout state changes
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

	const handleDownloadSVG = useCallback(() => {
		console.log("downloadSVG called");
		const svg = generateGroupSVG({
			group: layoutState.activeGroup,
			designStrips: designState.designStrips,
			bitSize: params.bitSize,
			stockLength: params.stockLength,
		});
		console.log("SVG generated:", svg ? "yes" : "no");
		if (!svg) return;
		downloadSVG(svg, layoutState.activeGroup?.name || "kumiko-group");
	}, [
		layoutState.activeGroup,
		designState.designStrips,
		params.bitSize,
		params.stockLength,
	]);

	const handleDownloadAllGroupsSVG = useCallback(() => {
		const files: { filename: string; svg: string }[] = [];

		for (const group of layoutState.groups.values()) {
			const svg = generateGroupSVG({
				group,
				designStrips: designState.designStrips,
				bitSize: params.bitSize,
				stockLength: params.stockLength,
			});
			if (!svg) continue;

			const filename = `${group.name || "kumiko-group"}.svg`;
			files.push({ filename, svg });
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
	]);

	// Open the load dialog and refresh the list
	const openLoadDialog = useCallback(() => {
		persistenceActions.refreshNamedDesigns();
		persistenceActions.setShowLoadDialog(true);
	}, [persistenceActions]);

	// Open the template dialog
	const openTemplateDialog = useCallback(() => {
		persistenceActions.setShowTemplateDialog(true);
	}, [persistenceActions]);

	const displayUnit = params.units;

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 font-sans">
			{/* Main content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				<KumikoHeader
					designName={persistenceState.designName}
					step={step}
					onStepChange={setStep}
					onDesignNameChange={persistenceActions.setDesignName}
					onSaveAs={persistenceActions.handleSaveAs}
					onOpenLoadDialog={openLoadDialog}
					onOpenTemplateDialog={openTemplateDialog}
					onExportJSON={persistenceActions.handleExportJSON}
					onImportJSON={persistenceActions.handleImportJSON}
					onClear={persistenceActions.handleClear}
				/>

				{/* Main workspace */}
				{step === "design" && (
					<GridDesigner
						lines={designState.lines}
						intersections={designState.intersections}
						drawingLine={designState.drawingLine}
						onGridClick={designActions.handleGridClick}
						onCreateLine={designActions.handleCreateLine}
						onToggleIntersection={designActions.toggleIntersection}
						onDragUpdate={designActions.handleDragUpdate}
						isDeleting={designState.isDeleting}
						bitSize={params.bitSize}
						gridCellSize={params.gridCellSize}
						hoveredStripId={layoutState.hoveredStripId}
						lineLabelById={designState.lineLabelById}
						viewState={designState.gridViewState}
						onViewStateChange={designActions.setGridViewState}
					/>
				)}

				{step === "layout" && (
					<LayoutEditor
						designStrips={designState.designStrips}
						activeGroup={layoutState.activeGroup}
						groups={layoutState.groups}
						activeGroupId={layoutState.activeGroupId}
						setActiveGroupId={layoutActions.setActiveGroupId}
						addNewGroup={layoutActions.addNewGroup}
						deleteGroup={layoutActions.deleteGroup}
						renameGroup={layoutActions.renameGroup}
						selectedPieceId={layoutState.selectedPieceId}
						setSelectedPieceId={layoutActions.setSelectedPieceId}
						onLayoutClick={layoutActions.handleLayoutClick}
						stockLength={params.stockLength}
						bitSize={params.bitSize}
						halfCutDepth={params.halfCutDepth}
						cutDepth={params.cutDepth}
						onDownload={handleDownloadSVG}
						onDownloadAllGroups={handleDownloadAllGroupsSVG}
						onDeleteLayoutItem={layoutActions.deleteLayoutItem}
						onHoverStrip={layoutActions.setHoveredStripId}
						displayUnit={displayUnit}
					/>
				)}

				{/* Load dialog */}
				{persistenceState.showLoadDialog && (
					<KumikoLoadDialog
						namedDesigns={persistenceState.namedDesigns}
						onClose={() => persistenceActions.setShowLoadDialog(false)}
						onLoadNamed={persistenceActions.handleLoadNamed}
						onDeleteNamed={persistenceActions.handleDeleteNamed}
					/>
				)}

				{/* Template dialog */}
				{persistenceState.showTemplateDialog && (
					<KumikoTemplateDialog
						onClose={() => persistenceActions.setShowTemplateDialog(false)}
						onLoadTemplate={persistenceActions.handleLoadTemplate}
					/>
				)}
			</main>

			{/* Sidebar */}
			<KumikoSidebarParams
				displayUnit={displayUnit}
				onToggleUnits={paramActions.toggleUnits}
				bitSize={params.bitSize}
				cutDepth={params.cutDepth}
				halfCutDepth={params.halfCutDepth}
				gridCellSize={params.gridCellSize}
				stockLength={params.stockLength}
				onBitSizeChange={paramActions.handleParamChange(
					paramActions.setBitSize,
				)}
				onCutDepthChange={paramActions.handleParamChange(
					paramActions.setCutDepth,
				)}
				onHalfCutDepthChange={paramActions.handleHalfCutParamChange(
					paramActions.setHalfCutDepth,
				)}
				onGridCellSizeChange={paramActions.handleParamChange(
					paramActions.setGridCellSize,
				)}
				onStockLengthChange={paramActions.handleParamChange(
					paramActions.setStockLength,
				)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({
	component: App,
});
