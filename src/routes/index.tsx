import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";

import {
	KumikoHeader,
	KumikoLoadDialog,
	KumikoTemplateDialog,
	KumikoSidebarParams,
	type AppStep,
} from "./-components/KumikoUI";

import {
	Cut,
	convertUnit,
	DesignStrip,
	findIntersection,
	Group,
	Intersection,
	Line,
	newId,
	Piece,
	Point,
} from "../lib/kumiko/kumiko-core";
import { GridDesigner } from "../lib/kumiko/kumiko-grid-designer";
import { LayoutEditor } from "../lib/kumiko/kumiko-layout-editor";
import {
	clearDesign,
	loadDesign,
	saveDesign,
	type SavedDesignPayload,
	listNamedDesigns,
	saveNamedDesign,
	loadNamedDesign,
	deleteNamedDesign,
	type GridViewState,
} from "../lib/kumiko/kumiko-storage";
import { loadTemplate, getDefaultTemplateId } from "../lib/kumiko/kumiko-templates";
import { generateGroupSVG } from "../lib/kumiko/kumiko-svg-export";
import {
	computeIntersections,
	computeDesignStrips,
	findLineEndingAt,
	checkLineOverlap,
} from "../lib/kumiko/kumiko-design-logic";

  // Thin route-level App orchestrating state and wiring child modules
 
 const LEGACY_GRID_COLUMNS = 1000;

