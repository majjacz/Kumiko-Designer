import {
	Download,
	Plus,
	Trash2,
	Eraser,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import {
	formatValue,
	type Cut,
	type DesignStrip,
	type Group,
	type Notch,
	type Piece,
	type Point,
} from "./kumiko-core";

// Grid configuration for layout
const GRID_CELL_HEIGHT = 20; // Height of each row in mm
const GRID_MARGIN = 10; // Margin around the grid in mm

export interface LayoutEditorProps {
	designStrips: DesignStrip[];
	activeGroup: Group | undefined;
	groups: Map<string, Group>;
	activeGroupId: string;
	setActiveGroupId: React.Dispatch<React.SetStateAction<string>>;
	addNewGroup: () => void;
	deleteGroup: (id: string) => void;
	selectedPieceId: string | null;
	setSelectedPieceId: React.Dispatch<React.SetStateAction<string | null>>;
	onLayoutClick: (point: Point, rowIndex: number) => void;
	// stockLength: physical board/stock length used as maximum in layout
	stockLength: number;
	bitSize: number;
	halfCutDepth: number;
	cutDepth: number;
	onDownload: () => void;
	onDownloadAllGroups: () => void;
	onDeleteLayoutItem: (type: "piece", id: string) => void;
	onHoverStrip?: (id: string | null) => void;
	layoutRows: number;
	displayUnit: "mm" | "in";
}

export function LayoutEditor({
	designStrips,
	activeGroup,
	groups,
	activeGroupId,
	setActiveGroupId,
	addNewGroup,
	deleteGroup,
	selectedPieceId,
	setSelectedPieceId,
	onLayoutClick,
	stockLength,
	bitSize,
	halfCutDepth,
	cutDepth,
	onDownload,
	onDownloadAllGroups,
	onDeleteLayoutItem,
	onHoverStrip,
	layoutRows,
	displayUnit,
}: LayoutEditorProps) {
	const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
	const [hoverPoint, setHoverPoint] = useState<{ point: Point; rowIndex: number } | null>(null);

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

	// Generate a unique key for a strip based on its configuration
	// Accounts for horizontal and vertical flips - strips are the same if:
	// 1. Same length
	// 2. Same notch positions (measured from edge)
	// 3. Same notch orientations (after accounting for possible flips)
	const getStripConfigKey = (strip: DesignStrip): string => {
		const length = strip.lengthMM;
		
		// Generate all 4 possible orientations of the strip
		const orientations = [
			// Original
			strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "T" : "B"}`),
			// Horizontal flip: distances measured from other end
			strip.notches.map((n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "T" : "B"}`),
			// Vertical flip: top becomes bottom
			strip.notches.map((n) => `${n.dist.toFixed(2)}-${n.fromTop ? "B" : "T"}`),
			// Both flips
			strip.notches.map((n) => `${(length - n.dist).toFixed(2)}-${n.fromTop ? "B" : "T"}`),
		];
		
		// Sort notches within each orientation and join
		const orientationKeys = orientations.map(notches => notches.sort().join("|"));
		
		// Use the lexicographically smallest representation as canonical form
		const canonicalNotchesKey = orientationKeys.sort()[0];
		
		return `${length.toFixed(2)}_${canonicalNotchesKey}`;
	};

	// Group strips by unique configuration
	const uniqueStrips = useMemo(() => {
		const stripsByConfig = new Map<string, {
			config: DesignStrip;
			stripIds: string[];
			neededCount: number;
			placedCount: number;
		}>();

		// Group design strips by configuration
		for (const strip of designStrips) {
			const key = getStripConfigKey(strip);
			if (!stripsByConfig.has(key)) {
				stripsByConfig.set(key, {
					config: strip,
					stripIds: [strip.id],
					neededCount: 1,
					placedCount: 0,
				});
			} else {
				const entry = stripsByConfig.get(key)!;
				entry.stripIds.push(strip.id);
				entry.neededCount += 1;
			}
		}

		// Calculate placed count for each unique configuration across all groups
		for (const piece of allPieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (strip) {
				const key = getStripConfigKey(strip);
				const entry = stripsByConfig.get(key);
				if (entry) {
					entry.placedCount += 1;
				}
			}
		}

		return Array.from(stripsByConfig.values());
	}, [designStrips, allPieces]);

	// Calculate rows and their strips with kerf adjustment
	const layoutData = useMemo(() => {
		const rows = new Map<number, Piece[]>();
		for (const piece of pieces) {
			const rowIndex = piece.rotation; // Using rotation field to store row index
			if (!rows.has(rowIndex)) {
				rows.set(rowIndex, []);
			}
			rows.get(rowIndex)!.push(piece);
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
	}, [pieces, designStrips, bitSize]);

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
	const rowLengths = useMemo(() => {
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
	}, [layoutData, designStrips]);

	const { minX, minY, viewBoxWidth, viewBoxHeight } = useMemo(() => {
		const numRows = layoutRows;
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
	}, [layoutRows, stockLength]);

	const getLayoutPoint = (e: React.MouseEvent<SVGSVGElement>): { point: Point; rowIndex: number } | null => {
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
		const gridEndY = layoutRows * GRID_CELL_HEIGHT;
		
		// Only process if mouse is within the grid rectangle
		if (svgX < gridStartX || svgX > gridEndX || svgY < gridStartY || svgY > gridEndY) {
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
		if (window.confirm("Clear all strips from this layout? This cannot be undone.")) {
			// Delete all pieces in the current group
			for (const piece of pieces) {
				onDeleteLayoutItem("piece", piece.id);
			}
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
		<div className="flex-1 p-4 overflow-hidden flex flex-col space-y-4">
			{/* Top toolbar */}
			<div className="flex items-center justify-between gap-4">
				{/* Group selector */}
				<div className="flex items-center space-x-2">
					<span className="text-xs text-gray-400 uppercase">Group</span>
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
						onClick={handleClearLayout}
						className="inline-flex items-center px-2 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white"
						disabled={pieces.length === 0}
					>
						<Eraser className="w-3 h-3 mr-1" />
						Clear Layout
					</button>
				</div>

				{/* Layout info */}
				<div className="flex items-center">
					<div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800 rounded">
						<span className="text-xs font-semibold text-emerald-400">
							Total Length: {formatValue(totalStripLength, displayUnit)} {displayUnit}
						</span>
					</div>
				</div>

				{/* Export */}
				<div className="flex items-center space-x-2">
					<button
						type="button"
						onClick={onDownload}
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
				<div className="w-56 bg-gray-900 border border-gray-800 rounded p-2 space-y-2 overflow-y-auto">
					<div className="text-xs font-semibold text-gray-400 uppercase">
						Available Strips
					</div>
					<div className="text-[10px] text-gray-500 mb-2">
						Select a strip, then click on a row to place it continuously.
					</div>
					{uniqueStrips.length === 0 && (
						<div className="text-xs text-gray-500">
							Define lines in the design step to create strips.
						</div>
					)}
					{uniqueStrips.map((uniqueStrip, index) => {
						const strip = uniqueStrip.config;
						// Check if any of the strip IDs in this unique config is selected
						const isSelected = uniqueStrip.stripIds.includes(selectedPieceId || "");
						const allPlaced = uniqueStrip.placedCount >= uniqueStrip.neededCount;

						// Determine predominant notch orientation for preview flipping
						const topNotches = strip.notches.filter((n) => n.fromTop).length;
						const bottomNotches = strip.notches.length - topNotches;
						const shouldFlip = bottomNotches > topNotches;

						// Show only the last 4 characters of the strip ID in the UI
						const displayId =
							strip.id.length > 4 ? strip.id.slice(-4) : strip.id;
						
						return (
							<button
								key={`unique-${index}`}
								type="button"
								onMouseEnter={() => onHoverStrip?.(strip.id)}
								onMouseLeave={() => onHoverStrip?.(null)}
								onClick={() => {
									// Select the first available strip ID that hasn't been placed yet
									if (isSelected) {
										setSelectedPieceId(null);
									} else {
										// Find the first strip ID that still needs to be placed
										const availableStripId = uniqueStrip.stripIds.find(id => {
											const usedCount = pieces.filter(p => p.lineId === id).length;
											return usedCount === 0;
										}) || uniqueStrip.stripIds[0];
										setSelectedPieceId(availableStripId);
									}
								}}
								className={`w-full text-left px-2 py-1 rounded text-xs ${
									isSelected
										? "bg-blue-600 text-white"
										: allPlaced
										? "bg-gray-800 text-gray-500"
										: "bg-gray-800 text-gray-200 hover:bg-gray-700"
								}`}
							>
								<div className="flex flex-col space-y-1">
									<div className="flex items-center justify-between">
										<span
											className="text-[10px] font-semibold truncate"
											title={strip.id}
										>
											ID: {displayId}
										</span>
										<span className="text-[10px] text-gray-400">
											{formatValue(strip.lengthMM, displayUnit)} {displayUnit} · {strip.notches.length} notches
										</span>
									</div>
									<div className="w-full h-6 bg-gray-950/40 rounded border border-gray-800 flex items-center justify-center">
										<svg
											viewBox={`0 0 ${strip.lengthMM} 10`}
											className="w-full h-full"
										>
											<rect
												x={0}
												y={2}
												width={strip.lengthMM}
												height={6}
												fill="#1E293B"
												stroke="#4B5563"
												strokeWidth={0.5}
												rx={1}
												ry={1}
											/>
											{strip.notches.map((notch) => {
												const isTopNotch = shouldFlip ? !notch.fromTop : notch.fromTop;
												const previewHeight = 10;
												const notchHeight = 4;
												const x = notch.dist - bitSize / 2;
												const y = isTopNotch ? 0 : previewHeight - notchHeight;
												return (
													<rect
														key={notch.id}
														x={x}
														y={y}
														width={bitSize}
														height={notchHeight}
														fill="#7C3AED"
														stroke="#FBBF24"
														strokeWidth={0.4}
													/>
												);
											})}
										</svg>
									</div>
									<div
										className={`text-[10px] font-semibold ${
											allPlaced ? "text-green-400" : "text-amber-400"
										}`}
									>
										Placed: {uniqueStrip.placedCount} / {uniqueStrip.neededCount}
									</div>
								</div>
							</button>
						);
					})}
				</div>

				{/* Layout canvas */}
				<div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-gray-900 border border-gray-800 rounded">
					<svg
						ref={setSvgElement}
						viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
						className="w-full h-full"
						onClick={handleClick}
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
						{Array.from({ length: layoutRows }).map((_, i) => {
							const y = i * GRID_CELL_HEIGHT;
							const rowLength = rowLengths.get(i) || 0;
							const isOverLength = rowLength > stockLength;
							
							return (
								<g key={`row-${i}`}>
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
										{i}
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
							y2={layoutRows * GRID_CELL_HEIGHT}
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

								return (
									<g
										key={piece.id}
										className="cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											if (
												window.confirm("Delete this piece from the layout?")
											) {
												onDeleteLayoutItem("piece", piece.id);
											}
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
										{/* Strip label */}
										<text
											x={piece.x + w / 2}
											y={piece.y + h / 2}
											fontSize="7"
											fill="#BFDBFE"
											textAnchor="middle"
											dominantBaseline="middle"
											pointerEvents="none"
										>
											{strip.id.slice(-4)}
										</text>
										<title>
											Strip {strip.id.slice(-4)} -{" "}
											{formatValue(strip.lengthMM, displayUnit)}
											{displayUnit} Row {piece.rotation}
										</title>
									</g>
								);
							})}

						{/* Hover preview */}
						{hoverPoint && selectedPieceId && (() => {
							const previewStrip = designStrips.find((s) => s.id === selectedPieceId);
							if (!previewStrip) return null;

							const w = previewStrip.lengthMM;
							const h = GRID_CELL_HEIGHT;

							const topNotches = previewStrip.notches.filter((n) => n.fromTop).length;
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
										const isTopNotch = shouldFlip ? !notch.fromTop : notch.fromTop;
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
		</div>
	);
}
