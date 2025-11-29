import { useMemo } from "react";
import type { Intersection, Line, Point } from "../../lib/kumiko";
import { DragPreview } from "./DragPreview";
import { GridBackground } from "./GridBackground";
import { IntersectionMarker } from "./IntersectionMarker";
import { type SvgLine, useLineRenderer } from "./LineRenderer";

interface GridRendererProps {
	lines: Map<string, Line>;
	intersections: Map<string, Intersection>;
	drawingLine: Point | null;
	dragState: { startPoint: Point; currentPoint: Point } | null;
	hoverPoint: Point | null;
	isDeleting: boolean;
	bitSize: number;
	zoom: number;
	cellSize: number;
	/** Physical grid cell size in mm for dimension calculations */
	physicalCellSize: number;
	designWidth: number;
	designHeight: number;
	gridExtentCells: number;
	showNotchPositions: boolean;
	showLineIds: boolean;
	showDimensions: boolean;
	displayUnit: "mm" | "in";
	hoveredStripId?: string | null;
	lineLabelById?: Map<string, string>;
	onToggleIntersection: (id: string) => void;
	setIsHoveringNotch: (isHovering: boolean) => void;
	onHoverLine?: (lineId: string | null) => void;
	gridToSvg: (point: Point) => { x: number; y: number };
}

export function GridRenderer({
	lines,
	intersections,
	drawingLine,
	dragState,
	hoverPoint,
	isDeleting,
	bitSize,
	zoom,
	cellSize,
	physicalCellSize,
	designWidth,
	designHeight,
	gridExtentCells,
	showNotchPositions,
	showLineIds,
	showDimensions,
	displayUnit,
	hoveredStripId,
	lineLabelById,
	onToggleIntersection,
	setIsHoveringNotch,
	onHoverLine,
	gridToSvg,
}: GridRendererProps) {
	// Precompute SVG-space coordinates for all user lines
	const svgLines: SvgLine[] = useMemo(
		() =>
			Array.from(lines.values()).map((line) => ({
				line,
				start: gridToSvg({ x: line.x1, y: line.y1 }),
				end: gridToSvg({ x: line.x2, y: line.y2 }),
			})),
		[lines, gridToSvg],
	);

	// Get line strokes and labels separately for z-order control
	const { lineStrokes, lineLabels } = useLineRenderer({
		svgLines,
		bitSize,
		zoom,
		cellSize,
		physicalCellSize,
		hoveredStripId,
		showLineIds,
		showDimensions,
		displayUnit,
		lineLabelById,
		onHoverLine,
	});

	// Render intersections as notch symbols
	const intersectionElements = useMemo(
		() =>
			Array.from(intersections.values()).map((intersection) => {
				const pos = gridToSvg({ x: intersection.x, y: intersection.y });

				return (
					<IntersectionMarker
						key={intersection.id}
						intersection={intersection}
						lines={lines}
						position={pos}
						bitSize={bitSize}
						zoom={zoom}
						onToggle={onToggleIntersection}
						onHoverStart={() => setIsHoveringNotch(true)}
						onHoverEnd={() => setIsHoveringNotch(false)}
					/>
				);
			}),
		[
			lines,
			intersections,
			gridToSvg,
			bitSize,
			zoom,
			onToggleIntersection,
			setIsHoveringNotch,
		],
	);

	// Render drawing line start point
	const drawingElement = useMemo(() => {
		if (!drawingLine) return null;
		const pos = gridToSvg(drawingLine);
		return (
			<circle
				cx={pos.x}
				cy={pos.y}
				r={Math.max(2, bitSize / 2)}
				fill="#34D399"
				stroke="#10B981"
				strokeWidth={1}
			/>
		);
	}, [drawingLine, gridToSvg, bitSize]);

	// Render hover point
	const hoverElement = useMemo(() => {
		if (!hoverPoint || dragState) return null;
		const pos = gridToSvg(hoverPoint);
		return (
			<circle
				cx={pos.x}
				cy={pos.y}
				r={Math.max(1, bitSize / 3)}
				fill="#8B5CF6"
				opacity={0.6}
				stroke="#7C3AED"
				strokeWidth={1}
			/>
		);
	}, [hoverPoint, dragState, gridToSvg, bitSize]);

	return (
		<>
			{/* Background with grid */}
			<GridBackground
				cellSize={cellSize}
				designWidth={designWidth}
				designHeight={designHeight}
				zoom={zoom}
				gridExtentCells={gridExtentCells}
			/>

			{/* Interactive elements */}
			{drawingElement}
			<DragPreview
				dragState={dragState}
				isDeleting={isDeleting}
				bitSize={bitSize}
				gridToSvg={gridToSvg}
			/>
			{hoverElement}

			{/* User-drawn lines (strokes only) */}
			{lineStrokes}

			{/* Intersection markers */}
			{showNotchPositions && intersectionElements}

			{/* Line labels on top of everything */}
			{lineLabels}
		</>
	);
}
