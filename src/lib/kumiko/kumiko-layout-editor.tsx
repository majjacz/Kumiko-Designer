import { Download, Eraser, Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { memo, useEffect, useMemo, useState } from "react";
import {
	computeUniqueStrips,
	StripBank,
} from "../../components/kumiko/StripBank";
import { GRID_CELL_HEIGHT, GRID_MARGIN } from "./config";
import {
	type DesignStrip,
	formatValue,
	type Group,
	type Piece,
	type Point,
} from "./kumiko-core";
import { generateGroupSVG } from "./kumiko-svg-export";

// Re-export for backward compatibility with tests
export { GRID_CELL_HEIGHT, GRID_MARGIN };

// Generate a unique key for a strip based on its configuration
// Accounts for horizontal and vertical flips - strips are the same if:
// 1. Same length
// 2. Same notch positions (measured from edge)
// 3. Same notch orientations (after accounting for possible flips)
export function getStripConfigKey(strip: DesignStrip): string {
	const length = strip.lengthMM;

	// Generate all 4 possible orientations of the strip
	const orientations = [
		// Original
		strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "T" : "B"}`),
		// Horizontal flip: distances measured from other end
		strip.notches.map(
			(n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "T" : "B"}`,
		),
		// Vertical flip: top becomes bottom
		strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "B" : "T"}`),
		// Both flips
		strip.notches.map(
			(n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "B" : "T"}`,
		),
	];

	// Sort notches within each orientation and join
	const orientationKeys = orientations.map((notches) =>
		notches.sort().join("|"),
	);

	// Use the lexicographically smallest representation as canonical form
	const canonicalNotchesKey = orientationKeys.sort()[0];

	return `${length.toFixed(2)}_${canonicalNotchesKey}`;
}

export interface LayoutEditorProps {
	designStrips: DesignStrip[];
	activeGroup: Group | undefined;
	groups: Map<string, Group>;
	activeGroupId: string;
	setActiveGroupId: React.Dispatch<React.SetStateAction<string>>;
	addNewGroup: () => void;
	deleteGroup: (id: string) => void;
	renameGroup: (id: string, newName: string) => void;
	selectedPieceId: string | null;
	setSelectedPieceId: React.Dispatch<React.SetStateAction<string | null>>;
	onLayoutClick: (point: Point, rowIndex: number) => void;
	// stockLength: physical board/stock length used as maximum in layout
	stockLength: number;
	bitSize: number;
	halfCutDepth: number;
	// Full cut depth is not currently used in the layout view but kept for API compatibility
	cutDepth: number;
	onDownload: () => void;
	onDownloadAllGroups: () => void;
	onDeleteLayoutItem: (type: "piece", id: string) => void;
	onHoverStrip?: (id: string | null) => void;
	displayUnit: "mm" | "in";
}

export function computeKerfedLayoutRows(
	pieces: Piece[],
	designStrips: DesignStrip[],
	bitSize: number,
): Map<number, Piece[]> {
	const rows = new Map<number, Piece[]>();
	for (const piece of pieces) {
		const rowIndex = piece.rowIndex;
		if (!rows.has(rowIndex)) {
			rows.set(rowIndex, []);
		}
		const rowPiecesForIndex = rows.get(rowIndex);
		if (rowPiecesForIndex) {
			rowPiecesForIndex.push(piece);
		}
	}

	// Sort pieces in each row by x position to establish order
	for (const rowPieces of rows.values()) {
		rowPieces.sort((a, b) => a.x - b.x);
	}

	// Create new pieces with adjusted x positions for kerf
	const adjustedRows = new Map<number, Piece[]>();
	for (const [rowIndex, rowPieces] of rows) {
		const adjustedPieces: Piece[] = [];
		let currentX = 0;
		for (const piece of rowPieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (strip) {
				adjustedPieces.push({ ...piece, x: currentX });
				currentX += strip.lengthMM + bitSize;
			}
		}
		adjustedRows.set(rowIndex, adjustedPieces);
	}

	return adjustedRows;
}

export function computeRowLengths(
	layoutData: Map<number, Piece[]>,
	designStrips: DesignStrip[],
): Map<number, number> {
	const lengths = new Map<number, number>();
	for (const [rowIndex, rowPieces] of layoutData) {
		let rowLength = 0;
		if (rowPieces.length > 0) {
			const lastPiece = rowPieces[rowPieces.length - 1];
			const strip = designStrips.find((s) => s.id === lastPiece.lineId);
			if (strip) {
				// The length is the x of the last piece + its length.
				// The space after is not part of the length.
				rowLength = lastPiece.x + strip.lengthMM;
			}
		}
		lengths.set(rowIndex, rowLength);
	}
	return lengths;
}

