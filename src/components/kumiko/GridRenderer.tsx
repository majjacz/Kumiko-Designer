import type React from "react";
import { useCallback, useMemo } from "react";
import type { Intersection, Line, Point } from "../../lib/kumiko/kumiko-core";

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
	designWidth: number;
	designHeight: number;
	gridExtentCells: number;
	showNotchPositions: boolean;
	showLineIds: boolean;
	hoveredStripId?: string | null;
	lineLabelById?: Map<string, string>;
	onToggleIntersection: (id: string) => void;
	setIsHoveringNotch: (isHovering: boolean) => void;
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
	designWidth,
	designHeight,
	gridExtentCells,
	showNotchPositions,
	showLineIds,
	hoveredStripId,
	lineLabelById,
	onToggleIntersection,
	setIsHoveringNotch,
	gridToSvg,
}: GridRendererProps) {
	// Render grid lines
	const gridLines = useMemo(() => {
		const linesEls: React.ReactElement[] = [];
		const strokeWidth = Math.max(0.25, 0.5 / zoom);

		// Vertical lines (X axis divisions)
		for (let i = 0; i <= gridExtentCells; i++) {
			const x = i * cellSize;

			linesEls.push(
				<line
					key={`v${i}`}
					x1={x}
					y1={0}
					x2={x}
					y2={designHeight}
					stroke="#374151"
					strokeWidth={strokeWidth}
				/>,
			);
		}

		// Horizontal lines (Y axis divisions)
		for (let j = 0; j <= gridExtentCells; j++) {
			const y = j * cellSize;

			linesEls.push(
				<line
					key={`h${j}`}
					x1={0}
					y1={y}
					x2={designWidth}
					y2={y}
					stroke="#374151"
					strokeWidth={strokeWidth}
				/>,
			);
		}

		return linesEls;
	}, [cellSize, designWidth, designHeight, zoom, gridExtentCells]);

	// Precompute SVG-space coordinates for all user lines
	const svgLines = useMemo(
		() =>
			Array.from(lines.values()).map((line) => ({
				line,
				start: gridToSvg({ x: line.x1, y: line.y1 }),
				end: gridToSvg({ x: line.x2, y: line.y2 }),
			})),
		[lines, gridToSvg],
	);

	// Helper: distance from a point to a line segment in SVG space.
	const distancePointToSegment = useCallback(
		(
			px: number,
			py: number,
			x1: number,
			y1: number,
			x2: number,
			y2: number,
		) => {
			const vx = x2 - x1;
			const vy = y2 - y1;
			const wx = px - x1;
			const wy = py - y1;

			const c1 = vx * wx + vy * wy;
			if (c1 <= 0) {
				return Math.hypot(px - x1, py - y1);
			}

			const c2 = vx * vx + vy * vy;
			if (c2 <= c1) {
				return Math.hypot(px - x2, py - y2);
			}

			const t = c1 / c2;
			const projX = x1 + t * vx;
			const projY = y1 + t * vy;
			return Math.hypot(px - projX, py - projY);
		},
		[],
	);

	// Render user-drawn lines: strokes and labels
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
		distancePointToSegment,
		zoom,
		cellSize,
	]);

	// Render intersections as notch symbols
	const intersectionElements = useMemo(
		() =>
			Array.from(intersections.values()).map((intersection) => {
				const pos = gridToSvg({ x: intersection.x, y: intersection.y });

				const line1 = lines.get(intersection.line1Id);
				const line2 = lines.get(intersection.line2Id);

				const isLine1Horizontal =
					!!line1 && line1.y1 === line1.y2 && line1.x1 !== line1.x2;
				const isLine2Horizontal =
					!!line2 && line2.y1 === line2.y2 && line2.x1 !== line2.x2;

				const hasHorizontal = isLine1Horizontal || isLine2Horizontal;

				if (!hasHorizontal) {
					return (
						<g key={intersection.id}>
							<circle
								cx={pos.x}
								cy={pos.y}
								r={Math.max(1.5, bitSize / 5)}
								fill="#9CA3AF"
								opacity={0.5}
								pointerEvents="none"
							/>
						</g>
					);
				}

				const horizontalOnTop = (() => {
					if (isLine1Horizontal && !isLine2Horizontal) {
						return intersection.line1Over;
					}
					if (isLine2Horizontal && !isLine1Horizontal) {
						return !intersection.line1Over;
					}
					return intersection.line1Over;
				})();

				const activeFill = horizontalOnTop ? "#10B981" : "#3B82F6";
				const labelDescription = horizontalOnTop
					? "Cut from bottom"
					: "Cut from top";

				const baseBadgeWidthPx = 72;
				const baseBadgeHeightPx = 32;
				const baseClickPaddingPx = 16;
				const baseNotchWidthPx = 40;
				const baseNotchHeightPx = 24;

				const badgeWidth = baseBadgeWidthPx / zoom;
				const badgeHeight = baseBadgeHeightPx / zoom;
				const clickPadding = baseClickPaddingPx / zoom;
				const notchWidth = baseNotchWidthPx / zoom;
				const notchHeight = baseNotchHeightPx / zoom;

				const centerX = pos.x;
				const centerY = pos.y;
				const badgeX = centerX - badgeWidth / 2;
				const badgeY = centerY - badgeHeight / 2;

				const notchDirection = horizontalOnTop ? 1 : -1;
				const boardY = centerY;
				const boardX1 = centerX - notchWidth / 2;
				const boardX2 = centerX + notchWidth / 2;
				const notchBaseY = boardY;
				const notchApexY = notchBaseY + notchHeight * notchDirection;
				const notchLeftX = centerX - notchWidth * 0.35;
				const notchRightX = centerX + notchWidth * 0.35;
				const notchPoints = `${notchLeftX},${notchBaseY} ${notchRightX},${notchBaseY} ${centerX},${notchApexY}`;

				return (
					// biome-ignore lint: SVG group is used as an interactive hit target inside the grid canvas
					<g
						key={intersection.id}
						data-testid="intersection-toggle"
						role="button"
						aria-label={`Toggle notch at ${intersection.x},${intersection.y}`}
						className="cursor-pointer"
						tabIndex={0}
						onMouseDown={(e) => {
							e.stopPropagation();
						}}
						onClick={(e) => {
							e.stopPropagation();
							onToggleIntersection(intersection.id);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onToggleIntersection(intersection.id);
							}
						}}
						onMouseEnter={() => setIsHoveringNotch(true)}
						onMouseLeave={() => setIsHoveringNotch(false)}
					>
						<rect
							x={badgeX - clickPadding}
							y={badgeY - clickPadding}
							width={badgeWidth + clickPadding * 2}
							height={badgeHeight + clickPadding * 2}
							fill="transparent"
						/>

						<rect
							x={badgeX}
							y={badgeY}
							width={badgeWidth}
							height={badgeHeight}
							rx={badgeHeight / 2}
							fill="#111827"
							stroke={activeFill}
							strokeWidth={Math.max(0.75, 1 / zoom)}
							pointerEvents="none"
						/>

						<line
							x1={boardX1}
							y1={boardY}
							x2={boardX2}
							y2={boardY}
							stroke="#E5E7EB"
							strokeWidth={Math.max(1, 2 / zoom)}
							strokeLinecap="round"
							pointerEvents="none"
						/>
						<polygon
							points={notchPoints}
							fill={activeFill}
							stroke="#F9FAFB"
							strokeWidth={Math.max(0.75, 1 / zoom)}
							pointerEvents="none"
						/>

						<title>
							{labelDescription} (horizontal strip). Click to flip notch
							direction.
						</title>
					</g>
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

	// Render drawing line
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

	// Render drag preview line
	const dragPreviewElement = useMemo(() => {
		if (!dragState) return null;

		const start = gridToSvg(dragState.startPoint);
		const end = gridToSvg(dragState.currentPoint);

		if (
			dragState.startPoint.x === dragState.currentPoint.x &&
			dragState.startPoint.y === dragState.currentPoint.y
		) {
			return null;
		}

		const strokeColor = isDeleting ? "#EF4444" : "#34D399";
		const startFillColor = isDeleting ? "#EF4444" : "#34D399";
		const endFillColor = isDeleting ? "#DC2626" : "#10B981";

		return (
			<>
				<line
					x1={start.x}
					y1={start.y}
					x2={end.x}
					y2={end.y}
					stroke={strokeColor}
					strokeWidth={Math.max(1, bitSize / 4)}
					strokeLinecap="round"
					strokeDasharray="4,4"
					opacity={0.7}
				/>
				<circle
					cx={start.x}
					cy={start.y}
					r={Math.max(2, bitSize / 3)}
					fill={startFillColor}
				/>
				<circle
					cx={end.x}
					cy={end.y}
					r={Math.max(2, bitSize / 3)}
					fill={endFillColor}
				/>
			</>
		);
	}, [dragState, gridToSvg, bitSize, isDeleting]);

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
			{/* Background */}
			<rect
				x={0}
				y={0}
				width={designWidth}
				height={designHeight}
				fill="#1F2937"
			/>

			{/* Grid */}
			{gridLines}

			{/* User content */}
			{drawingElement}
			{dragPreviewElement}
			{hoverElement}
			{lineStrokes}
			{lineLabels}
			{showNotchPositions && intersectionElements}

			{/* Border */}
			<rect
				x={0}
				y={0}
				width={designWidth}
				height={designHeight}
				fill="none"
				stroke="#6B7280"
				strokeWidth={Math.max(0.5, 1 / zoom)}
			/>
		</>
	);
}
