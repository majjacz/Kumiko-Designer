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
		/** Horizontal strip color (default: #F59E0B - amber) */
		horizontal?: string;
		/** Vertical strip color (default: #8B5CF6 - violet) */
		vertical?: string;
		/** Badge background color (default: #111827 - gray-900) */
		badgeBackground?: string;
		/** Notch cut color (default: #111827 - gray-900) */
		notchCut?: string;
	};
	/** Custom sizes in pixels (will be scaled by zoom) */
	sizes?: {
		/** Badge width in pixels (default: 56) */
		badgeWidth?: number;
		/** Badge height in pixels (default: 56) */
		badgeHeight?: number;
		/** Click padding around badge in pixels (default: 16) */
		clickPadding?: number;
	};
}

const DEFAULT_COLORS = {
	horizontal: "#F59E0B", // amber-500
	vertical: "#8B5CF6", // violet-500
	badgeBackground: "#1F2937", // gray-800
	notchCut: "#1F2937", // gray-800
};

const DEFAULT_SIZES = {
	badgeWidth: 200,
	badgeHeight: 200,
	clickPadding: 16,
};

/**
 * Visual representation of a notch toggle marker.
 * Shows a 3D-like isometric view of two crossing strips to clearly indicate
 * which strip is on top and where the notch is cut.
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

	// Scale sizes by zoom with a minimum size to prevent markers from becoming too small at high zoom levels
	// At zoom=40 (default/100%): badgeSize = 200/40 = 5
	// At zoom=100 (250%): badgeSize = max(200/100, 2.5) = 2.5 (clamped)
	// This ensures the badge stays visible and clickable at high zoom
	const minBadgeSize = sizes.badgeWidth / 80; // minimum size at 200% zoom equivalent
	const badgeSize = Math.max(minBadgeSize, sizes.badgeWidth / zoom);
	
	// Stroke width scales more slowly to remain visible at high zoom levels
	// Uses sqrt scaling so stroke doesn't become paper-thin when zoomed in
	const strokeWidth = Math.max(0.5, 2 / Math.sqrt(zoom));

	// Badge positioning (circular badge)
	const badgeRadius = badgeSize / 2;

	// Strip dimensions (relative to badge)
	const stripWidth = badgeSize * 0.22;
	const stripLength = badgeSize * 0.7;
	const notchDepth = stripWidth * 0.5;

	// Horizontal strip (amber) - always drawn
	const hStripTop = centerY - stripWidth / 2;
	const hStripLeft = centerX - stripLength / 2;

	// Vertical strip (violet) - always drawn
	const vStripLeft = centerX - stripWidth / 2;
	const vStripTop = centerY - stripLength / 2;

	// Determine which strip has the notch
	// notchPointsDown = true means horizontal strip is on top, so vertical has notch cut from top
	// notchPointsDown = false means vertical strip is on top, so horizontal has notch cut from top
	const horizontalOnTop = notchPointsDown;

	return (
		<>
			{/* Badge background circle */}
			<circle
				cx={centerX}
				cy={centerY}
				r={badgeRadius}
				fill={colors.badgeBackground}
				stroke={horizontalOnTop ? colors.horizontal : colors.vertical}
				strokeWidth={strokeWidth * 1.5}
				pointerEvents="none"
			/>

			{horizontalOnTop ? (
				<>
					{/* Vertical strip (bottom layer) - with notch */}
					<rect
						x={vStripLeft}
						y={vStripTop}
						width={stripWidth}
						height={(stripLength - stripWidth) / 2}
						fill={colors.vertical}
						rx={strokeWidth}
						pointerEvents="none"
					/>
					<rect
						x={vStripLeft}
						y={centerY + stripWidth / 2}
						width={stripWidth}
						height={(stripLength - stripWidth) / 2}
						fill={colors.vertical}
						rx={strokeWidth}
						pointerEvents="none"
					/>
					{/* Notch visualization on vertical strip (cut from top) */}
					<rect
						x={vStripLeft}
						y={centerY - stripWidth / 2}
						width={stripWidth}
						height={notchDepth}
						fill={colors.notchCut}
						pointerEvents="none"
					/>
					<rect
						x={vStripLeft}
						y={centerY - stripWidth / 2 + notchDepth}
						width={stripWidth}
						height={stripWidth - notchDepth}
						fill={colors.vertical}
						opacity={0.6}
						pointerEvents="none"
					/>

					{/* Horizontal strip (top layer) - no notch, full width */}
					<rect
						x={hStripLeft}
						y={hStripTop}
						width={stripLength}
						height={stripWidth}
						fill={colors.horizontal}
						rx={strokeWidth}
						pointerEvents="none"
					/>
				</>
			) : (
				<>
					{/* Horizontal strip (bottom layer) - with notch */}
					<rect
						x={hStripLeft}
						y={hStripTop}
						width={(stripLength - stripWidth) / 2}
						height={stripWidth}
						fill={colors.horizontal}
						rx={strokeWidth}
						pointerEvents="none"
					/>
					<rect
						x={centerX + stripWidth / 2}
						y={hStripTop}
						width={(stripLength - stripWidth) / 2}
						height={stripWidth}
						fill={colors.horizontal}
						rx={strokeWidth}
						pointerEvents="none"
					/>
					{/* Notch visualization on horizontal strip (cut from top) */}
					<rect
						x={centerX - stripWidth / 2}
						y={hStripTop}
						width={stripWidth}
						height={notchDepth}
						fill={colors.notchCut}
						pointerEvents="none"
					/>
					<rect
						x={centerX - stripWidth / 2}
						y={hStripTop + notchDepth}
						width={stripWidth}
						height={stripWidth - notchDepth}
						fill={colors.horizontal}
						opacity={0.6}
						pointerEvents="none"
					/>

					{/* Vertical strip (top layer) - no notch, full height */}
					<rect
						x={vStripLeft}
						y={vStripTop}
						width={stripWidth}
						height={stripLength}
						fill={colors.vertical}
						rx={strokeWidth}
						pointerEvents="none"
					/>
				</>
			)}

			{/* Direction indicator arrow */}
			<g pointerEvents="none">
				{horizontalOnTop ? (
					// Arrow pointing down (notch cut from top of vertical strip)
					<path
						d={`M ${centerX} ${centerY + badgeRadius * 0.6} 
							 L ${centerX - badgeRadius * 0.15} ${centerY + badgeRadius * 0.45} 
							 L ${centerX + badgeRadius * 0.15} ${centerY + badgeRadius * 0.45} Z`}
						fill={colors.vertical}
						opacity={0.8}
					/>
				) : (
					// Arrow pointing up (notch cut from top of horizontal strip)
					<path
						d={`M ${centerX} ${centerY - badgeRadius * 0.6} 
							 L ${centerX - badgeRadius * 0.15} ${centerY - badgeRadius * 0.45} 
							 L ${centerX + badgeRadius * 0.15} ${centerY - badgeRadius * 0.45} Z`}
						fill={colors.horizontal}
						opacity={0.8}
					/>
				)}
			</g>
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
	const padding = customClickPadding ?? DEFAULT_SIZES.clickPadding;
	const minPadding = padding / 80;
	return Math.max(minPadding, padding / zoom);
}

/**
 * Returns the badge dimensions scaled by zoom.
 * Useful for positioning the click target area.
 */
export function getNotchBadgeDimensions(
	zoom: number,
	customSizes?: { badgeWidth?: number; badgeHeight?: number },
): { width: number; height: number } {
	const size = customSizes?.badgeWidth ?? DEFAULT_SIZES.badgeWidth;
	const minSize = size / 80;
	const scaledSize = Math.max(minSize, size / zoom);
	return {
		width: scaledSize,
		height: scaledSize,
	};
}
