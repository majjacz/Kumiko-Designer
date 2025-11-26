/**
 * D3 Type Declarations for Zoom/Pan Behavior
 *
 * These types help bridge the gap between d3-selection and d3-zoom
 * type definitions, which don't always align properly in TypeScript.
 */

import type { Selection } from "d3-selection";
import type { ZoomBehavior, ZoomTransform } from "d3-zoom";

/**
 * Type for SVG selection used with zoom behavior.
 */
export type SVGSelection = Selection<SVGSVGElement, unknown, null, undefined>;

/**
 * Type for zoom behavior bound to SVG elements.
 */
export type SVGZoomBehavior = ZoomBehavior<SVGSVGElement, unknown>;

/**
 * Safari-specific gesture event interface.
 * Safari uses non-standard gesture events for pinch-to-zoom.
 */
export interface GestureEvent extends Event {
	readonly scale: number;
	readonly rotation: number;
}

/**
 * Apply zoom behavior to a selection.
 * Type-safe wrapper for `selection.call(zoomBehavior)`.
 */
export function applyZoomBehavior(
	selection: SVGSelection,
	behavior: SVGZoomBehavior,
): SVGSelection {
	// biome-ignore lint/suspicious/noExplicitAny: D3 type bridge - intentional type coercion for d3-selection/d3-zoom incompatibility
	return (selection as any).call(behavior);
}

/**
 * Apply a zoom transform to a selection via zoom behavior.
 * Type-safe wrapper for `selection.call(zoomBehavior.transform, transform)`.
 */
export function applyZoomTransform(
	selection: SVGSelection,
	behavior: SVGZoomBehavior,
	transform: ZoomTransform,
): SVGSelection {
	// biome-ignore lint/suspicious/noExplicitAny: D3 type bridge - intentional type coercion for d3-selection/d3-zoom incompatibility
	return (selection as any).call(behavior.transform, transform);
}

/**
 * Scale the selection by a factor via zoom behavior.
 * Type-safe wrapper for `selection.call(zoomBehavior.scaleBy, factor)`.
 */
export function applyZoomScaleBy(
	selection: SVGSelection,
	behavior: SVGZoomBehavior,
	factor: number,
): SVGSelection {
	// biome-ignore lint/suspicious/noExplicitAny: D3 type bridge - intentional type coercion for d3-selection/d3-zoom incompatibility
	return (selection as any).call(behavior.scaleBy, factor);
}

/**
 * Translate the selection by an offset via zoom behavior.
 * Type-safe wrapper for `selection.call(zoomBehavior.translateBy, dx, dy)`.
 */
export function applyZoomTranslateBy(
	selection: SVGSelection,
	behavior: SVGZoomBehavior,
	dx: number,
	dy: number,
): SVGSelection {
	// biome-ignore lint/suspicious/noExplicitAny: D3 type bridge - intentional type coercion for d3-selection/d3-zoom incompatibility
	return (selection as any).call(behavior.translateBy, dx, dy);
}
