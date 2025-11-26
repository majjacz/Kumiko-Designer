import type React from "react";
import { useMemo } from "react";
import {
	distancePointToSegment,
	formatValue,
	type Line,
} from "../../lib/kumiko";

export interface SvgLine {
	line: Line;
	start: { x: number; y: number };
	end: { x: number; y: number };
}

export interface LineRendererProps {
	/** SVG-space lines with precomputed start/end coordinates */
	svgLines: SvgLine[];
	/** Bit size in mm */
	bitSize: number;
	/** Current zoom level */
	zoom: number;
	/** Grid cell size in mm */
	cellSize: number;
	/** ID of the strip being hovered (for highlighting) */
	hoveredStripId?: string | null;
	/** Whether to show line ID labels */
	showLineIds: boolean;
	/** Whether to show line dimension labels */
	showDimensions: boolean;
	/** Display unit for dimensions */
	displayUnit: "mm" | "in";
	/** Map of line IDs to their display labels */
	lineLabelById?: Map<string, string>;
	/** Callback when hovering over a line or label */
	onHoverLine?: (lineId: string | null) => void;
}

interface LabelPlacement {
	lineId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Check if two axis-aligned rectangles overlap */
function rectsOverlap(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number },
	padding = 0,
): boolean {
	return !(
		a.x + a.width + padding < b.x ||
		b.x + b.width + padding < a.x ||
		a.y + a.height + padding < b.y ||
		b.y + b.height + padding < a.y
	);
}

/** Calculate overlap area between two rectangles */
function overlapArea(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number },
): number {
	const xOverlap = Math.max(
		0,
		Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
	);
	const yOverlap = Math.max(
		0,
		Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
	);
	return xOverlap * yOverlap;
}

/**
 * LineRenderer renders user-drawn lines as SVG strokes with optional labels.
 * Labels are positioned to avoid overlapping with each other and with lines.
 */
