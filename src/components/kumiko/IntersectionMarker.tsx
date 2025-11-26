import type { Intersection, Line } from "../../lib/kumiko";

interface IntersectionMarkerProps {
	intersection: Intersection;
	lines: Map<string, Line>;
	position: { x: number; y: number };
	bitSize: number;
	zoom: number;
	onToggle: (id: string) => void;
	onHoverStart: () => void;
	onHoverEnd: () => void;
}

export function IntersectionMarker({
	intersection,
	lines,
	position,
	bitSize,
	zoom,
	onToggle,
	onHoverStart,
	onHoverEnd,
}: IntersectionMarkerProps) {
	const line1 = lines.get(intersection.line1Id);
	const line2 = lines.get(intersection.line2Id);

	const isLine1Horizontal =
		!!line1 && line1.y1 === line1.y2 && line1.x1 !== line1.x2;
	const isLine2Horizontal =
		!!line2 && line2.y1 === line2.y2 && line2.x1 !== line2.x2;

	const hasHorizontal = isLine1Horizontal || isLine2Horizontal;

	// Non-horizontal intersection: simple circle marker
	if (!hasHorizontal) {
		return (
			<g>
				<circle
					cx={position.x}
					cy={position.y}
					r={Math.max(1.5, bitSize / 5)}
					fill="#9CA3AF"
					opacity={0.5}
					pointerEvents="none"
				/>
			</g>
		);
	}

	const horizontalOnTop = (() => {
		if (isLine1Horizontal && !isLine2Horizontal) {
			return intersection.line1Over;
		}
		if (isLine2Horizontal && !isLine1Horizontal) {
			return !intersection.line1Over;
		}
		return intersection.line1Over;
	})();

	const activeFill = horizontalOnTop ? "#10B981" : "#3B82F6";
	const labelDescription = horizontalOnTop ? "Cut from bottom" : "Cut from top";

	const baseBadgeWidthPx = 72;
	const baseBadgeHeightPx = 32;
	const baseClickPaddingPx = 16;
	const baseNotchWidthPx = 40;
	const baseNotchHeightPx = 24;

	const badgeWidth = baseBadgeWidthPx / zoom;
	const badgeHeight = baseBadgeHeightPx / zoom;
	const clickPadding = baseClickPaddingPx / zoom;
	const notchWidth = baseNotchWidthPx / zoom;
	const notchHeight = baseNotchHeightPx / zoom;

	const centerX = position.x;
	const centerY = position.y;
	const badgeX = centerX - badgeWidth / 2;
	const badgeY = centerY - badgeHeight / 2;

	const notchDirection = horizontalOnTop ? 1 : -1;
	const boardY = centerY;
	const boardX1 = centerX - notchWidth / 2;
	const boardX2 = centerX + notchWidth / 2;
	const notchBaseY = boardY;
	const notchApexY = notchBaseY + notchHeight * notchDirection;
	const notchLeftX = centerX - notchWidth * 0.35;
	const notchRightX = centerX + notchWidth * 0.35;
	const notchPoints = `${notchLeftX},${notchBaseY} ${notchRightX},${notchBaseY} ${centerX},${notchApexY}`;

	return (
		// biome-ignore lint: SVG group is used as an interactive hit target inside the grid canvas
		<g
			data-testid="intersection-toggle"
			role="button"
			aria-label={`Toggle notch at ${intersection.x},${intersection.y}`}
			className="cursor-pointer"
			tabIndex={0}
			onMouseDown={(e) => {
				e.stopPropagation();
			}}
			onClick={(e) => {
				e.stopPropagation();
				onToggle(intersection.id);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onToggle(intersection.id);
				}
			}}
			onMouseEnter={onHoverStart}
			onMouseLeave={onHoverEnd}
		>
			<rect
				x={badgeX - clickPadding}
				y={badgeY - clickPadding}
				width={badgeWidth + clickPadding * 2}
				height={badgeHeight + clickPadding * 2}
				fill="transparent"
			/>

			<rect
				x={badgeX}
				y={badgeY}
				width={badgeWidth}
				height={badgeHeight}
				rx={badgeHeight / 2}
				fill="#111827"
				stroke={activeFill}
				strokeWidth={Math.max(0.75, 1 / zoom)}
				pointerEvents="none"
			/>

			<line
				x1={boardX1}
				y1={boardY}
				x2={boardX2}
				y2={boardY}
				stroke="#E5E7EB"
				strokeWidth={Math.max(1, 2 / zoom)}
				strokeLinecap="round"
				pointerEvents="none"
			/>
			<polygon
				points={notchPoints}
				fill={activeFill}
				stroke="#F9FAFB"
				strokeWidth={Math.max(0.75, 1 / zoom)}
				pointerEvents="none"
			/>

			<title>
				{labelDescription} (horizontal strip). Click to flip notch direction.
			</title>
		</g>
	);
}
