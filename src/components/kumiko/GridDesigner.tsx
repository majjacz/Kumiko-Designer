import { HelpCircle, Maximize2, Minus, Plus } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useKumiko } from "../../context/KumikoContext";
import { useGridCoordinates } from "../../hooks/useGridCoordinates";
import type { GridViewSettings } from "../../hooks/useGridViewSettings";
import { useZoomPan } from "../../hooks/useZoomPan";
import {
	DEFAULT_ZOOM,
	GRID_EXTENT_CELLS,
	VISUAL_GRID_CELL_SIZE,
} from "../../lib/kumiko/config";
import type {
	Intersection,
	Line,
	Point,
	ZoomPanState,
} from "../../lib/kumiko/types";
import { GridRenderer } from "./GridRenderer";

/**
 * Kumiko Grid Designer - Rewritten for proper coordinate handling and drag-based interaction
 *
 * Key features:
 * - Drag to draw lines (not click-click)
 * - Proper SVG coordinate transformation using getScreenCTM()
 * - Smooth pan/zoom with middle mouse or wheel
 * - Grid snapping for precise alignment
 */

export interface GridDesignerProps {
	lines: Map<string, Line>;
	intersections: Map<string, Intersection>;
	drawingLine: Point | null;
	onGridClick: (point: Point) => void;
	onCreateLine?: (start: Point, end: Point) => void;
	onToggleIntersection: (id: string) => void;
	onDragUpdate?: (start: Point, end: Point, isDeleting: boolean) => void;
	isDeleting?: boolean;
	bitSize: number;
	/** Physical grid cell size in mm (for dimension calculations) */
	gridCellSize: number;
	displayUnit: "mm" | "in"; // Unit for displaying dimensions
	hoveredStripId?: string | null;
	/** Callback when hovering over a line or label */
	onHoverLine?: (lineId: string | null) => void;
	/**
	 * Optional mapping from grid Line.id to a user-facing label. This lets the
	 * grid show stable strip IDs derived from physical geometry instead of
	 * opaque, ever-changing line ids.
	 */
	lineLabelById?: Map<string, string>;
	/** Optional externally-controlled zoom/pan state (for persistence across reloads). */
	zoomPanState?: ZoomPanState;
	/** Notify parent when zoom/pan state changes so it can be persisted. */
	onZoomPanChange?: (state: ZoomPanState) => void;
	/** View settings for UI toggles (passed from context) */
	viewSettings: GridViewSettings;
	/** Actions to update view settings */
	viewSettingsActions: {
		setShowNotchPositions: (value: boolean) => void;
		setShowHelpText: (value: boolean) => void;
		setShowLineIds: (value: boolean) => void;
		setShowDimensions: (value: boolean) => void;
	};
}

interface DragState {
	startPoint: Point;
	currentPoint: Point;
}