export function LineRenderer({
	svgLines,
	bitSize,
	zoom,
	cellSize,
	hoveredStripId,
	showLineIds,
	showDimensions,
	displayUnit,
	lineLabelById,
	onHoverLine,
}: LineRendererProps) {
	const { lineStrokes, lineLabels } = useMemo(() => {
		const strokes: React.ReactElement[] = [];

		// Pre-calculate label data for all lines
		interface LabelData {
			line: Line;
			start: { x: number; y: number };
			end: { x: number; y: number };
			labelText: string;
			rectWidth: number;
			rectHeight: number;
			isHovered: boolean;
		}

		const baseFontPx = 80;
		const paddingXPx = 10;
		const paddingYPx = 6;
		const fontSize = baseFontPx / zoom;
		const approxCharWidthPx = baseFontPx * 0.6;

		const labelDataList: LabelData[] = [];

		for (const { line, start, end } of svgLines) {
			const isHovered = line.id === hoveredStripId;

			strokes.push(
				// biome-ignore lint/a11y/useSemanticElements: SVG line hover for visual feedback
				<line
					key={line.id}
					role="button"
					tabIndex={-1}
					x1={start.x}
					y1={start.y}
					x2={end.x}
					y2={end.y}
					stroke={isHovered ? "#FBBF24" : "#60A5FA"}
					strokeWidth={
						isHovered ? Math.max(2, bitSize / 2) : Math.max(1, bitSize / 4)
					}
					strokeLinecap="round"
					pointerEvents="stroke"
					onMouseEnter={() => onHoverLine?.(line.id)}
					onMouseLeave={() => onHoverLine?.(null)}
				/>,
			);

			// Skip label rendering if neither IDs nor dimensions are shown
			if (!showLineIds && !showDimensions) continue;

			// Calculate line length in mm (based on grid coordinates)
			const gridDx = line.x2 - line.x1;
			const gridDy = line.y2 - line.y1;
			const lengthInMm = Math.hypot(gridDx, gridDy) * cellSize;
			const dimensionText = formatValue(lengthInMm, displayUnit);

			// Build label text based on what's enabled
			const rawIdSuffix = line.id.length > 4 ? line.id.slice(-4) : line.id;
			const idLabel = lineLabelById?.get(line.id) ?? rawIdSuffix;

			let labelText: string;
			if (showLineIds && showDimensions) {
				labelText = `${idLabel} (${dimensionText})`;
			} else if (showDimensions) {
				labelText = dimensionText;
			} else {
				labelText = idLabel;
			}

			const labelLength = labelText.length;
			const rectWidth =
				(labelLength * approxCharWidthPx + paddingXPx * 2) / zoom;
			const rectHeight = (baseFontPx + paddingYPx * 2) / zoom;

			labelDataList.push({
				line,
				start,
				end,
				labelText,
				rectWidth,
				rectHeight,
				isHovered,
			});
		}

		// Place labels using a greedy algorithm that avoids overlaps
		const placedLabels: LabelPlacement[] = [];
		const labels: React.ReactElement[] = [];

		// Positions along line to try: center, then offset positions
		const tPositions = [0.5, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85];
		// Directions perpendicular to line to try
		const directions = [1, -1];
		// Multiple offset distances to try
		const offsetMultipliers = [1, 1.5, 2, 2.5, 3];

		for (const data of labelDataList) {
			const { line, start, end, labelText, rectWidth, rectHeight, isHovered } =
				data;

			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const length = Math.hypot(dx, dy) || 1;

			// Normal vector (perpendicular to line)
			const normalX = -dy / length;
			const normalY = dx / length;

			const isHorizontal = line.y1 === line.y2 && line.x1 !== line.x2;
			const isVertical = line.x1 === line.x2 && line.y1 !== line.y2;

			// Base offset distance from line
			let baseOffset: number;
			if (isHorizontal || isVertical) {
				baseOffset = Math.max(cellSize * 0.4, rectHeight * 0.6);
			} else {
				const baseOffsetPx = 4;
				baseOffset = Math.max(baseOffsetPx / zoom, rectHeight * 0.6);
			}

			let bestPosition: { x: number; y: number } | null = null;
			let bestScore = -Infinity;

			// Try all candidate positions
			for (const t of tPositions) {
				// Point along the line at parameter t
				const pointX = start.x + dx * t;
				const pointY = start.y + dy * t;

				for (const dir of directions) {
					for (const mult of offsetMultipliers) {
						const offsetDistance = baseOffset * mult;
						const cx = pointX + normalX * offsetDistance * dir;
						const cy = pointY + normalY * offsetDistance * dir;

						// Create candidate rectangle (top-left corner)
						const candidateRect = {
							x: cx - rectWidth / 2,
							y: cy - rectHeight / 2,
							width: rectWidth,
							height: rectHeight,
						};

						// Check overlap with already placed labels
						let hasLabelOverlap = false;
						let totalOverlapArea = 0;
						for (const placed of placedLabels) {
							if (rectsOverlap(candidateRect, placed, 2)) {
								hasLabelOverlap = true;
								totalOverlapArea += overlapArea(candidateRect, placed);
							}
						}

						// Calculate minimum distance to all lines
						let minLineDistance = Infinity;
						for (const { start: s, end: e } of svgLines) {
							const d = distancePointToSegment(cx, cy, s.x, s.y, e.x, e.y);
							if (d < minLineDistance) minLineDistance = d;
						}

						// Score: prefer positions with no label overlap, closer to line center (t=0.5),
						// and farther from lines
						let score = 0;

						// Heavy penalty for label overlaps
						if (hasLabelOverlap) {
							score -= 10000 + totalOverlapArea;
						}

						// Prefer positions closer to center of line
						const centerPreference = 1 - Math.abs(t - 0.5) * 2; // 1 at center, 0 at ends
						score += centerPreference * 100;

						// Prefer smaller offset multipliers (closer to line)
						score -= mult * 10;

						// Prefer farther from other lines
						score += Math.min(minLineDistance, rectHeight * 2);

						if (score > bestScore) {
							bestScore = score;
							bestPosition = { x: cx, y: cy };
						}
					}
				}
			}

			// Use best position found
			const labelCenterX = bestPosition?.x ?? start.x + dx * 0.5;
			const labelCenterY = bestPosition?.y ?? start.y + dy * 0.5;

			// Record this placement for future collision detection
			placedLabels.push({
				lineId: line.id,
				x: labelCenterX - rectWidth / 2,
				y: labelCenterY - rectHeight / 2,
				width: rectWidth,
				height: rectHeight,
			});

			const rectX = labelCenterX - rectWidth / 2;
			const rectY = labelCenterY - rectHeight / 2;

			labels.push(
				// biome-ignore lint/a11y/useSemanticElements: SVG group for label hover
				<g
					key={`${line.id}-label`}
					role="button"
					tabIndex={-1}
					onMouseEnter={() => onHoverLine?.(line.id)}
					onMouseLeave={() => onHoverLine?.(null)}
				>
					<rect
						x={rectX}
						y={rectY}
						width={rectWidth}
						height={rectHeight}
						fill={isHovered ? "rgba(251,191,36,0.15)" : "rgba(0,0,0,0.8)"}
						rx={2}
					/>
					<text
						x={labelCenterX}
						y={labelCenterY}
						fill={isHovered ? "#FBBF24" : "#E5E7EB"}
						fontSize={fontSize}
						textAnchor="middle"
						dominantBaseline="middle"
						pointerEvents="none"
						style={{ fontWeight: "bold", userSelect: "none" }}
					>
						{labelText}
					</text>
				</g>,
			);
		}

		return { lineStrokes: strokes, lineLabels: labels };
	}, [
		svgLines,
		bitSize,
		hoveredStripId,
		showLineIds,
		showDimensions,
		displayUnit,
		lineLabelById,
		zoom,
		cellSize,
		onHoverLine,
	]);

	return (
		<>
			{lineStrokes}
			{lineLabels}
		</>
	);
}
