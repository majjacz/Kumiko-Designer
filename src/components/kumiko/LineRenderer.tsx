import type React from "react";
import { useMemo } from "react";
import { distancePointToSegment, type Line } from "../../lib/kumiko";

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
	/** Map of line IDs to their display labels */
	lineLabelById?: Map<string, string>;
}

/**
 * LineRenderer renders user-drawn lines as SVG strokes with optional labels.
 * Labels are positioned to avoid overlapping with other lines.
 */
export function LineRenderer({
	svgLines,
	bitSize,
	zoom,
	cellSize,
	hoveredStripId,
	showLineIds,
	lineLabelById,
}: LineRendererProps) {
	const { lineStrokes, lineLabels } = useMemo(() => {
		const strokes: React.ReactElement[] = [];
		const labels: React.ReactElement[] = [];

		for (const { line, start, end } of svgLines) {
			const isHovered = line.id === hoveredStripId;

			// Direction and midpoint in SVG space
			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const length = Math.hypot(dx, dy) || 1;

			const midX = (start.x + end.x) / 2;
			const midY = (start.y + end.y) / 2;

			const rawIdSuffix = line.id.length > 4 ? line.id.slice(-4) : line.id;
			const label = lineLabelById?.get(line.id) ?? rawIdSuffix;

			strokes.push(
				<line
					key={line.id}
					x1={start.x}
					y1={start.y}
					x2={end.x}
					y2={end.y}
					stroke={isHovered ? "#FBBF24" : "#60A5FA"}
					strokeWidth={
						isHovered ? Math.max(2, bitSize / 2) : Math.max(1, bitSize / 4)
					}
					strokeLinecap="round"
				/>,
			);

			if (!showLineIds) continue;

			const baseFontPx = 80;
			const paddingXPx = 10;
			const paddingYPx = 6;

			const fontSize = baseFontPx / zoom;
			const approxCharWidthPx = baseFontPx * 0.6;

			const labelLength =
				typeof label === "string" ? label.length : String(label).length;

			const rectWidth =
				(labelLength * approxCharWidthPx + paddingXPx * 2) / zoom;
			const rectHeight = (baseFontPx + paddingYPx * 2) / zoom;

			const normalX = -dy / length;
			const normalY = dx / length;

			const isHorizontal = line.y1 === line.y2 && line.x1 !== line.x2;
			const isVertical = line.x1 === line.x2 && line.y1 !== line.y2;

			let offsetDistance: number;
			if (isHorizontal || isVertical) {
				offsetDistance = Math.max(cellSize * 0.4, rectHeight * 0.6);
			} else {
				const baseOffsetPx = 4;
				offsetDistance = Math.max(baseOffsetPx / zoom, rectHeight * 0.6);
			}

			let bestCenterX = midX + normalX * offsetDistance;
			let bestCenterY = midY + normalY * offsetDistance;
			let bestScore = -Infinity;

			for (const dir of [1, -1]) {
				const cx = midX + normalX * offsetDistance * dir;
				const cy = midY + normalY * offsetDistance * dir;

				let closest = Infinity;
				for (const { start: s, end: e } of svgLines) {
					const d = distancePointToSegment(cx, cy, s.x, s.y, e.x, e.y);
					if (d < closest) closest = d;
				}

				if (closest > bestScore) {
					bestScore = closest;
					bestCenterX = cx;
					bestCenterY = cy;
				}
			}

			const labelCenterX = bestCenterX;
			const labelCenterY = bestCenterY;
			const rectX = labelCenterX - rectWidth / 2;
			const rectY = labelCenterY - rectHeight / 2;

			labels.push(
				<g key={`${line.id}-label`}>
					<rect
						x={rectX}
						y={rectY}
						width={rectWidth}
						height={rectHeight}
						fill="rgba(0,0,0,0.8)"
						rx={2}
						pointerEvents="none"
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
						{label}
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
		lineLabelById,
		zoom,
		cellSize,
	]);

	return (
		<>
			{lineStrokes}
			{lineLabels}
		</>
	);
}
