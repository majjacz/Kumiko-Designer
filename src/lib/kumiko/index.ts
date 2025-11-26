/**
 * Kumiko Designer - Main Barrel Export
 *
 * This file re-exports all public types and functions from the kumiko library.
 */

// Components (re-exported from components folder for backward compatibility)
export type { GridDesignerProps } from "../../components/kumiko/GridDesigner";
export {
	GridDesigner,
	GridDesignerConnected,
} from "../../components/kumiko/GridDesigner";
export type { LayoutEditorProps } from "../../components/kumiko/LayoutEditor";
export {
	LayoutEditor,
	LayoutEditorConnected,
} from "../../components/kumiko/LayoutEditor";
export type { ParamInputProps } from "../../components/kumiko/ParamInput";
export { ParamInput } from "../../components/kumiko/ParamInput";
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
// Layout helpers
export {
	computeKerfedLayoutRows,
	computeRowLengths,
	getStripConfigKey,
	validateStripPlacement,
} from "./layout-helpers";
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
