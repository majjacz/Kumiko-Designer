import {
	DesignStrip,
	findIntersection,
	type Intersection,
	type Line,
	type Point,
} from "./kumiko-core";

/**
 * Compute intersections between all pairs of lines, ensuring only one notch per coordinate.
 * Mirrors the logic previously in the `intersections` useMemo in index.tsx.
 */
export function computeIntersections(
	lines: Map<string, Line>,
	intersectionStates: Map<string, boolean>,
): Map<string, Intersection> {
	const newIntersections = new Map<string, Intersection>();
	const coordinateMap = new Map<string, Intersection>();
	const lineArray = Array.from(lines.values());

	for (let i = 0; i < lineArray.length; i++) {
		for (let j = i + 1; j < lineArray.length; j++) {
			const line1 = lineArray[i];
			const line2 = lineArray[j];
			const point = findIntersection(line1, line2);

			if (!point) continue;

			// Create a coordinate key to detect duplicate intersection points
			const coordKey = `${point.x},${point.y}`;

			// Only create one intersection per coordinate
			if (coordinateMap.has(coordKey)) continue;

			const id = `int_${line1.id}_${line2.id}`;

			// Default to true, but apply heuristic for horizontal/vertical intersections
			let line1OverDefault = true;
			const isLine1Horizontal = line1.y1 === line1.y2;
			const isLine1Vertical = line1.x1 === line1.x2;
			const isLine2Horizontal = line2.y1 === line2.y2;
			const isLine2Vertical = line2.x1 === line2.x2;

			if (isLine1Horizontal && isLine2Vertical) {
				// Horizontal line is on top
				line1OverDefault = true;
			} else if (isLine1Vertical && isLine2Horizontal) {
				// Vertical line is on bottom (so line2 is on top)
				line1OverDefault = false;
			}

			// Use stored state if it exists, otherwise default to the heuristic
			const line1Over = intersectionStates.get(id) ?? line1OverDefault;
			const intersection: Intersection = {
				id,
				x: point.x,
				y: point.y,
				line1Id: line1.id,
				line2Id: line2.id,
				line1Over,
			};
			newIntersections.set(id, intersection);
			coordinateMap.set(coordKey, intersection);
		}
	}

	return newIntersections;
}

/**
 * Compute physical design strips from grid lines & intersections.
 * Mirrors the `designStrips` useMemo in index.tsx.
 */
export function computeDesignStrips(
	lines: Map<string, Line>,
	intersections: Map<string, Intersection>,
	gridCellSize: number,
): DesignStrip[] {
	// Physical size of one grid cell in each axis (square cells)
	const cellWidth = gridCellSize;
	const cellHeight = gridCellSize;

	return Array.from(lines.values())
		.map((line: Line) => {
			const { x1, y1, x2, y2 } = line;

			// Convert grid-space delta into mm for accurate physical length
			const dxMM = (x2 - x1) * cellWidth;
			const dyMM = (y2 - y1) * cellHeight;
			const lengthMM = Math.sqrt(dxMM * dxMM + dyMM * dyMM);

			const related = Array.from(intersections.values()).filter(
				(int) => int.line1Id === line.id || int.line2Id === line.id,
			);

			const notches = related
				.map((int) => {
					const isLine1 = int.line1Id === line.id;
					const otherLineId = isLine1 ? int.line2Id : int.line1Id;

					// Distance from line start to intersection, in mm
					const dxIntMM = (int.x - x1) * cellWidth;
					const dyIntMM = (int.y - y1) * cellHeight;
					const distMM = Math.sqrt(dxIntMM * dxIntMM + dyIntMM * dyIntMM);

					// When line1Over=true: line1 is on top, needs notch on bottom to receive line2
					// When line1Over=true: line2 is on bottom, needs notch on top to fit into line1
					// So fromTop should be opposite of line1Over for line1, same for line2
					const fromTop = int.line1Over !== isLine1;

					return {
						id: `${int.id}_${line.id}`,
						otherLineId,
						dist: distMM,
						fromTop,
					};
				})
				.sort((a, b) => a.dist - b.dist);

			return {
				...line,
				lengthMM,
				notches,
			};
		})
		// Filter out strips shorter than 1mm (effectively zero-length or degenerate)
		.filter((strip) => strip.lengthMM > 1);
}

/**
 * Find a line that ends at the given point.
 * Mirrors `findLineEndingAt` in index.tsx.
 */
export function findLineEndingAt(
	lines: Map<string, Line>,
	point: Point,
): Line | null {
	for (const line of lines.values()) {
		if (line.x2 === point.x && line.y2 === point.y) {
			return line;
		}
	}
	return null;
}

/**
 * Check if a candidate segment [start,end] is collinear and overlapping with any existing line.
 * Excludes cases where lines only touch at endpoints (to allow merging/extending).
 * Mirrors `checkLineOverlap` in index.tsx.
 */
export function checkLineOverlap(
	lines: Map<string, Line>,
	start: Point,
	end: Point,
): { line: Line; tStart: number; tEnd: number } | null {
	for (const line of lines.values()) {
		// Check if the new segment is collinear with this line
		const dx1 = line.x2 - line.x1;
		const dy1 = line.y2 - line.y1;
		const dx2 = end.x - start.x;
		const dy2 = end.y - start.y;

		// Cross product check for parallel lines
		const cross = dx1 * dy2 - dy1 * dx2;
		if (cross !== 0) continue; // Not parallel

		// Check if start point is on the existing line
		const dxs = start.x - line.x1;
		const dys = start.y - line.y1;
		const crossStart = dx1 * dys - dy1 * dxs;
		if (crossStart !== 0) continue; // Start not on line

		// Check if end point is on the existing line
		const dxe = end.x - line.x1;
		const dye = end.y - line.y1;
		const crossEnd = dx1 * dye - dy1 * dxe;
		if (crossEnd !== 0) continue; // End not on line

		// Both points are collinear with the line
		// Calculate parametric positions along the line
		let tStart: number;
		let tEnd: number;
		if (Math.abs(dx1) > Math.abs(dy1)) {
			tStart = dxs / dx1;
			tEnd = dxe / dx1;
		} else {
			tStart = dys / dy1;
			tEnd = dye / dy1;
		}

		// Ensure tStart < tEnd for the overlap segment
		if (tStart > tEnd) {
			[tStart, tEnd] = [tEnd, tStart];
		}

		// Check if there's actual overlap with the segment [0, 1]
		if (tEnd < 0 || tStart > 1) {
			continue;
		}

		// Clamp to [0, 1] range
		tStart = Math.max(0, tStart);
		tEnd = Math.min(1, tEnd);

		// Only consider this an overlap if it's more than just touching at endpoints
		// This allows merging/extending when lines touch at a single point
		const EPSILON = 0.01; // Small threshold for endpoint detection
		const overlapLength = tEnd - tStart;

		// Skip if the overlap is essentially just a point (touching at endpoints)
		if (overlapLength < EPSILON) {
			continue;
		}

		return { line, tStart, tEnd };
	}
	return null;
}