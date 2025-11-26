interface NotchToggleMarkerProps {
	/** Center X position in SVG coordinates */
	centerX: number;
	/** Center Y position in SVG coordinates */
	centerY: number;
	/** Current zoom level, used for scaling visual elements */
	zoom: number;
	/** Whether the notch points downward (cut from bottom) or upward (cut from top) */
	notchPointsDown: boolean;
	/** Custom colors for the marker */
	colors?: {
		/** Color when notch points down (default: #10B981 - emerald) */
		down?: string;
		/** Color when notch points up (default: #3B82F6 - blue) */
		up?: string;
		/** Badge background color (default: #111827 - gray-900) */
		badgeBackground?: string;
		/** Board line color (default: #E5E7EB - gray-200) */
		boardLine?: string;
		/** Notch stroke color (default: #F9FAFB - gray-50) */
		notchStroke?: string;
	};
	/** Custom sizes in pixels (will be scaled by zoom) */
	sizes?: {
		/** Badge width in pixels (default: 72) */
		badgeWidth?: number;
		/** Badge height in pixels (default: 32) */
		badgeHeight?: number;
		/** Click padding around badge in pixels (default: 16) */
		clickPadding?: number;
		/** Notch triangle width in pixels (default: 40) */
		notchWidth?: number;
		/** Notch triangle height in pixels (default: 24) */
		notchHeight?: number;
	};
}

const DEFAULT_COLORS = {
	down: "#10B981", // emerald-500
	up: "#3B82F6", // blue-500
	badgeBackground: "#111827", // gray-900
	boardLine: "#E5E7EB", // gray-200
	notchStroke: "#F9FAFB", // gray-50
};

const DEFAULT_SIZES = {
	badgeWidth: 72,
	badgeHeight: 32,
	clickPadding: 16,
	notchWidth: 40,
	notchHeight: 24,
};

/**
 * Visual representation of a notch toggle marker.
 * Displays a badge with a board line and a triangle indicating notch direction.
 * This is a pure presentational component - interaction handling is done by the parent.
 */
export function NotchToggleMarker({
	centerX,
	centerY,
	zoom,
	notchPointsDown,
	colors: customColors,
	sizes: customSizes,
}: NotchToggleMarkerProps) {
	const colors = { ...DEFAULT_COLORS, ...customColors };
	const sizes = { ...DEFAULT_SIZES, ...customSizes };

	const activeFill = notchPointsDown ? colors.down : colors.up;

	// Scale sizes by zoom
	const badgeWidth = sizes.badgeWidth / zoom;
	const badgeHeight = sizes.badgeHeight / zoom;
	const notchWidth = sizes.notchWidth / zoom;
	const notchHeight = sizes.notchHeight / zoom;

	// Badge positioning
	const badgeX = centerX - badgeWidth / 2;
	const badgeY = centerY - badgeHeight / 2;

	// Notch triangle positioning
	const notchDirection = notchPointsDown ? 1 : -1;
	const boardX1 = centerX - notchWidth / 2;
	const boardX2 = centerX + notchWidth / 2;
	const notchBaseY = centerY;
	const notchApexY = notchBaseY + notchHeight * notchDirection;
	const notchLeftX = centerX - notchWidth * 0.35;
	const notchRightX = centerX + notchWidth * 0.35;
	const notchPoints = `${notchLeftX},${notchBaseY} ${notchRightX},${notchBaseY} ${centerX},${notchApexY}`;

	return (
		<>
			{/* Badge background */}
			<rect
				x={badgeX}
				y={badgeY}
				width={badgeWidth}
				height={badgeHeight}
				rx={badgeHeight / 2}
				fill={colors.badgeBackground}
				stroke={activeFill}
				strokeWidth={Math.max(0.75, 1 / zoom)}
				pointerEvents="none"
			/>

			{/* Board line */}
			<line
				x1={boardX1}
				y1={centerY}
				x2={boardX2}
				y2={centerY}
				stroke={colors.boardLine}
				strokeWidth={Math.max(1, 2 / zoom)}
				strokeLinecap="round"
				pointerEvents="none"
			/>

			{/* Notch triangle */}
			<polygon
				points={notchPoints}
				fill={activeFill}
				stroke={colors.notchStroke}
				strokeWidth={Math.max(0.75, 1 / zoom)}
				pointerEvents="none"
			/>
		</>
	);
}

/**
 * Returns the click padding size scaled by zoom.
 * Useful for creating the invisible click target area around the marker.
 */
export function getNotchClickPadding(
	zoom: number,
	customClickPadding?: number,
): number {
	return (customClickPadding ?? DEFAULT_SIZES.clickPadding) / zoom;
}

/**
 * Returns the badge dimensions scaled by zoom.
 * Useful for positioning the click target area.
 */
export function getNotchBadgeDimensions(
	zoom: number,
	customSizes?: { badgeWidth?: number; badgeHeight?: number },
): { width: number; height: number } {
	return {
		width: (customSizes?.badgeWidth ?? DEFAULT_SIZES.badgeWidth) / zoom,
		height: (customSizes?.badgeHeight ?? DEFAULT_SIZES.badgeHeight) / zoom,
	};
}
