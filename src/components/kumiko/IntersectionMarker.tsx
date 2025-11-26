import type { Intersection, Line } from "../../lib/kumiko";
import {
	getNotchBadgeDimensions,
	getNotchClickPadding,
	NotchToggleMarker,
} from "./NotchToggleMarker";

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

	const labelDescription = horizontalOnTop
		? "Horizontal strip on top"
		: "Vertical strip on top";

	const centerX = position.x;
	const centerY = position.y;
	const clickPadding = getNotchClickPadding(zoom);
	const { width: badgeWidth, height: badgeHeight } =
		getNotchBadgeDimensions(zoom);
	const badgeX = centerX - badgeWidth / 2;
	const badgeY = centerY - badgeHeight / 2;

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
			{/* Invisible click target area */}
			<rect
				x={badgeX - clickPadding}
				y={badgeY - clickPadding}
				width={badgeWidth + clickPadding * 2}
				height={badgeHeight + clickPadding * 2}
				fill="transparent"
			/>

			{/* Notch visualization */}
			<NotchToggleMarker
				centerX={centerX}
				centerY={centerY}
				zoom={zoom}
				notchPointsDown={horizontalOnTop}
			/>

			<title>
				{labelDescription}. Click to swap which strip is on top.
			</title>
		</g>
	);
}
