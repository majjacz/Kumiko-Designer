import { findIntersection, gcd, isPointOnLineInterior } from "./geometry";
import type { DesignStrip, Intersection, Line, Notch } from "./types";
import { newId } from "./utils";

// ============================================================================
// Constants
// ============================================================================

/** Threshold in mm for treating distances as effectively zero (floating point tolerance) */
const EDGE_EPSILON_MM = 1e-3;

/** Minimum strip length in mm to be considered valid (filters out degenerate strips) */
const MIN_STRIP_LENGTH_MM = 1;

// ============================================================================
// Types
// ============================================================================

/** Information about a butt joint at a line endpoint */
interface ButtJointInfo {
	/** Whether the line's start endpoint butts against another line's interior */
	hasStartButt: boolean;
	/** Whether the line's end endpoint butts against another line's interior */
	hasEndButt: boolean;
	/** Amount to trim from the start (mm) */
	trimStartMM: number;
	/** Amount to trim from the end (mm) */
	trimEndMM: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a point is at either endpoint of a line.
 */
function isPointAtEndpoint(px: number, py: number, line: Line): boolean {
	return (
		(px === line.x1 && py === line.y1) || (px === line.x2 && py === line.y2)
	);
}

/**
 * Calculate the distance in mm from a line's start point to a given point.
 */
function distanceFromLineStart(
	line: Line,
	px: number,
	py: number,
	cellSize: number,
): number {
	const dxMM = (px - line.x1) * cellSize;
	const dyMM = (py - line.y1) * cellSize;
	return Math.sqrt(dxMM * dxMM + dyMM * dyMM);
}

/**
 * Calculate the geometric length of a line in mm.
 */
function lineGeometricLengthMM(line: Line, cellSize: number): number {
	const dxMM = (line.x2 - line.x1) * cellSize;
	const dyMM = (line.y2 - line.y1) * cellSize;
	return Math.sqrt(dxMM * dxMM + dyMM * dyMM);
}

/**
 * Detect butt joints for a line (T-joints where this line ends at another line's interior).
 * Returns trimming information for both endpoints.
 */
function detectButtJoints(
	line: Line,
	allLines: Map<string, Line>,
	bitSize: number,
): ButtJointInfo {
	const otherLines = Array.from(allLines.values()).filter(
		(l) => l.id !== line.id,
	);

	const hasStartButt = otherLines.some((other) =>
		isPointOnLineInterior(line.x1, line.y1, other),
	);
	const hasEndButt = otherLines.some((other) =>
		isPointOnLineInterior(line.x2, line.y2, other),
	);

	return {
		hasStartButt,
		hasEndButt,
		trimStartMM: hasStartButt ? bitSize / 2 : 0,
		trimEndMM: hasEndButt ? bitSize / 2 : 0,
	};
}

/**
 * Compute notches for a line based on its intersections with other lines.
 * Handles trimming adjustments and filters out edge notches.
 */
function computeNotchesForLine(
	line: Line,
	intersections: Map<string, Intersection>,
	allLines: Map<string, Line>,
	cellSize: number,
	geometricLengthMM: number,
	trimStartMM: number,
	finalLengthMM: number,
): Notch[] {
	// Find all intersections involving this line
	const relatedIntersections = Array.from(intersections.values()).filter(
		(int) => int.line1Id === line.id || int.line2Id === line.id,
	);

	const notches: Notch[] = [];

	for (const int of relatedIntersections) {
		const isLine1 = int.line1Id === line.id;
		const otherLineId = isLine1 ? int.line2Id : int.line1Id;
		const otherLine = allLines.get(otherLineId);

		// Calculate distance from this line's start to the intersection
		const distMM = distanceFromLineStart(line, int.x, int.y, cellSize);

		// Skip if intersection is at this line's start or end
		const isAtStart = distMM <= EDGE_EPSILON_MM;
		const isAtEnd = geometricLengthMM - distMM <= EDGE_EPSILON_MM;
		if (isAtStart || isAtEnd) continue;

		// Skip if intersection is at the other line's endpoint (just touching, not crossing)
		if (otherLine && isPointAtEndpoint(int.x, int.y, otherLine)) continue;

		// Adjust distance for any trimming at the start
		const distFromStart = distMM - trimStartMM;

		// Skip if trimming would push this notch onto an endpoint
		if (
			distFromStart <= EDGE_EPSILON_MM ||
			finalLengthMM - distFromStart <= EDGE_EPSILON_MM
		) {
			continue;
		}

		// Determine notch orientation:
		// - When line1Over=true: line1 is on top, so line1 needs bottom notch, line2 needs top notch
		// - fromTop should be opposite of line1Over for line1, same for line2
		const fromTop = int.line1Over !== isLine1;

		notches.push({
			id: `${int.id}_${line.id}`,
			otherLineId,
			dist: distFromStart,
			fromTop,
		});
	}

	// Sort notches by distance from start
	return notches.sort((a, b) => a.dist - b.dist);
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Normalize notches so that strips with only bottom notches are flipped
 * to have only top notches. This allows single-pass CNC cutting.
 *
 * Physical reality: A wooden strip can always be flipped 180° so that
 * bottom notches become top notches. We apply this normalization at
 * design time so that all strips are oriented with notches preferring
 * the top side where possible.
 */
export function normalizeStripNotches(notches: Notch[]): Notch[] {
	if (notches.length === 0) return notches;

	const hasTop = notches.some((n) => n.fromTop);
	const hasBottom = notches.some((n) => !n.fromTop);

	// If we have only bottom notches, flip them all to top
	if (hasBottom && !hasTop) {
		return notches.map((n) => ({
			...n,
			fromTop: true,
		}));
	}

	return notches;
}

/**
 * Compute intersections between all pairs of lines.
 *
 * Only creates intersection records where lines actually cross through each other
 * (not at endpoints). Uses a heuristic where horizontal lines default to being
 * on top of vertical lines.
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

			// Skip if either line has this point as an endpoint (butting, not crossing)
			if (
				isPointAtEndpoint(point.x, point.y, line1) ||
				isPointAtEndpoint(point.x, point.y, line2)
			) {
				continue;
			}

			// Only create one intersection per coordinate
			const coordKey = `${point.x},${point.y}`;
			if (coordinateMap.has(coordKey)) continue;

			const id = `int_${line1.id}_${line2.id}`;

			// Determine default stacking: horizontal lines on top of vertical
			const isLine1Horizontal = line1.y1 === line1.y2;
			const isLine2Horizontal = line2.y1 === line2.y2;
			const isLine1Vertical = line1.x1 === line1.x2;
			const isLine2Vertical = line2.x1 === line2.x2;

			let line1OverDefault = true;
			if (isLine1Horizontal && isLine2Vertical) {
				line1OverDefault = true;
			} else if (isLine1Vertical && isLine2Horizontal) {
				line1OverDefault = false;
			}

			const intersection: Intersection = {
				id,
				x: point.x,
				y: point.y,
				line1Id: line1.id,
				line2Id: line2.id,
				line1Over: intersectionStates.get(id) ?? line1OverDefault,
			};

			newIntersections.set(id, intersection);
			coordinateMap.set(coordKey, intersection);
		}
	}

	return newIntersections;
}

/**
 * Compute physical design strips from grid lines and intersections.
 *
 * This function:
 * 1. Converts grid lines to physical strips with lengths in mm
 * 2. Detects butt joints (T-joints) and trims strip lengths accordingly
 * 3. Computes notch positions for each strip
 * 4. Assigns stable geometry-based IDs for strip deduplication
 */
export function computeDesignStrips(
	lines: Map<string, Line>,
	intersections: Map<string, Intersection>,
	gridCellSize: number,
	bitSize: number,
): DesignStrip[] {
	return Array.from(lines.values())
		.map((line) => {
			// Calculate geometric length
			const geometricLengthMM = lineGeometricLengthMM(line, gridCellSize);

			// Detect and apply butt joint trimming
			const buttJoints = detectButtJoints(line, lines, bitSize);
			const lengthMM = Math.max(
				0,
				geometricLengthMM - buttJoints.trimStartMM - buttJoints.trimEndMM,
			);

			// Compute notches with trimming adjustments
			const notches = computeNotchesForLine(
				line,
				intersections,
				lines,
				gridCellSize,
				geometricLengthMM,
				buttJoints.trimStartMM,
				lengthMM,
			);

			// Normalize notch orientations for single-pass CNC cutting
			const normalizedNotches = normalizeStripNotches(notches);

			// Generate stable IDs
			const stripId = computeStripGeometryId(lengthMM, normalizedNotches);
			const displayCode = computeStripDisplayCode(stripId);

			return {
				...line,
				id: stripId,
				lengthMM,
				notches: normalizedNotches,
				sourceLineId: line.id,
				displayCode,
			};
		})
		.filter((strip) => strip.lengthMM > MIN_STRIP_LENGTH_MM);
}

/**
 * Normalize a set of grid lines so that:
 * - All collinear, touching/overlapping segments on the same infinite line
 *   are merged into single continuous Line objects.
 * - The returned map contains no overlapping collinear segments.
 *
 * This enforces the invariant that continuous lines are represented as single
 * segments in state, regardless of how they were originally drawn or edited.
 */
export function normalizeLines(lines: Map<string, Line>): Map<string, Line> {
	type GroupKind = "H" | "V" | "D";
	type Axis = "x" | "y";
	type Segment1D = { tStart: number; tEnd: number };
	type Group = {
		kind: GroupKind;
		axis: Axis;
		// For horizontal/vertical groups
		y?: number;
		x?: number;
		// For diagonal groups
		dirX?: number;
		dirY?: number;
		c?: number;
		segments: Segment1D[];
	};

	const groups = new Map<string, Group>();

	for (const line of lines.values()) {
		const dx = line.x2 - line.x1;
		const dy = line.y2 - line.y1;

		// Skip degenerate segments
		if (dx === 0 && dy === 0) continue;

		if (dy === 0) {
			// Horizontal line (y constant)
			const key = `H:${line.y1}`;
			let group = groups.get(key);
			if (!group) {
				group = { kind: "H", axis: "x", y: line.y1, segments: [] };
				groups.set(key, group);
			}
			const t1 = line.x1;
			const t2 = line.x2;
			const tStart = Math.min(t1, t2);
			const tEnd = Math.max(t1, t2);
			group.segments.push({ tStart, tEnd });
		} else if (dx === 0) {
			// Vertical line (x constant)
			const key = `V:${line.x1}`;
			let group = groups.get(key);
			if (!group) {
				group = { kind: "V", axis: "y", x: line.x1, segments: [] };
				groups.set(key, group);
			}
			const t1 = line.y1;
			const t2 = line.y2;
			const tStart = Math.min(t1, t2);
			const tEnd = Math.max(t1, t2);
			group.segments.push({ tStart, tEnd });
		} else {
			// Diagonal / general case
			let dirX = dx;
			let dirY = dy;
			const g = gcd(dirX, dirY);
			dirX /= g;
			dirY /= g;

			// Canonicalise direction so collinear lines share the same (dirX,dirY)
			if (dirX < 0 || (dirX === 0 && dirY < 0)) {
				dirX = -dirX;
				dirY = -dirY;
			}

			// Line invariant: dirX * y - dirY * x = c
			const c = dirX * line.y1 - dirY * line.x1;

			const useX: Axis = Math.abs(dirX) >= Math.abs(dirY) ? "x" : "y";
			const key = `D:${dirX},${dirY}:${c}:${useX}`;
			let group = groups.get(key);
			if (!group) {
				group = {
					kind: "D",
					axis: useX,
					dirX,
					dirY,
					c,
					segments: [],
				};
				groups.set(key, group);
			}

			const t1 = useX === "x" ? line.x1 : line.y1;
			const t2 = useX === "x" ? line.x2 : line.y2;
			const tStart = Math.min(t1, t2);
			const tEnd = Math.max(t1, t2);
			group.segments.push({ tStart, tEnd });
		}
	}

	const result = new Map<string, Line>();

	for (const group of groups.values()) {
		if (group.segments.length === 0) continue;

		// Sort segments along the 1D parameter axis
		const segs = [...group.segments].sort((a, b) => a.tStart - b.tStart);

		// Merge touching/overlapping intervals into continuous ranges
		const merged: Segment1D[] = [];
		let current = { ...segs[0] };

		for (let i = 1; i < segs.length; i++) {
			const seg = segs[i];
			if (seg.tStart <= current.tEnd) {
				// Overlapping or touching – extend the current segment
				current.tEnd = Math.max(current.tEnd, seg.tEnd);
			} else {
				merged.push(current);
				current = { ...seg };
			}
		}
		merged.push(current);

		for (const seg of merged) {
			if (seg.tEnd <= seg.tStart) continue;

			let x1: number;
			let y1: number;
			let x2: number;
			let y2: number;

			if (group.kind === "H") {
				const y = group.y ?? 0;
				x1 = seg.tStart;
				y1 = y;
				x2 = seg.tEnd;
				y2 = y;
			} else if (group.kind === "V") {
				const x = group.x ?? 0;
				x1 = x;
				y1 = seg.tStart;
				x2 = x;
				y2 = seg.tEnd;
			} else {
				// Diagonal / general line
				const dirX = group.dirX ?? 0;
				const dirY = group.dirY ?? 0;
				const c = group.c ?? 0;
				if (group.axis === "x") {
					const px1 = seg.tStart;
					const px2 = seg.tEnd;
					const py1 = (c + dirY * px1) / dirX;
					const py2 = (c + dirY * px2) / dirX;
					x1 = px1;
					y1 = py1;
					x2 = px2;
					y2 = py2;
				} else {
					// axis === 'y'
					const py1 = seg.tStart;
					const py2 = seg.tEnd;
					const px1 = (dirX * py1 - c) / dirY;
					const px2 = (dirX * py2 - c) / dirY;
					x1 = px1;
					y1 = py1;
					x2 = px2;
					y2 = py2;
				}
			}

			const id = newId();
			result.set(id, {
				id,
				x1: Math.round(x1),
				y1: Math.round(y1),
				x2: Math.round(x2),
				y2: Math.round(y2),
			});
		}
	}

	return result;
}

/**
 * Compute a stable, geometry-derived identifier for a strip based on its
 * physical length and notch pattern (distances + orientation). The id is
 * chosen to be invariant to:
 * 1. Which endpoint is considered the "start" of the grid line (reversibility).
 * 2. Which face of the strip the notches are on (flippability).
 *
 * To achieve this, we consider all four transformations:
 * - Forward direction with original orientation
 * - Reverse direction with original orientation
 * - Forward direction with flipped orientation
 * - Reverse direction with flipped orientation
 *
 * We pick the lexicographically smallest representation. This ensures:
 * - Identical physical strips get the same ID regardless of how they're
 *   oriented in the grid (horizontal vs vertical, left-to-right vs right-to-left).
 * - If length or notch positions change, the id changes.
 */
function computeStripGeometryId(
	lengthMM: number,
	notches: { dist: number; fromTop: boolean }[],
): string {
	const precision = 3;
	const lengthKey = lengthMM.toFixed(precision);

	// Helper to build a notch pattern string
	const buildPattern = (
		notchList: { dist: number; fromTop: boolean }[],
		flipOrientation: boolean,
	) =>
		notchList
			.map((n) => {
				const d = n.dist.toFixed(precision);
				// XOR: if flipOrientation, invert the fromTop value
				const orient = n.fromTop !== flipOrientation ? "T" : "B";
				return `${d}:${orient}`;
			})
			.join("|");

	// Forward representation: distances from the current start point.
	const forward = buildPattern(notches, false);
	const forwardFlipped = buildPattern(notches, true);

	// Reverse representation: distances measured from the other end.
	const reversedNotches = notches.map((n) => ({
		dist: lengthMM - n.dist,
		fromTop: n.fromTop,
	}));
	// Sort by distance since reversing changes the order
	reversedNotches.sort((a, b) => a.dist - b.dist);

	const reverse = buildPattern(reversedNotches, false);
	const reverseFlipped = buildPattern(reversedNotches, true);

	// Pick the lexicographically smallest of all four variants
	const candidates = [forward, forwardFlipped, reverse, reverseFlipped].filter(
		(s) => s.length > 0,
	);

	// If no notches, all variants are empty strings
	const notchesKey =
		candidates.length > 0
			? candidates.reduce((min, cur) => (cur < min ? cur : min))
			: "";

	return `${lengthKey}|${notchesKey}`;
}

/**
 * Compute a short, user-friendly 4-character alphanumeric code (base36)
 * from the geometry-derived strip id. The mapping is deterministic:
 * - Same geometry-id => same displayCode.
 * - Different geometry-id => very likely a different code.
 */
function computeStripDisplayCode(geometryId: string): string {
	let hash = 0;
	for (let i = 0; i < geometryId.length; i++) {
		hash = (hash * 31 + geometryId.charCodeAt(i)) >>> 0;
	}

	// Limit into 4-digit base36 space: 36^4 possible codes.
	const max = 36 ** 4; // 1,679,616
	const n = hash % max;
	const code = n.toString(36).toUpperCase();

	// Pad to 4 characters (e.g., "00AF")
	return code.padStart(4, "0");
}
