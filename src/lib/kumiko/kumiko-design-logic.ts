import { findIntersection, gcd } from "./geometry";
import type { DesignStrip, Intersection, Line } from "./types";
import { newId } from "./utils";

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
	bitSize: number,
): DesignStrip[] {
	// Physical size of one grid cell in each axis (square cells)
	const cellWidth = gridCellSize;
	const cellHeight = gridCellSize;

	// Threshold in mm for treating an intersection as lying exactly on an endpoint.
	const EDGE_NOTCH_EPS = 1e-3;

	return (
		Array.from(lines.values())
			.map((line: Line) => {
				const { x1, y1, x2, y2 } = line;

				// Convert grid-space delta into mm for accurate physical length
				const dxMM = (x2 - x1) * cellWidth;
				const dyMM = (y2 - y1) * cellHeight;
				const geometricLengthMM = Math.sqrt(dxMM * dxMM + dyMM * dyMM);

				const related = Array.from(intersections.values()).filter(
					(int) => int.line1Id === line.id || int.line2Id === line.id,
				);

				type IntersectionInfo = {
					int: Intersection;
					isLine1: boolean;
					otherLineId: string;
					distMM: number;
					isAtStart: boolean;
					isAtEnd: boolean;
					isAtEndpointOther: boolean;
				};

				const intersectionInfos: IntersectionInfo[] = related.map((int) => {
					const isLine1 = int.line1Id === line.id;
					const otherLineId = isLine1 ? int.line2Id : int.line1Id;

					// Distance from line start to intersection, in mm
					const dxIntMM = (int.x - x1) * cellWidth;
					const dyIntMM = (int.y - y1) * cellHeight;
					const distMM = Math.sqrt(dxIntMM * dxIntMM + dyIntMM * dyIntMM);

					const isAtStart = distMM <= EDGE_NOTCH_EPS;
					const isAtEnd = geometricLengthMM - distMM <= EDGE_NOTCH_EPS;

					// Determine if the intersection lies on an endpoint of the *other* line.
					let isAtEndpointOther = false;
					const otherLine = lines.get(otherLineId);
					if (otherLine) {
						const onFirstEndpoint =
							int.x === otherLine.x1 && int.y === otherLine.y1;
						const onSecondEndpoint =
							int.x === otherLine.x2 && int.y === otherLine.y2;
						isAtEndpointOther = onFirstEndpoint || onSecondEndpoint;
					}

					return {
						int,
						isLine1,
						otherLineId,
						distMM,
						isAtStart,
						isAtEnd,
						isAtEndpointOther,
					};
				});

				// Butt joints: this line ends at another line's interior (T-joint).
				// We shorten the physical strip at that end by bitSize/2 so it butts
				// cleanly without a notch.
				const hasStartButt = intersectionInfos.some(
					(info) => info.isAtStart && !info.isAtEndpointOther,
				);
				const hasEndButt = intersectionInfos.some(
					(info) => info.isAtEnd && !info.isAtEndpointOther,
				);

				const trimStartMM = hasStartButt ? bitSize / 2 : 0;
				const trimEndMM = hasEndButt ? bitSize / 2 : 0;

				const lengthMM = Math.max(
					0,
					geometricLengthMM - trimStartMM - trimEndMM,
				);

				const notches = intersectionInfos
					// Skip any intersection that should behave like an edge joint for
					// *this* strip: either it is at one of this strip's endpoints, or
					// it is at the endpoint of the other strip (so they merely touch).
					.filter(
						(info) =>
							!info.isAtStart && !info.isAtEnd && !info.isAtEndpointOther,
					)
					.map((info) => {
						const { int, isLine1, otherLineId } = info;

						// Rebase the notch distance after trimming from the start.
						const distFromStart = info.distMM - trimStartMM;

						// If trimming would push this notch effectively onto an endpoint,
						// treat it as an edge and drop it.
						if (
							distFromStart <= EDGE_NOTCH_EPS ||
							lengthMM - distFromStart <= EDGE_NOTCH_EPS
						) {
							return null;
						}

						// When line1Over=true: line1 is on top, needs notch on bottom to receive line2
						// When line1Over=true: line2 is on bottom, needs notch on top to fit into line1
						// So fromTop should be opposite of line1Over for line1, same for line2
						const fromTop = int.line1Over !== isLine1;

						return {
							id: `${int.id}_${line.id}`,
							otherLineId,
							dist: distFromStart,
							fromTop,
						};
					})
					.filter(
						(
							n,
						): n is {
							id: string;
							otherLineId: string;
							dist: number;
							fromTop: boolean;
						} => n !== null,
					)
					.sort((a, b) => a.dist - b.dist);

				// Compute a stable, geometry-derived strip id from length and notch pattern.
				const stripId = computeStripGeometryId(lengthMM, notches);
				// Compute a short, user-friendly display code derived from the geometry id.
				const displayCode = computeStripDisplayCode(stripId);

				return {
					...line,
					id: stripId,
					lengthMM,
					notches,
					// Preserve the originating grid line id separately so the UI
					// can still correlate strips back to specific lines.
					sourceLineId: line.id,
					displayCode,
				};
			})
			// Filter out strips shorter than 1mm (effectively zero-length or degenerate)
			.filter((strip) => strip.lengthMM > 1)
	);
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
 * chosen to be invariant to which endpoint is considered the "start" of
 * the grid line: we consider both the forward distances and distances
 * measured from the other end, and pick the lexicographically smaller
 * representation.
 *
 * This ensures:
 * - If the underlying line is recreated with the same geometry (possibly
 *   reversed), the computed strip id stays the same.
 * - If length or notch positions/orientations change, the id changes.
 */
function computeStripGeometryId(
	lengthMM: number,
	notches: { dist: number; fromTop: boolean }[],
): string {
	const precision = 3;
	const lengthKey = lengthMM.toFixed(precision);

	// Forward representation: distances from the current start point.
	const forward = notches.map((n) => {
		const d = n.dist.toFixed(precision);
		const orient = n.fromTop ? "T" : "B";
		return `${d}:${orient}`;
	});

	// Reverse representation: distances measured from the other end.
	const reverse = notches.map((n) => {
		const d = (lengthMM - n.dist).toFixed(precision);
		const orient = n.fromTop ? "T" : "B";
		return `${d}:${orient}`;
	});

	const forwardKey = forward.join("|");
	const reverseKey = reverse.join("|");

	const notchesKey =
		reverseKey.length > 0 && reverseKey < forwardKey ? reverseKey : forwardKey;

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