function GridDesigner({
	lines,
	intersections,
	drawingLine,
	onGridClick,
	onCreateLine,
	onToggleIntersection,
	onDragUpdate,
	isDeleting = false,
	bitSize,
	gridCellSize,
	displayUnit,
	hoveredStripId,
	onHoverLine,
	lineLabelById,
	zoomPanState,
	onZoomPanChange,
	viewSettings,
	viewSettingsActions,
}: GridDesignerProps) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const contentGroupRef = useRef<SVGGElement | null>(null);

	// View settings from props (managed by context with localStorage persistence)
	const { showNotchPositions, showHelpText, showLineIds, showDimensions } =
		viewSettings;

	// Interaction state
	const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [isHoveringNotch, setIsHoveringNotch] = useState(false);

	// For the designer view, use a fixed visual cell size for grid rendering.
	// The configurable gridCellSize parameter is only used for physical strip calculations.
	const cellSize = VISUAL_GRID_CELL_SIZE;
	const designWidth = useMemo(() => GRID_EXTENT_CELLS * cellSize, [cellSize]);
	const designHeight = useMemo(() => GRID_EXTENT_CELLS * cellSize, [cellSize]);

	// Hooks
	const { screenToGrid, gridToSvg } = useGridCoordinates({
		svgRef,
		contentGroupRef,
		cellSize,
		gridExtentCells: GRID_EXTENT_CELLS,
	});

	const {
		state: { zoom },
		actions: { resetView, zoomBy },
	} = useZoomPan({
		svgRef,
		contentGroupRef,
		lines,
		cellSize,
		designWidth,
		designHeight,
		zoomPanState,
		onZoomPanChange,
	});

	/**
	 * Handle mouse down - start drawing
	 */
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (e.button === 0) {
				// If this mouse down started on a notch toggle marker, ignore it
				// completely so we don't start a line-drawing interaction.
				const target = e.target as HTMLElement | null;
				if (target?.closest('[data-testid="intersection-toggle"]')) {
					return;
				}

				// Left mouse button - start potential drag for line drawing
				const gridPt = screenToGrid(e.clientX, e.clientY);
				if (gridPt) {
					setDragState({
						startPoint: gridPt,
						currentPoint: gridPt,
					});
				}
			}
		},
		[screenToGrid],
	);

	/**
	 * Handle mouse move - update drag state or hover
	 */
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			const gridPt = screenToGrid(e.clientX, e.clientY);

			if (dragState) {
				// Update drag end point
				if (gridPt) {
					setDragState({
						...dragState,
						currentPoint: gridPt,
					});
					// Notify parent about drag update for overlap detection
					if (onDragUpdate) {
						onDragUpdate(dragState.startPoint, gridPt, false);
					}
				}
			} else {
				// Update hover point
				setHoverPoint(gridPt);
			}
		},
		[dragState, screenToGrid, onDragUpdate],
	);

	/**
	 * Handle mouse up - complete drawing
	 */
	const handleMouseUp = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (e.button === 0 && dragState) {
				const { startPoint, currentPoint } = dragState;
				const isDragged =
					startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y;

				if (isDragged) {
					// User dragged - create a complete line
					if (drawingLine) {
						// Complete existing drawing line
						onGridClick(currentPoint);
					} else if (onCreateLine) {
						// Use dedicated callback for creating complete line in one action
						onCreateLine(startPoint, currentPoint);
					} else {
						// Fallback: simulate two clicks (may not work due to state batching)
						onGridClick(startPoint);
						onGridClick(currentPoint);
					}
				} else {
					// Single click without drag
					onGridClick(startPoint);
				}

				setDragState(null);
			}
		},
		[dragState, drawingLine, onGridClick, onCreateLine],
	);

	/**
	 * Handle mouse leave - clean up hover state
	 */
	const handleMouseLeave = useCallback(() => {
		setHoverPoint(null);
	}, []);

	return (
		<div
			className="flex-1 bg-gray-900/50 m-4 rounded-xl shadow-lg overflow-hidden relative border border-gray-800"
			style={{
				userSelect: dragState ? "none" : "auto",
				WebkitUserSelect: dragState ? "none" : "auto",
				MozUserSelect: dragState ? "none" : "auto",
			}}
		>
			{/* Floating toolbar - top right */}
			<div className="absolute top-4 right-4 z-10 flex items-start gap-2">
				{/* Zoom controls */}
				<div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl overflow-hidden">
					<div className="flex items-center gap-1 p-1.5">
						<button
							type="button"
							onClick={() => zoomBy(1.5)}
							className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
							title="Zoom In (+)"
						>
							<Plus className="w-4 h-4" />
						</button>
						<div className="px-2 py-1 min-w-[52px] text-center text-sm font-medium text-gray-300">
							{Math.round((zoom / DEFAULT_ZOOM) * 100)}%
						</div>
						<button
							type="button"
							onClick={() => zoomBy(1 / 1.5)}
							className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
							title="Zoom Out (-)"
						>
							<Minus className="w-4 h-4" />
						</button>
						<div className="w-px h-6 bg-gray-700 mx-1" />
						<button
							type="button"
							onClick={resetView}
							className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
							title="Fit to View (F)"
						>
							<Maximize2 className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* View options */}
				<div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl overflow-hidden">
					<div className="p-2 space-y-1">
						<label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
								checked={showNotchPositions}
								onChange={(e) =>
									viewSettingsActions.setShowNotchPositions(e.target.checked)
								}
							/>
							<span className="text-sm text-gray-300">Notch markers</span>
						</label>
						<label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
								checked={showLineIds}
								onChange={(e) =>
									viewSettingsActions.setShowLineIds(e.target.checked)
								}
							/>
							<span className="text-sm text-gray-300">Strip IDs</span>
						</label>
						<label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
								checked={showDimensions}
								onChange={(e) =>
									viewSettingsActions.setShowDimensions(e.target.checked)
								}
							/>
							<span className="text-sm text-gray-300">Dimensions</span>
						</label>
						<div className="border-t border-gray-700 my-1.5" />
						<label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
								checked={showHelpText}
								onChange={(e) =>
									viewSettingsActions.setShowHelpText(e.target.checked)
								}
							/>
							<span className="text-sm text-gray-300">Help tips</span>
						</label>
					</div>
				</div>
			</div>

			{/* Help panel - bottom left */}
			{showHelpText && (
				<div className="absolute bottom-4 left-4 z-10 max-w-sm">
					<div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-4">
						<div className="flex items-center gap-2 mb-3">
							<HelpCircle className="w-4 h-4 text-indigo-400" />
							<span className="text-sm font-medium text-gray-200">
								How to use
							</span>
						</div>
						<div className="space-y-2 text-xs text-gray-400">
							<div className="flex items-start gap-2">
								<span className="flex-shrink-0 w-5 h-5 rounded bg-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-300">
									1
								</span>
								<span>
									<strong className="text-gray-300">Draw:</strong> Drag on the
									grid to create lines
								</span>
							</div>
							<div className="flex items-start gap-2">
								<span className="flex-shrink-0 w-5 h-5 rounded bg-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-300">
									2
								</span>
								<span>
									<strong className="text-gray-300">Delete:</strong> Drag across
									a line to remove it
								</span>
							</div>
							<div className="flex items-start gap-2">
								<span className="flex-shrink-0 w-5 h-5 rounded bg-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-300">
									3
								</span>
								<span>
									<strong className="text-gray-300">Notches:</strong> Click
									markers to toggle which strip is on top
								</span>
							</div>
						</div>
						<div className="mt-3 pt-3 border-t border-gray-800">
							<div className="text-xs text-gray-500">
								<span className="inline-block px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">
									Scroll
								</span>{" "}
								to pan
								<span className="mx-2">·</span>
								<span className="inline-block px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">
									Ctrl+Scroll
								</span>{" "}
								to zoom
							</div>
							{showDimensions && (
								<div className="mt-2 text-xs text-gray-500">
									Dimensions shown in{" "}
									<span className="text-gray-400 font-medium">
										{displayUnit === "mm" ? "millimeters (mm)" : "inches (in)"}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* SVG Canvas */}
			<svg
				data-testid="grid-canvas"
				ref={svgRef}
				viewBox={`0 0 ${designWidth} ${designHeight}`}
				className="w-full h-full bg-gray-900 border border-gray-700 rounded"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onContextMenu={(e) => e.preventDefault()}
				style={{
					// Use a pointer cursor when hovering a notch toggle so it's clearly clickable;
					// otherwise show the crosshair cursor for drawing on the grid.
					cursor: isHoveringNotch ? "pointer" : "crosshair",
					touchAction: "none",
					userSelect: "none",
					WebkitUserSelect: "none",
				}}
			>
				<title>Kumiko grid designer - Drag to draw lines</title>

				<g ref={contentGroupRef}>
					<GridRenderer
						lines={lines}
						intersections={intersections}
						drawingLine={drawingLine}
						dragState={dragState}
						hoverPoint={hoverPoint}
						isDeleting={isDeleting}
						bitSize={bitSize}
						zoom={zoom}
						cellSize={cellSize}
						physicalCellSize={gridCellSize}
						designWidth={designWidth}
						designHeight={designHeight}
						gridExtentCells={GRID_EXTENT_CELLS}
						showNotchPositions={showNotchPositions}
						showLineIds={showLineIds}
						showDimensions={showDimensions}
						displayUnit={displayUnit}
						hoveredStripId={hoveredStripId}
						lineLabelById={lineLabelById}
						onToggleIntersection={onToggleIntersection}
						setIsHoveringNotch={setIsHoveringNotch}
						onHoverLine={onHoverLine}
						gridToSvg={gridToSvg}
					/>
				</g>
			</svg>
		</div>
	);
}

/**
 * Context-connected version of GridDesigner.
 * Automatically consumes state from KumikoContext.
 */
export function GridDesignerConnected() {
	const {
		designState,
		designActions,
		layoutState,
		layoutActions,
		params,
		viewSettings,
		viewSettingsActions,
	} = useKumiko();

	return (
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
			displayUnit={params.units}
			hoveredStripId={layoutState.hoveredStripId}
			onHoverLine={layoutActions.setHoveredStripId}
			lineLabelById={designState.lineLabelById}
			zoomPanState={designState.zoomPanState}
			onZoomPanChange={designActions.setZoomPanState}
			viewSettings={viewSettings}
			viewSettingsActions={viewSettingsActions}
		/>
	);
}
