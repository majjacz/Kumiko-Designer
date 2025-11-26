import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { GridRenderer } from "../../components/kumiko/GridRenderer";
import { useKumiko } from "../../context/KumikoContext";
import { useGridCoordinates } from "../../hooks/useGridCoordinates";
import { useZoomPan } from "../../hooks/useZoomPan";
import { GRID_EXTENT_CELLS } from "./config";
import type { GridViewState, Intersection, Line, Point } from "./kumiko-core";

/**
 * Kumiko Grid Designer - Rewritten for proper coordinate handling and drag-based interaction
 *
 * Key features:
 * - Drag to draw lines (not click-click)
 * - Proper SVG coordinate transformation using getScreenCTM()
 * - Smooth pan/zoom with middle mouse or wheel
 * - Grid snapping for precise alignment
 */

export type { GridViewState };

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
	gridCellSize: number; // Physical size of one grid cell in mm
	hoveredStripId?: string | null;
	/**
	 * Optional mapping from grid Line.id to a user-facing label. This lets the
	 * grid show stable strip IDs derived from physical geometry instead of
	 * opaque, ever-changing line ids.
	 */
	lineLabelById?: Map<string, string>;
	/** Optional externally-controlled view state (for persistence across reloads). */
	viewState?: GridViewState;
	/** Notify parent when view state changes so it can be persisted. */
	onViewStateChange?: (state: GridViewState) => void;
}

interface DragState {
	startPoint: Point;
	currentPoint: Point;
}

export function GridDesigner({
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
	hoveredStripId,
	lineLabelById,
	viewState,
	onViewStateChange,
}: GridDesignerProps) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const contentGroupRef = useRef<SVGGElement | null>(null);

	// Viewport state flags (zoom/pan are handled by useZoomPan)
	const [showNotchPositions, setShowNotchPositions] = useState(
		viewState?.showNotchPositions ?? true,
	);
	const [showHelpText, setShowHelpText] = useState(
		viewState?.showHelpText ?? true,
	);
	const [showLineIds, setShowLineIds] = useState(
		viewState?.showLineIds ?? true,
	);

	// Interaction state
	const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [isHoveringNotch, setIsHoveringNotch] = useState(false);

	// For the designer view, keep individual grid cells visually square.
	// Use a large fixed grid extent so users are not constrained by a small canvas.
	const cellSize = useMemo(() => gridCellSize, [gridCellSize]);
	const designWidth = useMemo(() => GRID_EXTENT_CELLS * cellSize, [cellSize]);
	const designHeight = useMemo(() => GRID_EXTENT_CELLS * cellSize, [cellSize]);

	// Hooks
	const { screenToGrid, gridToSvg } = useGridCoordinates({
		svgRef,
		contentGroupRef,
		cellSize,
		gridExtentCells: GRID_EXTENT_CELLS,
	});

	const { zoom, panX, panY, resetView, zoomBy, DEFAULT_ZOOM } = useZoomPan({
		svgRef,
		contentGroupRef,
		lines,
		cellSize,
		designWidth,
		designHeight,
		viewState,
		onViewStateChange,
		flags: { showNotchPositions, showHelpText, showLineIds },
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
			className="flex-1 bg-gray-800 p-4 m-4 rounded-lg shadow-inner overflow-hidden relative"
			style={{
				userSelect: dragState ? "none" : "auto",
				WebkitUserSelect: dragState ? "none" : "auto",
				MozUserSelect: dragState ? "none" : "auto",
			}}
		>
			{/* Zoom controls */}
			<div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
				<div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm">
					<div className="text-xs text-gray-400 mb-1">
						Zoom: {Math.round((zoom / DEFAULT_ZOOM) * 100)}%
					</div>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => zoomBy(1.5)}
							className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
							title="Zoom In"
						>
							+
						</button>
						<button
							type="button"
							onClick={() => zoomBy(1 / 1.5)}
							className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
							title="Zoom Out"
						>
							−
						</button>
						<button
							type="button"
							onClick={resetView}
							className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
							title="Reset View"
						>
							Fit
						</button>
					</div>
					<div className="mt-2 space-y-1 text-xs text-gray-300">
						<label className="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								className="h-3 w-3 rounded border-gray-500 bg-gray-800"
								checked={showNotchPositions}
								onChange={(e) => {
									const next = e.target.checked;
									setShowNotchPositions(next);
									if (onViewStateChange) {
										onViewStateChange({
											zoom,
											panX,
											panY,
											showNotchPositions: next,
											showHelpText,
											showLineIds,
										});
									}
								}}
							/>
							<span>Show notch markers</span>
						</label>
						<label className="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								className="h-3 w-3 rounded border-gray-500 bg-gray-800"
								checked={showHelpText}
								onChange={(e) => {
									const next = e.target.checked;
									setShowHelpText(next);
									if (onViewStateChange) {
										onViewStateChange({
											zoom,
											panX,
											panY,
											showNotchPositions,
											showHelpText: next,
											showLineIds,
										});
									}
								}}
							/>
							<span>Show help text</span>
						</label>
						<label className="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								className="h-3 w-3 rounded border-gray-500 bg-gray-800"
								checked={showLineIds}
								onChange={(e) => {
									const next = e.target.checked;
									setShowLineIds(next);
									if (onViewStateChange) {
										onViewStateChange({
											zoom,
											panX,
											panY,
											showNotchPositions,
											showHelpText,
											showLineIds: next,
										});
									}
								}}
							/>
							<span>Show line IDs</span>
						</label>
					</div>
				</div>
			</div>

			{/* Help text */}
			{showHelpText && (
				<div className="absolute bottom-4 left-4 z-10">
					<div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-xs text-gray-400 space-y-0.5">
						<div>
							Drag on the grid to draw lines. Drag across an existing line to
							remove a segment.
						</div>
						<div>
							Click a notch symbol on a horizontal strip to toggle which strip
							is on top (triangle pointing down = cut from bottom, triangle
							pointing up = cut from top).
						</div>
						<div>Middle mouse drag or two-finger scroll to pan the view.</div>
						<div>Pinch on trackpad (or Ctrl+scroll) to zoom in and out.</div>
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
						designWidth={designWidth}
						designHeight={designHeight}
						gridExtentCells={GRID_EXTENT_CELLS}
						showNotchPositions={showNotchPositions}
						showLineIds={showLineIds}
						hoveredStripId={hoveredStripId}
						lineLabelById={lineLabelById}
						onToggleIntersection={onToggleIntersection}
						setIsHoveringNotch={setIsHoveringNotch}
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
	const { designState, designActions, layoutState, params } = useKumiko();

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
			hoveredStripId={layoutState.hoveredStripId}
			lineLabelById={designState.lineLabelById}
			viewState={designState.gridViewState}
			onViewStateChange={designActions.setGridViewState}
		/>
	);
}
