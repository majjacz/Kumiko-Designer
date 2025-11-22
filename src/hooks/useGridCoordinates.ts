import { useCallback } from "react";
import type { Point } from "../lib/kumiko/kumiko-core";

interface UseGridCoordinatesProps {
	svgRef: React.RefObject<SVGSVGElement | null>;
	contentGroupRef: React.RefObject<SVGGElement | null>;
	cellSize: number;
	gridExtentCells: number;
}

export function useGridCoordinates({
	svgRef,
	contentGroupRef,
	cellSize,
	gridExtentCells,
}: UseGridCoordinatesProps) {
	/**
	 * Convert screen coordinates to grid coordinates using proper SVG transformation
	 * This uses SVG's built-in getScreenCTM() for accurate coordinate mapping
	 */
	const screenToGrid = useCallback(
		(clientX: number, clientY: number): Point | null => {
			const svg = svgRef.current;
			if (!svg) return null;

			try {
				// Create SVG point for proper transformation
				const pt = svg.createSVGPoint();
				pt.x = clientX;
				pt.y = clientY;

				// Use the content group transform if available (managed by d3-zoom),
				// otherwise fall back to the root SVG transform.
				const group = contentGroupRef.current;
				const matrix = (group ?? svg).getScreenCTM();
				if (!matrix) return null;

				// Transform screen coordinates to SVG coordinates
				const svgPt = pt.matrixTransform(matrix.inverse());

				// Convert SVG coordinates to grid coordinates using uniform cell size
				const gridX = svgPt.x / cellSize;
				const gridY = svgPt.y / cellSize;

				// Clamp to grid bounds (treat grid as a large fixed extent)
				if (
					gridX < 0 ||
					gridX > gridExtentCells ||
					gridY < 0 ||
					gridY > gridExtentCells
				) {
					return null;
				}

				// Snap to nearest grid point
				return {
					x: Math.round(gridX),
					y: Math.round(gridY),
				};
			} catch (error) {
				console.error("Error converting coordinates:", error);
				return null;
			}
		},
		[cellSize, gridExtentCells, svgRef, contentGroupRef],
	);

	/**
	 * Convert grid coordinates to SVG viewBox coordinates
	 */
	const gridToSvg = useCallback(
		(point: Point): { x: number; y: number } => ({
			x: point.x * cellSize,
			y: point.y * cellSize,
		}),
		[cellSize],
	);

	return { screenToGrid, gridToSvg };
}