export function validateStripPlacement(
	stripLength: number,
	startPosition: number,
	stockLength: number,
	stripWidth: number,
): boolean {
	const stripEnd = startPosition + stripLength;
	const allowedOverhang = stripWidth / 2;
	return stripEnd <= stockLength + allowedOverhang;
}

export const LayoutEditor = memo(function LayoutEditor({
	designStrips,
	activeGroup,
	groups,
	activeGroupId,
	setActiveGroupId,
	addNewGroup,
	deleteGroup,
	renameGroup,
	selectedPieceId,
	setSelectedPieceId,
	onLayoutClick,
	stockLength,
	bitSize,
	halfCutDepth,
	onDownload,
	onDownloadAllGroups,
	onDeleteLayoutItem,
	displayUnit,
}: LayoutEditorProps) {
	const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
	const [activeLayoutPieceId, setActiveLayoutPieceId] = useState<string | null>(
		null,
	);

	// Clear active piece when group changes or when starting to place a new strip
	useEffect(() => {
		setActiveLayoutPieceId(null);
	}, []);

	const [hoverPoint, setHoverPoint] = useState<{
		point: Point;
		rowIndex: number;
	} | null>(null);
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState("");

	const safeActiveGroup: Group | undefined = activeGroup;

	const pieces: Piece[] = safeActiveGroup
		? Array.from(safeActiveGroup.pieces.values())
		: [];

	// All pieces across all groups (used for global placed strip counts)
	const allPieces: Piece[] = useMemo(
		() =>
			Array.from(groups.values()).flatMap((group) =>
				Array.from(group.pieces.values()),
			),
		[groups],
	);

	// Group strips by unique configuration using the helper
	const uniqueStrips = useMemo(
		() => computeUniqueStrips(designStrips, allPieces),
		[designStrips, allPieces],
	);

	// Calculate rows and their strips with kerf adjustment
	const layoutData = useMemo(
		() => computeKerfedLayoutRows(pieces, designStrips, bitSize),
		[pieces, designStrips, bitSize],
	);

	// Calculate total length of strips in layout
	const totalStripLength = useMemo(() => {
		let total = 0;
		for (const piece of pieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (strip) {
				total += strip.lengthMM;
			}
		}
		return total;
	}, [pieces, designStrips]);

	// Calculate the length of each row
	const rowLengths = useMemo(
		() => computeRowLengths(layoutData, designStrips),
		[layoutData, designStrips],
	);

	// Calculate dynamic number of rows: max row index + 2 (one for 0-based index, one for empty row)
	const dynamicLayoutRows = useMemo(() => {
		const minRows = 5;
		if (layoutData.size === 0) return minRows; // At least minRows empty rows
		const maxRow = Math.max(...layoutData.keys());
		return Math.max(minRows, maxRow + 2); // Ensure one empty row after the last occupied one, but at least minRows
	}, [layoutData]);

	const { minX, minY, viewBoxWidth, viewBoxHeight } = useMemo(() => {
		const numRows = dynamicLayoutRows;
		const minXCalc = -GRID_MARGIN;
		const minYCalc = -GRID_MARGIN;
		// Use stockLength to size the layout viewport horizontally
		const maxXCalc = stockLength + GRID_MARGIN + 40;
		const maxYCalc = numRows * GRID_CELL_HEIGHT + GRID_MARGIN;

		return {
			minX: minXCalc,
			minY: minYCalc,
			viewBoxWidth: maxXCalc - minXCalc,
			viewBoxHeight: maxYCalc - minYCalc,
		};
	}, [dynamicLayoutRows, stockLength]);

	const svgPreview = useMemo(() => {
		return generateGroupSVG({
			group: safeActiveGroup,
			designStrips,
			bitSize,
			stockLength,
		});
	}, [safeActiveGroup, designStrips, bitSize, stockLength]);

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

	const handleClearLayout = () => {
		// Delete all pieces in the current group
		for (const piece of pieces) {
			onDeleteLayoutItem("piece", piece.id);
		}
	};

	if (!safeActiveGroup) {
		// Hooks above still run unconditionally; this is only a render guard.
		return (
			<div className="flex-1 p-4 flex items-center justify-center text-gray-400">
				No active group. Create or select a group to start layout.
			</div>
		);
	}

	return (
		<div className="flex-1 p-4 overflow-auto flex flex-col space-y-4">
			{/* Top toolbar */}
			<div className="flex items-center justify-between gap-4">
				{/* Group selector */}
				<div className="flex items-center space-x-2">
					<span className="text-xs text-gray-400 uppercase">Group</span>
					{isRenaming ? (
						<>
							<input
								type="text"
								className="bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1 w-32"
								value={renameValue}
								onChange={(e) => setRenameValue(e.target.value)}
								// biome-ignore lint: autoFocus is fine here
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										if (renameValue.trim()) {
											renameGroup(activeGroupId, renameValue.trim());
										}
										setIsRenaming(false);
									} else if (e.key === "Escape") {
										setIsRenaming(false);
									}
								}}
							/>
							<button
								type="button"
								onClick={() => {
									if (renameValue.trim()) {
										renameGroup(activeGroupId, renameValue.trim());
									}
									setIsRenaming(false);
								}}
								className="inline-flex items-center px-2 py-1 bg-green-600 hover:bg-green-500 text-xs rounded text-white"
							>
								Save
							</button>
							<button
								type="button"
								onClick={() => setIsRenaming(false)}
								className="inline-flex items-center px-2 py-1 bg-gray-600 hover:bg-gray-500 text-xs rounded text-white"
							>
								Cancel
							</button>
						</>
					) : (
						<>
							<select
								className="bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1"
								value={activeGroupId}
								onChange={(e) => setActiveGroupId(e.target.value)}
							>
								{Array.from(groups.values()).map((g) => (
									<option key={g.id} value={g.id}>
										{g.name}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={addNewGroup}
								className="inline-flex items-center px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs rounded text-white"
							>
								<Plus className="w-3 h-3 mr-1" />
								Add
							</button>
							<button
								type="button"
								onClick={() => deleteGroup(activeGroupId)}
								className="inline-flex items-center px-2 py-1 bg-red-600 hover:bg-red-500 text-xs rounded text-white"
							>
								<Trash2 className="w-3 h-3 mr-1" />
								Delete
							</button>
							<button
								type="button"
								onClick={() => {
									const currentName = safeActiveGroup?.name ?? "";
									setRenameValue(currentName);
									setIsRenaming(true);
								}}
								className="inline-flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-500 text-xs rounded text-white"
							>
								<Pencil className="w-3 h-3 mr-1" />
								Rename
							</button>
							<button
								type="button"
								onClick={handleClearLayout}
								className="inline-flex items-center px-2 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white"
								disabled={pieces.length === 0}
							>
								<Eraser className="w-3 h-3 mr-1" />
								Clear Layout
							</button>
						</>
					)}
				</div>

				{/* Layout info */}
				<div className="flex items-center">
					<div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800 rounded">
						<span className="text-xs font-semibold text-emerald-400">
							Total Length: {formatValue(totalStripLength, displayUnit)}{" "}
							{displayUnit}
						</span>
					</div>
				</div>

				{/* Export */}
				<div className="flex items-center space-x-2">
					<button
						type="button"
						onClick={() => {
							console.log("Export Group SVG clicked");
							onDownload();
						}}
						className="inline-flex items-center px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white"
					>
						<Download className="w-3 h-3 mr-1" />
						Export Group SVG
					</button>
					<button
						type="button"
						onClick={onDownloadAllGroups}
						className="inline-flex items-center px-3 py-1.5 text-xs rounded bg-indigo-700 hover:bg-indigo-600 text-white"
					>
						<Download className="w-3 h-3 mr-1" />
						Export All Groups SVG
					</button>
				</div>
			</div>

			{/* Strip bank + canvas */}
			<div className="flex flex-1 overflow-hidden gap-4">
				{/* Left strip bank */}
				<StripBank
					uniqueStrips={uniqueStrips}
					selectedPieceId={selectedPieceId}
					setSelectedPieceId={setSelectedPieceId}
					pieces={pieces}
					bitSize={bitSize}
					displayUnit={displayUnit}
				/>

				{/* Layout canvas */}
				<div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-gray-900 border border-gray-800 rounded">
					<svg
						data-testid="layout-canvas"
						ref={setSvgElement}
						viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
						className="w-full h-full"
						onMouseDown={handleClick}
						onClick={() => !selectedPieceId && setActiveLayoutPieceId(null)}
						onKeyDown={(e) =>
							e.key === "Escape" && setActiveLayoutPieceId(null)
						}
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
								const topNotches = strip.notches.filter(
									(n) => n.fromTop,
								).length;
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
											const rectY = isTopNotch
												? piece.y
												: piece.y + h - topHeight;
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
												onDeleteLayoutItem("piece", piece.id);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.stopPropagation();
													onDeleteLayoutItem("piece", piece.id);
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
			</div>

			{/* SVG Preview */}
			<div className="h-48 bg-gray-900 border-t border-gray-800 p-4 flex flex-col shrink-0">
				<h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
					Export Preview
				</h3>
				<div className="flex-1 bg-white rounded overflow-hidden flex items-center justify-center">
					{svgPreview ? (
						<div
							className="w-full h-full p-4 flex items-center justify-center overflow-auto"
							// biome-ignore lint: SVG preview is safe
							dangerouslySetInnerHTML={{ __html: svgPreview }}
						/>
					) : (
						<span className="text-gray-400 text-sm">No content to preview</span>
					)}
				</div>
			</div>
		</div>
	);
});
