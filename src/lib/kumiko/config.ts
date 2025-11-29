/**
 * Kumiko Designer Configuration Constants
 *
 * This file centralizes all magic numbers and default values used throughout the application.
 * All values are in millimeters unless otherwise specified.
 */

// =============================================================================
// Grid Constants
// =============================================================================

/** Effective "infinite" grid extent in each direction (number of cells) */
export const GRID_EXTENT_CELLS = 1000;

/** Height of each row in the layout editor (mm) */
export const GRID_CELL_HEIGHT = 20;

/** Margin around the grid in the layout editor (mm) */
export const GRID_MARGIN = 10;

// =============================================================================
// Zoom Constants
// =============================================================================

/** Default zoom level for the grid designer */
export const DEFAULT_ZOOM = 40;

/** Minimum allowed zoom level */
export const MIN_ZOOM = DEFAULT_ZOOM / 8;

/** Maximum allowed zoom level */
export const MAX_ZOOM = DEFAULT_ZOOM * 8;

// =============================================================================
// Precision Constants
// =============================================================================

/** Small threshold for endpoint detection in geometry calculations */
export const EPSILON = 0.01;

// =============================================================================
// Default Parameter Values
// =============================================================================

/** Default bit size in mm (1/4 inch) */
export const DEFAULT_BIT_SIZE = 6.35;

// =============================================================================
// Unit Conversion Constants
// =============================================================================

export const INCH_TO_MM = 25.4;
export const MM_TO_INCH = 1 / INCH_TO_MM;

/** Default cut depth in mm */
export const DEFAULT_CUT_DEPTH = 19;

/** Default half cut depth in mm */
export const DEFAULT_HALF_CUT_DEPTH = 9.5;

/** Default grid cell size in mm */
export const DEFAULT_GRID_CELL_SIZE = 10;

/** Default stock/board length in mm (~24 inches) */
export const DEFAULT_STOCK_LENGTH = 600;

/** Default display unit */
export const DEFAULT_UNITS: "mm" | "in" = "mm";
