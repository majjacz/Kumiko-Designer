/**
 * Kumiko Designer - Main Barrel Export
 *
 * This file re-exports all public types and functions from the kumiko library.
 */

// Configuration
export {
	DEFAULT_BIT_SIZE,
	DEFAULT_CUT_DEPTH,
	DEFAULT_GRID_CELL_SIZE,
	DEFAULT_HALF_CUT_DEPTH,
	DEFAULT_STOCK_LENGTH,
	DEFAULT_UNITS,
	DEFAULT_ZOOM,
	EDGE_NOTCH_EPS,
	EPSILON,
	GRID_CELL_HEIGHT,
	GRID_EXTENT_CELLS,
	GRID_MARGIN,
	INCH_TO_MM,
	MAX_ZOOM,
	MIN_ZOOM,
	MM_TO_INCH,
} from "./config";
// Geometry utilities
export {
	computeLineOverlaps,
	distancePointToSegment,
	findIntersection,
	gcd,
} from "./geometry";
// Design logic
export {
	computeDesignStrips,
	computeIntersections,
	normalizeLines,
} from "./kumiko-design-logic";
export type { GridDesignerProps } from "./kumiko-grid-designer";
// Components
export { GridDesigner, GridDesignerConnected } from "./kumiko-grid-designer";
export type { LayoutEditorProps } from "./kumiko-layout-editor";
export {
	computeKerfedLayoutRows,
	getStripConfigKey,
	LayoutEditor,
	LayoutEditorConnected,
} from "./kumiko-layout-editor";
export type { ParamInputProps } from "./kumiko-params";
export { ParamInput } from "./kumiko-params";
// Storage
export type {
	CreateDesignPayloadOptions,
	NamedDesignSummary,
	SavedDesignPayload,
} from "./kumiko-storage";
export {
	clearDesign,
	createDesignPayload,
	deleteNamedDesign,
	listNamedDesigns,
	loadDesign,
	loadNamedDesign,
	saveDesign,
	saveNamedDesign,
} from "./kumiko-storage";
// SVG Export
export type { GenerateGroupSVGOptions } from "./kumiko-svg-export";
export { generateGroupSVG } from "./kumiko-svg-export";
// Templates
export {
	getDefaultTemplateId,
	loadTemplate,
	TEMPLATES,
} from "./kumiko-templates";
// Core types
export type {
	Cut,
	DesignStrip,
	GridViewState,
	Group,
	Intersection,
	Line,
	Notch,
	Piece,
	Point,
} from "./types";
// Utilities
export {
	convertUnit,
	formatValue,
	newId,
} from "./utils";
