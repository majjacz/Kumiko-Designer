import { Trash2 } from "lucide-react";
import type React from "react";
import { memo, useState } from "react";
import {
	type DesignStrip,
	formatValue,
	type Piece,
	type Point,
} from "../../lib/kumiko";
import { GRID_CELL_HEIGHT, GRID_MARGIN } from "../../lib/kumiko/config";
import { validateStripPlacement } from "../../lib/kumiko/kumiko-layout-editor";

export interface LayoutCanvasProps {
	/** SVG element ref setter */
	setSvgElement: (el: SVGSVGElement | null) => void;
	/** Kerf-adjusted layout data: rowIndex -> pieces */
	layoutData: Map<number, Piece[]>;
	/** All design strips */
	designStrips: DesignStrip[];
	/** Number of rows to display */
	dynamicLayoutRows: number;
	/** Maximum stock length in mm */
	stockLength: number;
	/** Bit size in mm */
	bitSize: number;
	/** Half cut depth in mm */
	halfCutDepth: number;
	/** Row lengths map */
	rowLengths: Map<number, number>;
	/** Currently selected strip ID for placement */
	selectedPieceId: string | null;
	/** Handler for clicking on the canvas to place a strip */
	onLayoutClick: (point: Point, rowIndex: number) => void;
	/** Handler to delete a piece */
	onDeletePiece: (pieceId: string) => void;
	/** Display unit */
	displayUnit: "mm" | "in";
}

/**
 * LayoutCanvas renders the SVG canvas for laying out strips in rows.
 * It handles mouse interactions for placing new strips and displays
 * existing pieces with their notches.
 */
