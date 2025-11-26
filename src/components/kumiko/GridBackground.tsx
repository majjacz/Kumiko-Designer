import type React from "react";
import { memo, useMemo } from "react";

export interface GridBackgroundProps {
	/** Grid cell size in mm */
	cellSize: number;
	/** Total design width in mm */
	designWidth: number;
	/** Total design height in mm */
	designHeight: number;
	/** Current zoom level */
	zoom: number;
	/** Number of grid cells in each direction */
	gridExtentCells: number;
}

/**
 * GridBackground renders the background grid lines for the design canvas.
 * Shows vertical and horizontal lines at cell boundaries with adaptive stroke width.
 */
export const GridBackground = memo(function GridBackground({
	cellSize,
	designWidth,
	designHeight,
	zoom,
	gridExtentCells,
}: GridBackgroundProps) {
	const gridLines = useMemo(() => {
		const lines: React.ReactElement[] = [];
		const strokeWidth = Math.max(0.25, 0.5 / zoom);

		// Vertical lines (X axis divisions)
		for (let i = 0; i <= gridExtentCells; i++) {
			const x = i * cellSize;

			lines.push(
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

			lines.push(
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

		return lines;
	}, [cellSize, designWidth, designHeight, zoom, gridExtentCells]);

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

			{/* Grid lines */}
			{gridLines}

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
});
