import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useKumikoDesign } from "../hooks/useKumikoDesign";
import { useKumikoLayout } from "../hooks/useKumikoLayout";
import { useKumikoParams } from "../hooks/useKumikoParams";
import {
	clearDesign,
	createDesignPayload,
	deleteNamedDesign,
	GridDesigner,
	type Group,
	generateGroupSVG,
	getDefaultTemplateId,
	LayoutEditor,
	type Line,
	listNamedDesigns,
	loadDesign,
	loadNamedDesign,
	loadTemplate,
	type SavedDesignPayload,
	saveDesign,
	saveNamedDesign,
} from "../lib/kumiko";
import { downloadJSON, downloadSVG } from "../lib/utils/download";
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

	// Named design state
	const [designName, setDesignName] = useState<string>("");
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [namedDesigns, setNamedDesigns] = useState<
		{ name: string; savedAt: string }[]
	>([]);
	const [showTemplateDialog, setShowTemplateDialog] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);

	// Helper to apply a loaded design payload into state
	const applyLoadedDesign = useCallback(
		(loaded: SavedDesignPayload | null) => {
			if (!loaded) return;
			console.log("Applying loaded design:", loaded.designName);

			paramActions.setUnits(loaded.units);
			paramActions.setBitSize(loaded.bitSize);
			paramActions.setCutDepth(loaded.cutDepth);
			paramActions.setHalfCutDepth(loaded.halfCutDepth);

			// In the current format, gridCellSize and stockLength are required.
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
		[
			paramActions.setUnits,
			paramActions.setBitSize,
			paramActions.setCutDepth,
			paramActions.setHalfCutDepth,
			paramActions.setGridCellSize,
			paramActions.setStockLength,
			designActions.setGridViewState,
			designActions.setLines,
			designActions.setIntersectionStates,
			layoutActions.setGroups,
			layoutActions.setActiveGroupId,
		],
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

	// Load named designs list (for Load dialog)
	useEffect(() => {
		setNamedDesigns(listNamedDesigns());
	}, []);

	const handleClear = () => {
		// Clear persisted autosave
		clearDesign();

		// Reset design state
		designActions.clearDesignState();

		// Reset layout to single empty default group
		layoutActions.clearLayoutState();

		// Reset named design metadata
		setDesignName("");
	};

	// Persist to local storage whenever the core design/layout state changes
	useEffect(() => {
		if (!isInitialized) return;
		const payload = createDesignPayload({
			units: params.units,
			bitSize: params.bitSize,
			cutDepth: params.cutDepth,
			halfCutDepth: params.halfCutDepth,
			gridCellSize: params.gridCellSize,
			stockLength: params.stockLength,
			lines: designState.lines,
			groups: layoutState.groups,
			activeGroupId: layoutState.activeGroupId,
			designName: designName || undefined,
			intersectionStates: designState.intersectionStates,
			gridViewState: designState.gridViewState,
		});

		saveDesign(payload);
	}, [
		params,
		designState.lines,
		layoutState.groups,
		layoutState.activeGroupId,
		designName,
		designState.intersectionStates,
		designState.gridViewState,
		isInitialized,
	]);

	// Explicit save-as of current state under a name
	const handleSaveAs = () => {
		const name = designName.trim();
		if (!name) {
			console.warn("Enter a design name before saving.");
			return;
		}

		const payload = createDesignPayload({
			units: params.units,
			bitSize: params.bitSize,
			cutDepth: params.cutDepth,
			halfCutDepth: params.halfCutDepth,
			gridCellSize: params.gridCellSize,
			stockLength: params.stockLength,
			lines: designState.lines,
			groups: layoutState.groups,
			activeGroupId: layoutState.activeGroupId,
			designName: name,
			intersectionStates: designState.intersectionStates,
			gridViewState: designState.gridViewState,
		});

		saveNamedDesign(name, payload);
		setNamedDesigns(listNamedDesigns());
		console.log(`Saved design "${name}" to this browser.`);
	};

	// Open the load dialog and refresh the list
	const openLoadDialog = () => {
		setNamedDesigns(listNamedDesigns());
		setShowLoadDialog(true);
	};

	// Load a named design chosen from the dialog
	const handleLoadNamed = (name: string) => {
		const loaded = loadNamedDesign(name);
		if (!loaded) {
			console.warn(`No data found for design "${name}".`);
			return;
		}
		applyLoadedDesign(loaded);
		setShowLoadDialog(false);
	};

	// Delete a named design from the dialog
	const handleDeleteNamed = (name: string) => {
		deleteNamedDesign(name);
		setNamedDesigns(listNamedDesigns());
	};

	// Open the template dialog
	const openTemplateDialog = () => {
		setShowTemplateDialog(true);
	};

	// Load a template
	const handleLoadTemplate = async (templateId: string) => {
		const template = await loadTemplate(templateId);
		if (!template) {
			console.warn(`Failed to load template.`);
			return;
		}

		applyLoadedDesign(template);
		setShowTemplateDialog(false);
	};

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

	// Export current design to JSON file
	const handleExportJSON = () => {
		const payload = createDesignPayload({
			units: params.units,
			bitSize: params.bitSize,
			cutDepth: params.cutDepth,
			halfCutDepth: params.halfCutDepth,
			gridCellSize: params.gridCellSize,
			stockLength: params.stockLength,
			lines: designState.lines,
			groups: layoutState.groups,
			activeGroupId: layoutState.activeGroupId,
			designName: designName || undefined,
			intersectionStates: designState.intersectionStates,
		});

		downloadJSON(payload, designName || "kumiko-design");
	};

	// Import design from JSON file
	const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const parsed = JSON.parse(content) as SavedDesignPayload;

				if (parsed.version !== 1) {
					console.warn("Invalid file format or version.");
					return;
				}

				if (!parsed.lines || !parsed.groups) {
					console.warn("Invalid design file: missing required data.");
					return;
				}

				if (
					typeof parsed.gridCellSize !== "number" ||
					typeof parsed.stockLength !== "number"
				) {
					console.warn(
						"Invalid design file: missing required scale information.",
					);
					return;
				}

				applyLoadedDesign(parsed);
				console.log(
					`Design "${parsed.designName || "Untitled"}" imported successfully!`,
				);
			} catch (error) {
				console.error("Failed to import design:", error);
				console.warn("Failed to import design. Please check the file format.");
			}
		};
		reader.readAsText(file);

		// Reset the input so the same file can be imported again
		event.target.value = "";
	};

	const displayUnit = params.units;

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 font-sans">
			{/* Main content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				<KumikoHeader
					designName={designName}
					step={step}
					onStepChange={setStep}
					onDesignNameChange={setDesignName}
					onSaveAs={handleSaveAs}
					onOpenLoadDialog={openLoadDialog}
					onOpenTemplateDialog={openTemplateDialog}
					onExportJSON={handleExportJSON}
					onImportJSON={handleImportJSON}
					onClear={handleClear}
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
				{showLoadDialog && (
					<KumikoLoadDialog
						namedDesigns={namedDesigns}
						onClose={() => setShowLoadDialog(false)}
						onLoadNamed={handleLoadNamed}
						onDeleteNamed={handleDeleteNamed}
					/>
				)}

				{/* Template dialog */}
				{showTemplateDialog && (
					<KumikoTemplateDialog
						onClose={() => setShowTemplateDialog(false)}
						onLoadTemplate={handleLoadTemplate}
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