export const LayoutCanvas = memo(function LayoutCanvas({
	setSvgElement,
	layoutData,
	designStrips,
	dynamicLayoutRows,
	stockLength,
	bitSize,
	halfCutDepth,
	rowLengths,
	selectedPieceId,
	onLayoutClick,
	onDeletePiece,
	displayUnit,
}: LayoutCanvasProps) {
	const [svgElement, setSvgElementInternal] = useState<SVGSVGElement | null>(
		null,
	);
	const [activeLayoutPieceId, setActiveLayoutPieceId] = useState<string | null>(
		null,
	);
	const [hoverPoint, setHoverPoint] = useState<{
		point: Point;
		rowIndex: number;
	} | null>(null);

	// Combined ref setter
	const handleSvgRef = (el: SVGSVGElement | null) => {
		setSvgElementInternal(el);
		setSvgElement(el);
	};

	// Calculate viewBox dimensions
	const minX = -GRID_MARGIN;
	const minY = -GRID_MARGIN;
	const viewBoxWidth = stockLength + GRID_MARGIN + 40 - minX;
	const viewBoxHeight =
		dynamicLayoutRows * GRID_CELL_HEIGHT + GRID_MARGIN - minY;

	const getLayoutPoint = (
		e: React.MouseEvent<SVGSVGElement>,
	): { point: Point; rowIndex: number } | null => {
		if (!svgElement) return null;

		// Use proper SVG coordinate transformation to handle viewBox and aspect ratio
		const pt = svgElement.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;

		const svgP = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());
		const svgX = svgP.x;
		const svgY = svgP.y;

		// Define the actual grid bounds (where strips are placed)
		const gridStartX = 0;
		const gridStartY = 0;
		const gridEndX = stockLength;
		const gridEndY = dynamicLayoutRows * GRID_CELL_HEIGHT;

		// Only process if mouse is within the grid rectangle
		if (
			svgX < gridStartX ||
			svgX > gridEndX ||
			svgY < gridStartY ||
			svgY > gridEndY
		) {
			return null; // Outside grid area
		}

		// Determine which row was clicked (grid rows start at y=0)
		const rowIndex = Math.floor(svgY / GRID_CELL_HEIGHT);

		// Calculate the x position within the row (snapped to the end of existing pieces)
		const currentRowPieces = layoutData.get(rowIndex) || [];
		let rowEndX = 0;
		if (currentRowPieces.length > 0) {
			const lastPiece = currentRowPieces[currentRowPieces.length - 1];
			const strip = designStrips.find((s) => s.id === lastPiece.lineId);
			if (strip) {
				rowEndX = lastPiece.x + strip.lengthMM + bitSize;
			}
		}

		return {
			point: { x: rowEndX, y: rowIndex * GRID_CELL_HEIGHT },
			rowIndex,
		};
	};

	const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
		const result = getLayoutPoint(e);
		if (!result || !selectedPieceId) return;

		const strip = designStrips.find((s) => s.id === selectedPieceId);
		if (strip) {
			if (
				!validateStripPlacement(
					strip.lengthMM,
					result.point.x,
					stockLength,
					GRID_CELL_HEIGHT,
				)
			) {
				console.warn(
					"Cannot place strip: It would extend more than half its width beyond the stock length.",
				);
				return;
			}
		}

		onLayoutClick(result.point, result.rowIndex);
	};

	const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
		if (!selectedPieceId) {
			setHoverPoint(null);
			return;
		}
		const result = getLayoutPoint(e);
		if (result) {
			setHoverPoint(result);
		}
	};

	const handleMouseLeave = () => {
		setHoverPoint(null);
	};

	return (
		<div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-gray-900 border border-gray-800 rounded">
			<svg
				data-testid="layout-canvas"
				ref={handleSvgRef}
				viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
				className="w-full h-full"
				onMouseDown={handleClick}
				onClick={() => !selectedPieceId && setActiveLayoutPieceId(null)}
				onKeyDown={(e) => e.key === "Escape" && setActiveLayoutPieceId(null)}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				role="img"
				aria-label="Kumiko layout editor"
			>
				<title>Kumiko layout editor</title>

				{/* Background */}
				<rect
					x={minX}
					y={minY}
					width={viewBoxWidth}
					height={viewBoxHeight}
					fill="#030712"
				/>

				{/* Grid rows */}
				{Array.from({ length: dynamicLayoutRows }, (_, rowIndex) => ({
					rowIndex,
				})).map(({ rowIndex }) => {
					const y = rowIndex * GRID_CELL_HEIGHT;
					const rowLength = rowLengths.get(rowIndex) || 0;
					const isOverLength = rowLength > stockLength;

					return (
						<g key={`row-${rowIndex}`}>
							{/* Row background (board area) */}
							<rect
								x={0}
								y={y}
								width={stockLength}
								height={GRID_CELL_HEIGHT}
								fill={isOverLength ? "#7F1D1D" : "#111827"}
								fillOpacity={0.3}
								stroke="#374151"
								strokeWidth={0.5}
								strokeDasharray="2 2"
							/>
							{/* Row label */}
							<text
								x={-5}
								y={y + GRID_CELL_HEIGHT / 2}
								fontSize="8"
								fill="#6B7280"
								textAnchor="end"
								dominantBaseline="middle"
							>
								{rowIndex}
							</text>
							{/* Row length indicator */}
							{rowLength > 0 && (
								<text
									x={stockLength + 5}
									y={y + GRID_CELL_HEIGHT / 2}
									fontSize="7"
									fill={isOverLength ? "#EF4444" : "#10B981"}
									textAnchor="start"
									dominantBaseline="middle"
								>
									{formatValue(rowLength, displayUnit)}
									{displayUnit}
									{isOverLength && " ⚠️"}
								</text>
							)}
						</g>
					);
				})}

				{/* Maximum stock length indicator line */}
				<line
					x1={stockLength}
					y1={0}
					x2={stockLength}
					y2={dynamicLayoutRows * GRID_CELL_HEIGHT}
					stroke="#EF4444"
					strokeWidth={1}
					strokeDasharray="4 2"
					opacity={0.5}
				/>
				<text
					x={stockLength}
					y={-3}
					fontSize="8"
					fill="#EF4444"
					textAnchor="middle"
				>
					Max stock: {formatValue(stockLength, displayUnit)}
					{displayUnit}
				</text>

				{/* Pieces */}
				{Array.from(layoutData.values())
					.flat()
					.map((piece) => {
						const strip = designStrips.find((s) => s.id === piece.lineId);
						if (!strip) return null;

						const w = strip.lengthMM;
						const h = GRID_CELL_HEIGHT;

						// Determine if the strip should be flipped
						const topNotches = strip.notches.filter((n) => n.fromTop).length;
						const bottomNotches = strip.notches.length - topNotches;
						const shouldFlip = bottomNotches > topNotches;
						const isPieceActive = activeLayoutPieceId === piece.id;

						return (
							// biome-ignore lint: SVG group is used as an interactive hit target inside <svg>
							<g
								key={piece.id}
								data-testid="layout-piece"
								className={`cursor-default group outline-none ${selectedPieceId ? "pointer-events-none" : ""}`}
								tabIndex={selectedPieceId ? -1 : 0}
								onClick={(e) => {
									e.stopPropagation();
									setActiveLayoutPieceId(isPieceActive ? null : piece.id);
								}}
							>
								{/* Strip body */}
								<rect
									x={piece.x}
									y={piece.y}
									width={w}
									height={h}
									fill="#1E3A8A"
									stroke="#60A5FA"
									strokeWidth={0.8}
									rx={1}
									ry={1}
								/>
								{/* Notches */}
								{strip.notches.map((notch) => {
									const center = notch.dist;
									const left = piece.x + center - bitSize / 2;
									const topHeight = halfCutDepth;
									const isTopNotch = shouldFlip
										? !notch.fromTop
										: notch.fromTop;
									const rectY = isTopNotch ? piece.y : piece.y + h - topHeight;
									return (
										<rect
											key={notch.id}
											x={left}
											y={rectY}
											width={bitSize}
											height={topHeight}
											fill="#7C3AED"
											stroke="#FBBF24"
											strokeWidth={0.4}
										/>
									);
								})}
								{/* Strip label: show the same short strip ID used in the grid and strip bank */}
								<text
									x={piece.x + w / 2}
									y={piece.y + h / 2}
									fontSize="7"
									fill="#BFDBFE"
									textAnchor="middle"
									dominantBaseline="middle"
									pointerEvents="none"
								>
									{strip.displayCode}
								</text>

								{/* Delete button */}
								{/* biome-ignore lint/a11y/useSemanticElements: SVG element acting as button */}
								<g
									data-testid="delete-strip-button"
									className={`cursor-pointer transition-opacity ${isPieceActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
									onClick={(e) => {
										e.stopPropagation();
										onDeletePiece(piece.id);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.stopPropagation();
											onDeletePiece(piece.id);
										}
									}}
									role="button"
									tabIndex={0}
								>
									<rect
										x={piece.x + w - 14}
										y={piece.y + 2}
										width={12}
										height={12}
										rx={2}
										fill="#EF4444"
										fillOpacity={0.8}
									/>
									<Trash2
										x={piece.x + w - 13}
										y={piece.y + 3}
										width={10}
										height={10}
										color="white"
										strokeWidth={2}
									/>
								</g>

								<title>
									Strip {strip.displayCode} -{" "}
									{formatValue(strip.lengthMM, displayUnit)}
									{displayUnit} Row {piece.rowIndex}
								</title>
							</g>
						);
					})}

				{/* Hover preview */}
				{hoverPoint &&
					selectedPieceId &&
					(() => {
						const previewStrip = designStrips.find(
							(s) => s.id === selectedPieceId,
						);
						if (!previewStrip) return null;

						const w = previewStrip.lengthMM;
						const h = GRID_CELL_HEIGHT;

						const topNotches = previewStrip.notches.filter(
							(n) => n.fromTop,
						).length;
						const bottomNotches = previewStrip.notches.length - topNotches;
						const shouldFlip = bottomNotches > topNotches;

						return (
							<g opacity={0.5}>
								{/* Strip preview body */}
								<rect
									x={hoverPoint.point.x}
									y={hoverPoint.point.y}
									width={w}
									height={h}
									fill="#3B82F6"
									stroke="#60A5FA"
									strokeWidth={1}
									strokeDasharray="3 3"
									rx={1}
									ry={1}
									pointerEvents="none"
								/>
								{/* Notches preview */}
								{previewStrip.notches.map((notch) => {
									const center = notch.dist;
									const left = hoverPoint.point.x + center - bitSize / 2;
									const topHeight = halfCutDepth;
									const isTopNotch = shouldFlip
										? !notch.fromTop
										: notch.fromTop;
									const rectY = isTopNotch
										? hoverPoint.point.y
										: hoverPoint.point.y + h - topHeight;
									return (
										<rect
											key={notch.id}
											x={left}
											y={rectY}
											width={bitSize}
											height={topHeight}
											fill="#A78BFA"
											stroke="#FBBF24"
											strokeWidth={0.4}
											strokeDasharray="2 2"
											pointerEvents="none"
										/>
									);
								})}
								{/* Preview label */}
								<text
									x={hoverPoint.point.x + w / 2}
									y={hoverPoint.point.y + h / 2}
									fontSize="7"
									fill="#BFDBFE"
									textAnchor="middle"
									dominantBaseline="middle"
									pointerEvents="none"
									opacity={0.8}
								>
									Preview
								</text>
							</g>
						);
					})()}
			</svg>
		</div>
	);
});