function App() {
	const [step, setStep] = useState<AppStep>("design");
	const [units, setUnits] = useState<"mm" | "in">("mm");

	// Parameters (stored internally in mm)
	const [bitSize, setBitSize] = useState(6.35);
	const [cutDepth, setCutDepth] = useState(19);
	const [halfCutDepth, setHalfCutDepth] = useState(9.5);
	// Physical size of one grid cell in mm (determines design scale)
	const [gridCellSize, setGridCellSize] = useState(10);
	// stockLength is the physical board/stock length used in layout & SVG
	const [stockLength, setStockLength] = useState(600);

	// Design state
	const [lines, setLines] = useState<Map<string, Line>>(new Map());
	const [drawingLine, setDrawingLine] = useState<Point | null>(null);
	const [isDeleting, setIsDeleting] = useState<boolean>(false);
	const [intersectionStates, setIntersectionStates] = useState<Map<string, boolean>>(new Map());
	const [gridViewState, setGridViewState] = useState<GridViewState | undefined>(undefined);

	// Layout state
	const [layoutRows, setLayoutRows] = useState(10);
	const [groups, setGroups] = useState<Map<string, Group>>(
		() =>
			new Map([
				[
					"group1",
					{
						id: "group1",
						name: "Default Group",
						pieces: new Map<string, Piece>(),
						fullCuts: new Map<string, Cut>(),
					},
				],
			]),
	);
	const [activeGroupId, setActiveGroupId] = useState<string>("group1");
	const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
	const [hoveredStripId, setHoveredStripId] = useState<string | null>(null);

	// Named design state
	const [designName, setDesignName] = useState<string>("");
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [namedDesigns, setNamedDesigns] = useState<
		{ name: string; savedAt: string }[]
	>([]);
	const [showTemplateDialog, setShowTemplateDialog] = useState(false);

	// Helper to apply a loaded design payload into state
	const applyLoadedDesign = (loaded: SavedDesignPayload | null) => {
		if (!loaded) return;

		setUnits(loaded.units);
		setBitSize(loaded.bitSize);
		setCutDepth(loaded.cutDepth);
		setHalfCutDepth(loaded.halfCutDepth);

		// Support both legacy square gridSize and new independent gridSizeX/gridSizeY
		const loadedGridSizeX = loaded.gridSizeX ?? loaded.gridSize;
		const loadedGridSizeY = loaded.gridSizeY ?? loaded.gridSize;

		// Determine grid cell size in mm.
		// Prefer explicit gridCellSize; fall back to legacy stripLength / gridSizeX; finally default to 10mm.
		const derivedGridCellSize =
			loaded.gridCellSize ??
			(loaded.stripLength && loadedGridSizeX
				? loaded.stripLength / loadedGridSizeX
				: 10);

		setGridCellSize(derivedGridCellSize);
		setStockLength(
			loaded.stockLength ??
				(loaded.stripLength ??
					derivedGridCellSize * (loadedGridSizeX || 1)),
		);
		setGridViewState(loaded.gridViewState);

		setLines(() => {
			const next = new Map<string, Line>();
			for (const line of loaded.lines) {
				next.set(line.id, { ...line });
			}
			return next;
		});

		setGroups(() => {
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

		setActiveGroupId(loaded.activeGroupId);
		setDesignName(loaded.designName ?? "");
		
		// Load intersection states if available
		if (loaded.intersectionStates) {
			setIntersectionStates(new Map(loaded.intersectionStates));
		} else {
			setIntersectionStates(new Map());
		}
	};

		// Derived intersections - ensures only one notch per coordinate
		const intersections = useMemo<Map<string, Intersection>>(
			() => computeIntersections(lines, intersectionStates),
			[lines, intersectionStates],
		);

		// Derived design strips for layout
		const designStrips = useMemo<DesignStrip[]>(
			() => computeDesignStrips(lines, intersections, gridCellSize),
			[lines, intersections, gridCellSize],
		);

	const activeGroup = useMemo<Group | undefined>(
		() => groups.get(activeGroupId),
		[groups, activeGroupId],
	);

	// On mount, load the last working design or default template
	useEffect(() => {
		const loaded = loadDesign();
		if (loaded) {
			applyLoadedDesign(loaded);
		} else {
			// Load default template if no saved design exists
			const defaultTemplateId = getDefaultTemplateId();
			if (defaultTemplateId) {
				loadTemplate(defaultTemplateId).then((template) => {
					if (template) {
						applyLoadedDesign(template);
					}
				});
			}
		}
	}, []);

	// Load named designs list (for Load dialog)
	useEffect(() => {
		setNamedDesigns(listNamedDesigns());
	}, []);

	const handleClear = () => {
		if (
			!window.confirm(
				"Clear current design and layout? This will reset the working state.",
			)
		) {
			return;
		}

		// Clear persisted autosave
		clearDesign();

		// Reset design state
		setLines(new Map());
		setDrawingLine(null);
		setIntersectionStates(new Map());

		// Reset layout to single empty default group
		const defaultGroupId = "group1";
		setGroups(
			new Map([
				[
					defaultGroupId,
					{
						id: defaultGroupId,
						name: "Default Group",
						pieces: new Map<string, Piece>(),
						fullCuts: new Map<string, Cut>(),
					},
				],
			]),
		);
		setActiveGroupId(defaultGroupId);
		setSelectedPieceId(null);

		// Reset named design metadata
		setDesignName("");

		// Reset grid designer view state (let the designer choose a centered default)
		setGridViewState(undefined);
	};
	// Persist to local storage whenever the core design/layout state changes
	useEffect(() => {
		const payload: SavedDesignPayload = {
			version: 1 as const,
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			// Derived legacy stripLength for backwards compatibility: treat as a wide grid
			stripLength: gridCellSize * LEGACY_GRID_COLUMNS,
			stockLength,
			// Physical grid cell size (mm)
			gridCellSize,
			// Keep legacy square gridSize for backwards compatibility.
			gridSize: LEGACY_GRID_COLUMNS,
			gridSizeX: LEGACY_GRID_COLUMNS,
			gridSizeY: LEGACY_GRID_COLUMNS,
			lines: Array.from(lines.values()),
			groups: Array.from(groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				pieces: Array.from(g.pieces.values()),
				fullCuts: Array.from(g.fullCuts.values()),
			})),
			activeGroupId,
			designName: designName || undefined,
			intersectionStates: Array.from(intersectionStates.entries()),
			gridViewState,
		};

		saveDesign(payload);
	}, [
		units,
		bitSize,
		cutDepth,
		halfCutDepth,
		gridCellSize,
		stockLength,
		lines,
		groups,
		activeGroupId,
		designName,
		intersectionStates,
		gridViewState,
	]);

	// Explicit save-as of current state under a name
	const handleSaveAs = () => {
		const name = designName.trim();
		if (!name) {
			alert("Enter a design name before saving.");
			return;
		}

		const payload: SavedDesignPayload = {
			version: 1 as const,
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			// Derived legacy stripLength for backwards compatibility: treat as a wide grid
			stripLength: gridCellSize * LEGACY_GRID_COLUMNS,
			stockLength,
			gridCellSize,
			gridSize: LEGACY_GRID_COLUMNS,
			gridSizeX: LEGACY_GRID_COLUMNS,
			gridSizeY: LEGACY_GRID_COLUMNS,
			lines: Array.from(lines.values()),
			groups: Array.from(groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				pieces: Array.from(g.pieces.values()),
				fullCuts: Array.from(g.fullCuts.values()),
			})),
			activeGroupId,
			designName: name,
			intersectionStates: Array.from(intersectionStates.entries()),
			gridViewState,
		};

		saveNamedDesign(name, payload);
		setNamedDesigns(listNamedDesigns());
		alert(`Saved design "${name}" to this browser.`);
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
			alert(`No data found for design "${name}".`);
			return;
		}
		applyLoadedDesign(loaded);
		setShowLoadDialog(false);
	};

	// Delete a named design from the dialog
	const handleDeleteNamed = (name: string) => {
		if (!window.confirm(`Delete saved design "${name}"?`)) return;
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
			alert(`Failed to load template.`);
			return;
		}

		// Confirm before overwriting current design
		if (lines.size > 0 || groups.size > 0) {
			if (!window.confirm("Load this template? Your current work will be replaced.")) {
				return;
			}
		}

		applyLoadedDesign(template);
		setShowTemplateDialog(false);
	};

	// Handlers

	const toggleIntersection = (id: string) => {
		const int = intersections.get(id);
		if (!int) return;
		// Update the intersection state
		setIntersectionStates((prev) => {
			const next = new Map(prev);
			next.set(id, !int.line1Over);
			return next;
		});
	};



	const handleGridClick = (point: Point) => {
		// Use coordinates directly from getGridPoint (already snapped to grid)
		const gridPoint = point;

		if (!drawingLine) {
			setDrawingLine(gridPoint);
			setIsDeleting(false);
			return;
		}

		if (drawingLine.x === gridPoint.x && drawingLine.y === gridPoint.y) {
			setDrawingLine(null);
			setIsDeleting(false);
			return;
		}

				// Check if the new line overlaps with an existing line
				const overlap = checkLineOverlap(lines, drawingLine, gridPoint);
		
		if (overlap) {
			// Split the line: remove overlapping segment and keep non-overlapping parts
			const { line, tStart, tEnd } = overlap;
			setLines((prev) => {
				const next = new Map(prev);
				next.delete(line.id);
				
				// Keep segment before overlap (if exists)
				if (tStart > 0.001) {
					const id = newId();
					const beforeSegment: Line = {
						id,
						x1: line.x1,
						y1: line.y1,
						x2: Math.round(line.x1 + tStart * (line.x2 - line.x1)),
						y2: Math.round(line.y1 + tStart * (line.y2 - line.y1)),
					};
					next.set(id, beforeSegment);
				}
				
				// Keep segment after overlap (if exists)
				if (tEnd < 0.999) {
					const id = newId();
					const afterSegment: Line = {
						id,
						x1: Math.round(line.x1 + tEnd * (line.x2 - line.x1)),
						y1: Math.round(line.y1 + tEnd * (line.y2 - line.y1)),
						x2: line.x2,
						y2: line.y2,
					};
					next.set(id, afterSegment);
				}
				
				return next;
			});
		} else {
			// Check if there's an existing line that ends where the new line starts
			const existingLine = findLineEndingAt(lines, drawingLine);
			
			if (existingLine) {
				// Merge: extend the existing line to the new end point
				const updatedLine: Line = {
					...existingLine,
					x2: gridPoint.x,
					y2: gridPoint.y,
				};
				setLines((prev) => new Map(prev).set(existingLine.id, updatedLine));
			} else {
				// Create new line
				const id = newId();
				const newLine: Line = {
					id,
					x1: drawingLine.x,
					y1: drawingLine.y,
					x2: gridPoint.x,
					y2: gridPoint.y,
				};
				setLines((prev) => new Map(prev).set(id, newLine));
			}
		}
		
		setDrawingLine(null);
		setIsDeleting(false);
	};

	const handleDragUpdate = (start: Point, end: Point) => {
		// Update isDeleting state based on whether we're overlapping an existing line
		const overlap = checkLineOverlap(lines, start, end);
		setIsDeleting(!!overlap);
	};

	const handleCreateLine = (start: Point, end: Point) => {
				// Check if the new line overlaps with an existing line
				const overlap = checkLineOverlap(lines, start, end);
		
		if (overlap) {
			// Split the line: remove overlapping segment and keep non-overlapping parts
			const { line, tStart, tEnd } = overlap;
			setLines((prev) => {
				const next = new Map(prev);
				next.delete(line.id);
				
				// Keep segment before overlap (if exists)
				if (tStart > 0.001) {
					const id = newId();
					const beforeSegment: Line = {
						id,
						x1: line.x1,
						y1: line.y1,
						x2: Math.round(line.x1 + tStart * (line.x2 - line.x1)),
						y2: Math.round(line.y1 + tStart * (line.y2 - line.y1)),
					};
					next.set(id, beforeSegment);
				}
				
				// Keep segment after overlap (if exists)
				if (tEnd < 0.999) {
					const id = newId();
					const afterSegment: Line = {
						id,
						x1: Math.round(line.x1 + tEnd * (line.x2 - line.x1)),
						y1: Math.round(line.y1 + tEnd * (line.y2 - line.y1)),
						x2: line.x2,
						y2: line.y2,
					};
					next.set(id, afterSegment);
				}
				
				return next;
			});
		} else {
			// Check if there's an existing line that ends where the new line starts
			const existingLine = findLineEndingAt(lines, start);
			
			if (existingLine) {
				// Merge: extend the existing line to the new end point
				const updatedLine: Line = {
					...existingLine,
					x2: end.x,
					y2: end.y,
				};
				setLines((prev) => new Map(prev).set(existingLine.id, updatedLine));
			} else {
				// Create new line from drag operation
				const id = newId();
				const newLine: Line = {
					id,
					x1: start.x,
					y1: start.y,
					x2: end.x,
					y2: end.y,
				};
				setLines((prev) => new Map(prev).set(id, newLine));
			}
		}
		
		setDrawingLine(null);
		setIsDeleting(false);
	};

	const handleParamChange =
		(setter: React.Dispatch<React.SetStateAction<number>>) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const displayValue = parseFloat(e.target.value) || 0;
			const mmValue = convertUnit(displayValue, units, "mm");
			setter(mmValue);

			if (setter === setCutDepth) {
				setHalfCutDepth(mmValue / 2);
			}
		};

	const handleHalfCutParamChange =
		(setter: React.Dispatch<React.SetStateAction<number>>) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const displayValue = parseFloat(e.target.value) || 0;
			const mmValue = convertUnit(displayValue, units, "mm");
			setter(mmValue);
		};

	const toggleUnits = () => {
		setUnits((prev) => (prev === "mm" ? "in" : "mm"));
	};

	const addNewGroup = () => {
		const id = newId();
		const newGroup: Group = {
			id,
			name: `Group ${groups.size + 1}`,
			pieces: new Map<string, Piece>(),
			fullCuts: new Map<string, Cut>(),
		};
		setGroups((prev) => new Map(prev).set(id, newGroup));
		setActiveGroupId(id);
	};

	const deleteGroup = (id: string) => {
		if (groups.size <= 1) {
			alert("Cannot delete the last group.");
			return;
		}
		setGroups((prev) => {
			const next = new Map(prev);
			next.delete(id);
			if (activeGroupId === id) {
				const first = next.keys().next().value;
				if (first) setActiveGroupId(first);
			}
			return next;
		});
	};

	const handleLayoutClick = (point: Point, rowIndex: number) => {
		const { x, y } = point;

		if (selectedPieceId && activeGroup) {
			const id = newId();
			setGroups((prev) => {
				const next = new Map(prev);
				const group = next.get(activeGroupId);
				if (group) {
					group.pieces.set(id, {
						id,
						lineId: selectedPieceId,
						x,
						y,
						rotation: rowIndex, // Store row index in rotation field
					});
				}
				return next;
			});
		}
	};

	const deleteLayoutItem = (type: "piece", id: string) => {
		setGroups((prev) => {
			const next = new Map(prev);
			const group = next.get(activeGroupId);
			if (group) {
				group.pieces.delete(id);
			}
			return next;
		});
	};

	const downloadSVG = () => {
		const svg = generateGroupSVG({
			group: activeGroup,
			designStrips,
			bitSize,
			stockLength,
		});
		if (!svg) return;
		const blob = new Blob([svg], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${activeGroup?.name || "kumiko-group"}.svg`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const downloadAllGroupsSVG = () => {
		for (const group of groups.values()) {
			const svg = generateGroupSVG({
				group,
				designStrips,
				bitSize,
				stockLength,
			});
			if (!svg) continue;

			const blob = new Blob([svg], { type: "image/svg+xml" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${group.name || "kumiko-group"}.svg`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	};
	// Export current design to JSON file
	const handleExportJSON = () => {
		const payload: SavedDesignPayload = {
			version: 1 as const,
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			// Derived legacy stripLength for backwards compatibility: treat as a wide grid
			stripLength: gridCellSize * LEGACY_GRID_COLUMNS,
			stockLength,
			gridCellSize,
			gridSize: LEGACY_GRID_COLUMNS,
			gridSizeX: LEGACY_GRID_COLUMNS,
			gridSizeY: LEGACY_GRID_COLUMNS,
			lines: Array.from(lines.values()),
			groups: Array.from(groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				pieces: Array.from(g.pieces.values()),
				fullCuts: Array.from(g.fullCuts.values()),
			})),
			activeGroupId,
			designName: designName || undefined,
			intersectionStates: Array.from(intersectionStates.entries()),
		};

		const jsonString = JSON.stringify(payload, null, 2);
		const blob = new Blob([jsonString], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${designName || "kumiko-design"}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
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
					alert("Invalid file format or version.");
					return;
				}

				if (!parsed.lines || !parsed.groups) {
					alert("Invalid design file: missing required data.");
					return;
				}

				// Confirm before overwriting current design
				if (lines.size > 0 || groups.size > 0) {
					if (!window.confirm("Import this design? Your current work will be replaced.")) {
						return;
					}
				}

				applyLoadedDesign(parsed);
				alert(`Design "${parsed.designName || "Untitled"}" imported successfully!`);
			} catch (error) {
				console.error("Failed to import design:", error);
				alert("Failed to import design. Please check the file format.");
			}
		};
		reader.readAsText(file);
		
		// Reset the input so the same file can be imported again
		event.target.value = "";
	};




	const displayUnit = units;

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
						lines={lines}
						intersections={intersections}
						drawingLine={drawingLine}
						onGridClick={handleGridClick}
						onCreateLine={handleCreateLine}
						onToggleIntersection={toggleIntersection}
						onDragUpdate={handleDragUpdate}
						isDeleting={isDeleting}
						bitSize={bitSize}
						gridCellSize={gridCellSize}
						hoveredStripId={hoveredStripId}
						viewState={gridViewState}
						onViewStateChange={setGridViewState}
					/>
				)}

				{step === "layout" && (
					<LayoutEditor
						designStrips={designStrips}
						activeGroup={activeGroup}
						groups={groups}
						activeGroupId={activeGroupId}
						setActiveGroupId={setActiveGroupId}
						addNewGroup={addNewGroup}
						deleteGroup={deleteGroup}
						selectedPieceId={selectedPieceId}
						setSelectedPieceId={setSelectedPieceId}
						onLayoutClick={handleLayoutClick}
						stockLength={stockLength}
						bitSize={bitSize}
						halfCutDepth={halfCutDepth}
						cutDepth={cutDepth}
						onDownload={downloadSVG}
						onDownloadAllGroups={downloadAllGroupsSVG}
						onDeleteLayoutItem={deleteLayoutItem}
						onHoverStrip={setHoveredStripId}
						layoutRows={layoutRows}
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
				onToggleUnits={toggleUnits}
				bitSize={bitSize}
				cutDepth={cutDepth}
				halfCutDepth={halfCutDepth}
				gridCellSize={gridCellSize}
				stockLength={stockLength}
				layoutRows={layoutRows}
				onBitSizeChange={handleParamChange(setBitSize)}
				onCutDepthChange={handleParamChange(setCutDepth)}
				onHalfCutDepthChange={handleHalfCutParamChange(setHalfCutDepth)}
				onGridCellSizeChange={handleParamChange(setGridCellSize)}
				onStockLengthChange={handleParamChange(setStockLength)}
				onLayoutRowsChange={(e) =>
					setLayoutRows(
						Number.isFinite(parseInt(e.target.value, 10))
							? parseInt(e.target.value, 10)
							: layoutRows,
					)
				}
			/>
		</div>
	);
}

export const Route = createFileRoute("/")({
	component: App,
});
