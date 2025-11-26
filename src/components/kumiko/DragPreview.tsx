import { memo } from "react";
import type { Point } from "../../lib/kumiko";

export interface DragPreviewProps {
	/** Current drag state with start and current points in grid coordinates */
	dragState: { startPoint: Point; currentPoint: Point } | null;
	/** Whether the current operation is a delete action */
	isDeleting: boolean;
	/** Bit size in mm */
	bitSize: number;
	/** Function to convert grid coordinates to SVG coordinates */
	gridToSvg: (point: Point) => { x: number; y: number };
}

/**
 * DragPreview renders a preview line while dragging to create or delete a line.
 * Shows dashed line with endpoints colored based on whether it's a create or delete action.
 */
export const DragPreview = memo(function DragPreview({
	dragState,
	isDeleting,
	bitSize,
	gridToSvg,
}: DragPreviewProps) {
	if (!dragState) return null;

	const start = gridToSvg(dragState.startPoint);
	const end = gridToSvg(dragState.currentPoint);

	// Don't render if start and end are the same point
	if (
		dragState.startPoint.x === dragState.currentPoint.x &&
		dragState.startPoint.y === dragState.currentPoint.y
	) {
		return null;
	}

	const strokeColor = isDeleting ? "#EF4444" : "#34D399";
	const startFillColor = isDeleting ? "#EF4444" : "#34D399";
	const endFillColor = isDeleting ? "#DC2626" : "#10B981";

	return (
		<>
			<line
				x1={start.x}
				y1={start.y}
				x2={end.x}
				y2={end.y}
				stroke={strokeColor}
				strokeWidth={Math.max(1, bitSize / 4)}
				strokeLinecap="round"
				strokeDasharray="4,4"
				opacity={0.7}
			/>
			<circle
				cx={start.x}
				cy={start.y}
				r={Math.max(2, bitSize / 3)}
				fill={startFillColor}
			/>
			<circle
				cx={end.x}
				cy={end.y}
				r={Math.max(2, bitSize / 3)}
				fill={endFillColor}
			/>
		</>
	);
});
