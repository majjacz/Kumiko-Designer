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
	DEFAULT_ZOOM,
	type GridViewState,
	type Line,
	MAX_ZOOM,
	MIN_ZOOM,
} from "../lib/kumiko";

interface UseZoomPanProps {
	svgRef: React.RefObject<SVGSVGElement | null>;
	contentGroupRef: React.RefObject<SVGGElement | null>;
	lines: Map<string, Line>;
	cellSize: number;
	designWidth: number;
	designHeight: number;
	viewState?: GridViewState;
	onViewStateChange?: (state: GridViewState) => void;
	flags: {
		showNotchPositions: boolean;
		showHelpText: boolean;
		showLineIds: boolean;
	};
}

export function useZoomPan({
	svgRef,
	contentGroupRef,
	lines,
	cellSize,
	designWidth,
	designHeight,
	viewState,
	onViewStateChange,
	flags,
}: UseZoomPanProps) {
	const [zoom, setZoom] = useState(viewState?.zoom ?? DEFAULT_ZOOM);
	const [panX, setPanX] = useState(viewState?.panX ?? 0);
	const [panY, setPanY] = useState(viewState?.panY ?? 0);

	const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
		null,
	);
	const flagsRef = useRef(flags);

	useEffect(() => {
		flagsRef.current = flags;
	}, [flags]);

	/**
	 * Reset view (Fit)
	 */
	const resetView = useCallback(() => {
		const svg = svgRef.current;
		const behavior = zoomBehaviorRef.current;

		if (!svg || !behavior) {
			return;
		}

		const selection = select(svg);
		const lineArray = Array.from(lines.values());

		const applyDefaultView = () => {
			const k = DEFAULT_ZOOM;
			const centerX = designWidth / 2;
			const centerY = designHeight / 2;

			const t = zoomIdentity
				.translate(designWidth / 2, designHeight / 2)
				.scale(k)
				.translate(-centerX, -centerY);

			// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
			selection.call(behavior.transform as any, t);
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

		// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
		selection.call(behavior.transform as any, t);
	}, [lines, cellSize, designWidth, designHeight, svgRef]);

	const zoomBy = useCallback(
		(factor: number) => {
			const svg = svgRef.current;
			const behavior = zoomBehaviorRef.current;
			if (!svg || !behavior) return;

			const selection = select(svg);
			// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
			selection.call(behavior.scaleBy as any, factor);
		},
		[svgRef],
	);

	// Set up d3-zoom behavior
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

				if (onViewStateChange) {
					const { showNotchPositions, showHelpText, showLineIds } =
						flagsRef.current;

					onViewStateChange({
						zoom: t.k,
						panX: t.x,
						panY: t.y,
						showNotchPositions,
						showHelpText,
						showLineIds,
					});
				}
			});

		zoomBehaviorRef.current = behavior;

		const selection = select(svgEl);
		// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
		selection.call(behavior as any);

		if (viewState?.zoom !== undefined) {
			const initialZoom = Number.isFinite(viewState.zoom)
				? viewState.zoom
				: DEFAULT_ZOOM;
			const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom));
			const targetTransform = zoomIdentity
				.translate(viewState.panX ?? 0, viewState.panY ?? 0)
				.scale(clampedZoom);

			const currentTransform = zoomTransform(svgEl);
			const kDiff = Math.abs(currentTransform.k - targetTransform.k);
			const xDiff = Math.abs(currentTransform.x - targetTransform.x);
			const yDiff = Math.abs(currentTransform.y - targetTransform.y);

			if (kDiff > 0.001 || xDiff > 0.1 || yDiff > 0.1) {
				// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
				selection.call(behavior.transform as any, targetTransform);
			}
		}

		return () => {
			selection.on(".zoom", null);
			zoomBehaviorRef.current = null;
		};
	}, [onViewStateChange, viewState, svgRef, contentGroupRef]);

	// Trackpad pan/zoom
	useEffect(() => {
		const svgEl = svgRef.current;
		if (!svgEl) return;

		const handleWheelPanZoom = (event: WheelEvent) => {
			const currentSvg = svgRef.current;
			const currentBehavior = zoomBehaviorRef.current;
			if (!currentSvg || !currentBehavior) return;

			const selection = select(currentSvg);

			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				const factor = Math.exp(-event.deltaY * 0.001);
				// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
				selection.call(currentBehavior.scaleBy as any, factor);
				return;
			}

			event.preventDefault();
			selection.call(
				// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
				currentBehavior.translateBy as any,
				-event.deltaX,
				-event.deltaY,
			);
		};

		const handleGestureStart = (event: Event) => {
			const gesture = event as unknown as {
				scale: number;
				preventDefault?: () => void;
			};
			if (typeof gesture.preventDefault === "function") {
				gesture.preventDefault();
			}
		};

		let lastScale = 1;
		const handleGestureChange = (event: Event) => {
			const currentSvg = svgRef.current;
			const currentBehavior = zoomBehaviorRef.current;
			if (!currentSvg || !currentBehavior) return;

			const gesture = event as unknown as {
				scale: number;
				preventDefault?: () => void;
			};

			const scale = gesture.scale ?? 1;
			const factor = scale / (lastScale || 1);
			lastScale = scale;

			const selection = select(currentSvg);
			if (typeof gesture.preventDefault === "function") {
				gesture.preventDefault();
			}
			// biome-ignore lint/suspicious/noExplicitAny: d3 types mismatch
			selection.call(currentBehavior.scaleBy as any, factor);
		};

		const handleGestureEnd = (event: Event) => {
			const gesture = event as unknown as { preventDefault?: () => void };
			lastScale = 1;
			if (typeof gesture.preventDefault === "function") {
				gesture.preventDefault();
			}
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

	// Initialize view on mount
	useEffect(() => {
		if (viewState) return;
		const timer = setTimeout(resetView, 50);
		return () => clearTimeout(timer);
	}, [resetView, viewState]);

	return {
		state: { zoom, panX, panY },
		actions: { resetView, zoomBy },
	};
}
