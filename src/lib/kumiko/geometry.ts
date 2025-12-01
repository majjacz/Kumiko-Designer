import { EPSILON } from "./config";
import type { Line, Point } from "./types";

/**
 * Check if a point lies on the interior of a line segment (not at endpoints).
 * Uses grid coordinates, so epsilon comparison is not needed for exact checks.
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param line - The line segment to check
 * @returns true if the point is on the segment's interior (strictly between endpoints)
 */
export function isPointOnLineInterior(
	px: number,
	py: number,
	line: Line,
): boolean {
	const { x1, y1, x2, y2 } = line;

	// Check if point is at either endpoint (not interior)
	if ((px === x1 && py === y1) || (px === x2 && py === y2)) {
		return false;
	}

	// For the point to be on the line segment interior:
	// 1. It must be collinear with the segment
	// 2. Its projection must fall strictly between the endpoints

	const dx = x2 - x1;
	const dy = y2 - y1;

	// Degenerate segment (zero length)
	if (dx === 0 && dy === 0) {
		return false;
	}

	// Check collinearity using cross product
	const dpx = px - x1;
	const dpy = py - y1;
	const cross = dx * dpy - dy * dpx;
	if (cross !== 0) {
		return false;
	}

	// Calculate parametric position t along the segment
	let t: number;
	if (Math.abs(dx) > Math.abs(dy)) {
		t = dpx / dx;
	} else {
		t = dpy / dy;
	}

	// Point is on interior if t is strictly between 0 and 1
	return t > 0 && t < 1;
}

/**
 * Find the intersection point between two line segments.
 * Returns null if the segments don't intersect within their bounds,
 * or if they are parallel.
 */
export const findIntersection = (line1: Line, line2: Line): Point | null => {
	const { x1, y1, x2, y2 } = line1;
	const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

	const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	if (den === 0) return null;

	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
	const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
		return {
			x: Math.round(x1 + t * (x2 - x1)),
			y: Math.round(y1 + t * (y2 - y1)),
		};
	}

	return null;
};

/**
 * Compute the overlap between a line segment and a new segment defined by start and end points.
 * Returns the parametric range [tStart, tEnd] where the new segment overlaps the line,
 * or null if there's no meaningful overlap.
 *
 * Used internally by computeLineOverlaps to detect collinear overlapping segments.
 */
export function computeLineOverlapForSingleLine(
	line: Line,
	start: Point,
	end: Point,
): { line: Line; tStart: number; tEnd: number } | null {
	// Check if the new segment is collinear with this line
	const dx1 = line.x2 - line.x1;
	const dy1 = line.y2 - line.y1;
	const dx2 = end.x - start.x;
	const dy2 = end.y - start.y;

	// Degenerate base line – skip
	if (dx1 === 0 && dy1 === 0) {
		return null;
	}

	// Cross product check for parallel lines
	const cross = dx1 * dy2 - dy1 * dx2;
	if (cross !== 0) {
		return null; // Not parallel
	}

	// Check if start point is on the existing line
	const dxs = start.x - line.x1;
	const dys = start.y - line.y1;
	const crossStart = dx1 * dys - dy1 * dxs;
	if (crossStart !== 0) {
		return null; // Start not on line
	}

	// Check if end point is on the existing line
	const dxe = end.x - line.x1;
	const dye = end.y - line.y1;
	const crossEnd = dx1 * dye - dy1 * dxe;
	if (crossEnd !== 0) {
		return null; // End not on line
	}

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
		return null;
	}

	// Clamp to [0, 1] range
	tStart = Math.max(0, tStart);
	tEnd = Math.min(1, tEnd);

	// Only consider this an overlap if it's more than just touching at endpoints
	// This allows merging/extending when lines touch at a single point
	const overlapLength = tEnd - tStart;

	// Skip if the overlap is essentially just a point (touching at endpoints)
	if (overlapLength < EPSILON) {
		return null;
	}

	return { line, tStart, tEnd };
}

/**
 * Greatest common divisor helper for integer deltas.
 * Used for normalizing direction vectors in line normalization.
 */
export function gcd(a: number, b: number): number {
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const temp = y;
		y = x % y;
		x = temp;
	}
	return x || 1;
}

/**
 * Calculate the distance from a point to a line segment.
 * Returns the perpendicular distance if the projection falls within the segment,
 * otherwise returns the distance to the nearest endpoint.
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param x1 - Segment start X
 * @param y1 - Segment start Y
 * @param x2 - Segment end X
 * @param y2 - Segment end Y
 */
export function distancePointToSegment(
	px: number,
	py: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): number {
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
}

/**
 * Compute overlaps of a candidate segment [start,end] with all existing
 * collinear lines. Returns parametric ranges along each overlapped line.
 */
export function computeLineOverlaps(
	lines: Map<string, Line>,
	start: Point,
	end: Point,
): { line: Line; tStart: number; tEnd: number }[] {
	const results: { line: Line; tStart: number; tEnd: number }[] = [];
	for (const line of lines.values()) {
		const overlap = computeLineOverlapForSingleLine(line, start, end);
		if (overlap) {
			results.push(overlap);
		}
	}
	return results;
}
