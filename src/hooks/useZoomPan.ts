import { select } from "d3-selection";
import {
	type D3ZoomEvent,
	zoom as d3Zoom,
	type ZoomBehavior,
	zoomIdentity,
	zoomTransform,
} from "d3-zoom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	applyZoomBehavior,
	applyZoomScaleBy,
	applyZoomTransform,
	applyZoomTranslateBy,
	type GestureEvent,
	type SVGSelection,
} from "../lib/d3-types";
import {
	DEFAULT_ZOOM,
	type Line,
	MAX_ZOOM,
	MIN_ZOOM,
	type ZoomPanState,
} from "../lib/kumiko";

interface UseZoomPanProps {
	svgRef: React.RefObject<SVGSVGElement | null>;
	contentGroupRef: React.RefObject<SVGGElement | null>;
	lines: Map<string, Line>;
	cellSize: number;
	designWidth: number;
	designHeight: number;
	/** Optional externally-controlled zoom/pan state (for persistence). */
	zoomPanState?: ZoomPanState;
	/** Notify parent when zoom/pan state changes so it can be persisted. */
	onZoomPanChange?: (state: ZoomPanState) => void;
}

export function useZoomPan({
	svgRef,
	contentGroupRef,
	lines,
	cellSize,
	designWidth,
	designHeight,
	zoomPanState,
	onZoomPanChange,
}: UseZoomPanProps) {
	const [zoom, setZoom] = useState(zoomPanState?.zoom ?? DEFAULT_ZOOM);
	const [panX, setPanX] = useState(zoomPanState?.panX ?? 0);
	const [panY, setPanY] = useState(zoomPanState?.panY ?? 0);

	const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
		null,
	);
	const onZoomPanChangeRef = useRef(onZoomPanChange);
	// Track previous cellSize to detect changes
	const prevCellSizeRef = useRef(cellSize);
	// Track if initial fit-to-view has been done (to avoid race with persisted state)
	const initialFitDoneRef = useRef(false);
	// Track the lines count when the hook first mounted (to detect loaded designs)
	const initialLineCountRef = useRef<number | null>(null);

	useEffect(() => {
		onZoomPanChangeRef.current = onZoomPanChange;
	}, [onZoomPanChange]);

	/**
	 * Reset view (Fit)
	 */
	const resetView = useCallback(() => {
		const svg = svgRef.current;
		const behavior = zoomBehaviorRef.current;

		if (!svg || !behavior) {
			return;
		}

		const selection = select(svg) as SVGSelection;
		const lineArray = Array.from(lines.values());

		const applyDefaultView = () => {
			const k = DEFAULT_ZOOM;
			const centerX = designWidth / 2;
			const centerY = designHeight / 2;

			const t = zoomIdentity
				.translate(designWidth / 2, designHeight / 2)
				.scale(k)
				.translate(-centerX, -centerY);

			applyZoomTransform(selection, behavior, t);
		};

		if (lineArray.length === 0) {
			applyDefaultView();
			return;
		}

		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;

		for (const line of lineArray) {
			minX = Math.min(minX, line.x1, line.x2);
			maxX = Math.max(maxX, line.x1, line.x2);
			minY = Math.min(minY, line.y1, line.y2);
			maxY = Math.max(maxY, line.y1, line.y2);
		}

		if (
			!Number.isFinite(minX) ||
			!Number.isFinite(maxX) ||
			!Number.isFinite(minY) ||
			!Number.isFinite(maxY)
		) {
			applyDefaultView();
			return;
		}

		const paddingCells = 1;
		const widthCells = Math.max(maxX - minX, 1) + paddingCells * 2;
		const heightCells = Math.max(maxY - minY, 1) + paddingCells * 2;

		const worldWidth = widthCells * cellSize;
		const worldHeight = heightCells * cellSize;

		if (worldWidth <= 0 || worldHeight <= 0) {
			applyDefaultView();
			return;
		}

		const paddingFactor = 1.1;
		let k = Math.min(designWidth / worldWidth, designHeight / worldHeight);
		k /= paddingFactor;
		k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));

		const centerXCells = (minX + maxX) / 2;
		const centerYCells = (minY + maxY) / 2;
		const centerX = centerXCells * cellSize;
		const centerY = centerYCells * cellSize;

		const t = zoomIdentity
			.translate(designWidth / 2, designHeight / 2)
			.scale(k)
			.translate(-centerX, -centerY);

		applyZoomTransform(selection, behavior, t);
	}, [lines, cellSize, designWidth, designHeight, svgRef]);

	const zoomBy = useCallback(
		(factor: number) => {
			const svg = svgRef.current;
			const behavior = zoomBehaviorRef.current;
			if (!svg || !behavior) return;

			const selection = select(svg) as SVGSelection;
			applyZoomScaleBy(selection, behavior, factor);
		},
		[svgRef],
	);

	// Set up d3-zoom behavior (only once)
	useEffect(() => {
		const svgEl = svgRef.current;
		const groupEl = contentGroupRef.current;
		if (!svgEl || !groupEl) return;

		const behavior: ZoomBehavior<SVGSVGElement, unknown> = d3Zoom<
			SVGSVGElement,
			unknown
		>()
			.scaleExtent([MIN_ZOOM, MAX_ZOOM])
			.filter((event: unknown) => {
				const e = event as Event;
				if (e.type === "wheel") return false;
				if (
					(e.type === "mousedown" || e.type === "pointerdown") &&
					(e as MouseEvent).button === 1
				) {
					return true;
				}
				return false;
			})
			.on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
				const t = event.transform;
				groupEl.setAttribute("transform", t.toString());
				setZoom(t.k);
				setPanX(t.x);
				setPanY(t.y);

				if (onZoomPanChangeRef.current) {
					onZoomPanChangeRef.current({
						zoom: t.k,
						panX: t.x,
						panY: t.y,
					});
				}
			});

		zoomBehaviorRef.current = behavior;

		const selection = select(svgEl) as SVGSelection;
		applyZoomBehavior(selection, behavior);

		return () => {
			selection.on(".zoom", null);
			zoomBehaviorRef.current = null;
		};
	}, [svgRef, contentGroupRef]);

	// Sync zoomPanState prop to d3 transform
	useEffect(() => {
		const svgEl = svgRef.current;
		const behavior = zoomBehaviorRef.current;
		if (!svgEl || !behavior || !zoomPanState?.zoom) return;

		const selection = select(svgEl) as SVGSelection;

		const initialZoom = Number.isFinite(zoomPanState.zoom)
			? zoomPanState.zoom
			: DEFAULT_ZOOM;
		const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom));
		const targetTransform = zoomIdentity
			.translate(zoomPanState.panX ?? 0, zoomPanState.panY ?? 0)
			.scale(clampedZoom);

		const currentTransform = zoomTransform(svgEl);
		const kDiff = Math.abs(currentTransform.k - targetTransform.k);
		const xDiff = Math.abs(currentTransform.x - targetTransform.x);
		const yDiff = Math.abs(currentTransform.y - targetTransform.y);

		if (kDiff > 0.001 || xDiff > 0.1 || yDiff > 0.1) {
			applyZoomTransform(selection, behavior, targetTransform);
		}
	}, [zoomPanState, svgRef]);

	// Trackpad pan/zoom
	useEffect(() => {
		const svgEl = svgRef.current;
		if (!svgEl) return;

		const handleWheelPanZoom = (event: WheelEvent) => {
			const currentSvg = svgRef.current;
			const currentBehavior = zoomBehaviorRef.current;
			if (!currentSvg || !currentBehavior) return;

			const selection = select(currentSvg) as SVGSelection;

			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				const factor = Math.exp(-event.deltaY * 0.001);
				applyZoomScaleBy(selection, currentBehavior, factor);
				return;
			}

			event.preventDefault();
			applyZoomTranslateBy(
				selection,
				currentBehavior,
				-event.deltaX,
				-event.deltaY,
			);
		};

		const handleGestureStart = (event: Event) => {
			const gesture = event as GestureEvent;
			gesture.preventDefault();
		};

		let lastScale = 1;
		const handleGestureChange = (event: Event) => {
			const currentSvg = svgRef.current;
			const currentBehavior = zoomBehaviorRef.current;
			if (!currentSvg || !currentBehavior) return;

			const gesture = event as GestureEvent;

			const scale = gesture.scale ?? 1;
			const factor = scale / (lastScale || 1);
			lastScale = scale;

			const selection = select(currentSvg) as SVGSelection;
			gesture.preventDefault();
			applyZoomScaleBy(selection, currentBehavior, factor);
		};

		const handleGestureEnd = (event: Event) => {
			const gesture = event as GestureEvent;
			lastScale = 1;
			gesture.preventDefault();
		};

		svgEl.addEventListener("wheel", handleWheelPanZoom, { passive: false });
		svgEl.addEventListener(
			"gesturestart" as unknown as keyof SVGElementEventMap,
			handleGestureStart as EventListener,
			{ passive: false },
		);
		svgEl.addEventListener(
			"gesturechange" as unknown as keyof SVGElementEventMap,
			handleGestureChange as EventListener,
			{ passive: false },
		);
		svgEl.addEventListener(
			"gestureend" as unknown as keyof SVGElementEventMap,
			handleGestureEnd as EventListener,
			{ passive: false },
		);

		return () => {
			svgEl.removeEventListener("wheel", handleWheelPanZoom);
			svgEl.removeEventListener(
				"gesturestart" as unknown as keyof SVGElementEventMap,
				handleGestureStart as EventListener,
			);
			svgEl.removeEventListener(
				"gesturechange" as unknown as keyof SVGElementEventMap,
				handleGestureChange as EventListener,
			);
			svgEl.removeEventListener(
				"gestureend" as unknown as keyof SVGElementEventMap,
				handleGestureEnd as EventListener,
			);
		};
	}, [svgRef]);

	// Initialize view on mount - fit to view once if a design was loaded with lines.
	// This handles the page refresh scenario where persisted zoomPanState
	// might not match the current viewport dimensions.
	useEffect(() => {
		// Capture initial line count on first run
		if (initialLineCountRef.current === null) {
			initialLineCountRef.current = lines.size;
		}

		// Only run the fit logic once
		if (initialFitDoneRef.current) {
			return;
		}

		// Check if lines were present on initial mount (design loaded from persistence)
		const hadLinesOnMount = initialLineCountRef.current > 0;
		if (!hadLinesOnMount) {
			// No lines on mount - mark as done but don't fit
			// (user will draw lines manually, no auto-fit needed)
			initialFitDoneRef.current = true;
			return;
		}

		// Wait for lines to be available (they might load asynchronously)
		if (lines.size === 0) {
			return;
		}

		// Delay to ensure SVG and zoom behavior are ready
		const timer = setTimeout(() => {
			resetView();
			initialFitDoneRef.current = true;
		}, 100);
		return () => clearTimeout(timer);
	}, [resetView, lines.size]);

	// Re-fit when cellSize changes (e.g., user changes grid cell size parameter)
	useEffect(() => {
		// Skip on initial render - only react to actual changes
		if (prevCellSizeRef.current === cellSize) {
			return;
		}
		prevCellSizeRef.current = cellSize;

		// Only re-fit if initial fit is done to avoid race conditions
		if (!initialFitDoneRef.current) {
			return;
		}

		// Delay to let the DOM update with new dimensions
		const timer = setTimeout(resetView, 50);
		return () => clearTimeout(timer);
	}, [cellSize, resetView]);

	return {
		state: { zoom, panX, panY },
		actions: { resetView, zoomBy },
	};
}
