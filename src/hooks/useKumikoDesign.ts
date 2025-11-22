import { useCallback, useMemo, useRef, useState } from "react";
import {
	type DesignStrip,
	type Intersection,
	type Line,
	newId,
	type Point,
} from "../lib/kumiko/kumiko-core";
import {
	computeDesignStrips,
	computeIntersections,
	computeLineOverlaps,
	normalizeLines,
} from "../lib/kumiko/kumiko-design-logic";
import type { GridViewState } from "../lib/kumiko/kumiko-storage";

export function useKumikoDesign(gridCellSize: number) {
	const [lines, setLines] = useState<Map<string, Line>>(new Map());
	const [drawingLine, setDrawingLine] = useState<Point | null>(null);
	const [isDeleting, setIsDeleting] = useState<boolean>(false);
	const [intersectionStates, setIntersectionStates] = useState<
		Map<string, boolean>
	>(new Map());
	const [gridViewState, setGridViewState] = useState<GridViewState | undefined>(
		undefined,
	);

	// Derived intersections - ensures only one notch per coordinate
	const intersections = useMemo<Map<string, Intersection>>(
		() => computeIntersections(lines, intersectionStates),
		[lines, intersectionStates],
	);

	// Keep a ref to intersections so we can use it in callbacks without breaking stability
	const intersectionsRef = useRef(intersections);
	intersectionsRef.current = intersections;

	// Derived design strips for layout
	const designStrips = useMemo<DesignStrip[]>(
		() => computeDesignStrips(lines, intersections, gridCellSize),
		[lines, intersections, gridCellSize],
	);

	/**
	 * Map from grid Line.id to a stable, user-facing strip label.
	 */
	const lineLabelById = useMemo(() => {
		const map = new Map<string, string>();
		for (const strip of designStrips) {
			map.set(strip.sourceLineId, strip.displayCode);
		}
		return map;
	}, [designStrips]);

	/**
	 * Core segment application logic used by both click-click and drag-based
	 * drawing.
	 */
	const applySegment = useCallback((start: Point, end: Point) => {
		// Ignore degenerate segments
		if (start.x === end.x && start.y === end.y) {
			setDrawingLine(null);
			setIsDeleting(false);
			return;
		}

		setLines((prev) => {
			const overlaps = computeLineOverlaps(prev, start, end);
			const next = new Map(prev);

			if (overlaps.length > 0) {
				// Deletion behaviour
				for (const { line, tStart, tEnd } of overlaps) {
					next.delete(line.id);

					// Keep segment before overlap (if exists)
					if (tStart > 0.001) {
						const id = newId();
						const before: Line = {
							id,
							x1: line.x1,
							y1: line.y1,
							x2: Math.round(line.x1 + tStart * (line.x2 - line.x1)),
							y2: Math.round(line.y1 + tStart * (line.y2 - line.y1)),
						};
						next.set(id, before);
					}

					// Keep segment after overlap (if exists)
					if (tEnd < 0.999) {
						const id = newId();
						const after: Line = {
							id,
							x1: Math.round(line.x1 + tEnd * (line.x2 - line.x1)),
							y1: Math.round(line.y1 + tEnd * (line.y2 - line.y1)),
							x2: line.x2,
							y2: line.y2,
						};
						next.set(id, after);
					}
				}
			} else {
				// Creation behaviour
				const id = newId();
				const newLine: Line = {
					id,
					x1: start.x,
					y1: start.y,
					x2: end.x,
					y2: end.y,
				};
				next.set(id, newLine);
			}

			return normalizeLines(next);
		});

		// Any structural change to lines should reset intersection orientation
		setIntersectionStates(new Map());
		setDrawingLine(null);
		setIsDeleting(false);
	}, []);

	const handleGridClick = useCallback(
		(point: Point) => {
			const gridPoint = point;

			if (!drawingLine) {
				setDrawingLine(gridPoint);
				setIsDeleting(false);
				return;
			}

			if (drawingLine.x === gridPoint.x && drawingLine.y === gridPoint.y) {
				setDrawingLine(null);
				setIsDeleting(false);
				return;
			}

			applySegment(drawingLine, gridPoint);
		},
		[drawingLine, applySegment],
	);

	const handleDragUpdate = useCallback(
		(start: Point, end: Point) => {
			const overlaps = computeLineOverlaps(lines, start, end);
			setIsDeleting(overlaps.length > 0);
		},
		[lines],
	);

	const handleCreateLine = useCallback(
		(start: Point, end: Point) => {
			applySegment(start, end);
		},
		[applySegment],
	);

	const toggleIntersection = useCallback((id: string) => {
		const int = intersectionsRef.current.get(id);
		if (!int) return;
		setIntersectionStates((prev) => {
			const next = new Map(prev);
			next.set(id, !int.line1Over);
			return next;
		});
	}, []);

	const clearDesignState = useCallback(() => {
		setLines(new Map());
		setDrawingLine(null);
		setIntersectionStates(new Map());
		setGridViewState(undefined);
	}, []);

	const state = useMemo(
		() => ({
			lines,
			drawingLine,
			isDeleting,
			intersectionStates,
			gridViewState,
			intersections,
			designStrips,
			lineLabelById,
		}),
		[
			lines,
			drawingLine,
			isDeleting,
			intersectionStates,
			gridViewState,
			intersections,
			designStrips,
			lineLabelById,
		],
	);

	const actions = useMemo(
		() => ({
			setLines,
			setIntersectionStates,
			setGridViewState,
			handleGridClick,
			handleDragUpdate,
			handleCreateLine,
			toggleIntersection,
			clearDesignState,
		}),
		[
			handleGridClick,
			handleDragUpdate,
			handleCreateLine,
			toggleIntersection,
			clearDesignState,
		],
	);

	return useMemo(
		() => ({
			state,
			actions,
		}),
		[state, actions],
	);
}
