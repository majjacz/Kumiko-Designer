import {
	Download,
	MousePointer,
	Plus,
	RotateCw,
	Scissors,
	Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Cut, DesignStrip, Group, Piece, Point } from "./kumiko-core";

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
	layoutTool: "place" | "cut";
	setLayoutTool: React.Dispatch<React.SetStateAction<"place" | "cut">>;
	nextRotation: number;
	setNextRotation: React.Dispatch<React.SetStateAction<number>>;
	onLayoutClick: (point: Point) => void;
	layoutCutStart: Point | null;
	stripLength: number;
	bitSize: number;
	halfCutDepth: number;
	cutDepth: number;
	onDownload: () => void;
	onDeleteLayoutItem: (type: "piece" | "cut", id: string) => void;
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
	layoutTool,
	setLayoutTool,
	nextRotation,
	setNextRotation,
	onLayoutClick,
	layoutCutStart,
	stripLength,
	bitSize,
	halfCutDepth,
	cutDepth,
	onDownload,
	onDeleteLayoutItem,
}: LayoutEditorProps) {
	const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);

	const safeActiveGroup: Group | undefined = activeGroup;

	const pieces: Piece[] = safeActiveGroup
		? Array.from(safeActiveGroup.pieces.values())
		: [];
	const cuts: Cut[] = safeActiveGroup
		? Array.from(safeActiveGroup.fullCuts.values())
		: [];

	const { minX, minY, viewBoxWidth, viewBoxHeight } = useMemo(() => {
		let minXCalc = 0;
		let minYCalc = 0;
		let maxXCalc = stripLength;
		let maxYCalc = stripLength;

		if (pieces.length > 0 || cuts.length > 0) {
			const allPoints: number[] = [
				...pieces.flatMap((p) => {
					const strip = designStrips.find((s) => s.id === p.lineId);
					const w = strip ? strip.lengthMM : 0;
					const h = bitSize;
					return [p.x, p.y, p.x + w, p.y + h];
				}),
				...cuts.flatMap((c) => [c.x1, c.y1, c.x2, c.y2]),
			];

			minXCalc = Math.min(0, ...allPoints) - 50;
			minYCalc = Math.min(0, ...allPoints) - 50;
			maxXCalc = Math.max(stripLength, ...allPoints) + 50;
			maxYCalc = Math.max(stripLength, ...allPoints) + 50;
		}

		return {
			minX: minXCalc,
			minY: minYCalc,
			viewBoxWidth: maxXCalc - minXCalc,
			viewBoxHeight: maxYCalc - minYCalc,
		};
	}, [pieces, cuts, designStrips, stripLength, bitSize]);

	const getLayoutPoint = (e: React.MouseEvent<SVGSVGElement>): Point | null => {
		if (!svgElement) return null;
		const rect = svgElement.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) / rect.width) * viewBoxWidth + minX;
		const svgY = ((e.clientY - rect.top) / rect.height) * viewBoxHeight + minY;
		return { x: svgX, y: svgY };
	};

	const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
		const point = getLayoutPoint(e);
		if (!point) return;
		onLayoutClick(point);
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
				</div>

				{/* Layout tools */}
				<div className="flex items-center space-x-2">
					<button
						type="button"
						onClick={() => setLayoutTool("place")}
						className={`inline-flex items-center px-2 py-1 text-xs rounded ${
							layoutTool === "place"
								? "bg-blue-600 text-white"
								: "bg-gray-800 text-gray-300"
						}`}
					>
						<MousePointer className="w-3 h-3 mr-1" />
						Place
					</button>
					<button
						type="button"
						onClick={() => setLayoutTool("cut")}
						className={`inline-flex items-center px-2 py-1 text-xs rounded ${
							layoutTool === "cut"
								? "bg-blue-600 text-white"
								: "bg-gray-800 text-gray-300"
						}`}
					>
						<Scissors className="w-3 h-3 mr-1" />
						Cut
					</button>
					<button
						type="button"
						onClick={() => setNextRotation((r) => (r + 90) % 360)}
						className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
					>
						<RotateCw className="w-3 h-3 mr-1" />
						{nextRotation}°
					</button>
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
				</div>
			</div>

			{/* Strip bank + canvas */}
			<div className="flex flex-1 overflow-hidden gap-4">
				{/* Left strip bank */}
				<div className="w-48 bg-gray-900 border border-gray-800 rounded p-2 space-y-2 overflow-y-auto">
					<div className="text-xs font-semibold text-gray-400 uppercase">
						Strips
					</div>
					{designStrips.length === 0 && (
						<div className="text-xs text-gray-500">
							Define lines in the design step to create strips.
						</div>
					)}
					{designStrips.map((strip) => {
						const isSelected = selectedPieceId === strip.id;
						return (
							<button
								key={strip.id}
								type="button"
								onClick={() => setSelectedPieceId(isSelected ? null : strip.id)}
								className={`w-full text-left px-2 py-1 rounded text-xs ${
									isSelected
										? "bg-blue-600 text-white"
										: "bg-gray-800 text-gray-200 hover:bg-gray-700"
								}`}
							>
								<div className="font-semibold truncate">
									Strip {strip.id.slice(-4)}
								</div>
								<div className="text-[10px] text-gray-400">
									Length: {strip.lengthMM.toFixed(1)} mm · Notches:{" "}
									{strip.notches.length}
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

						{/* Pieces */}
						{pieces.map((piece) => {
							const strip = designStrips.find((s) => s.id === piece.lineId);
							if (!strip) return null;

							const w = strip.lengthMM;
							const h = bitSize;
							const transform = `translate(${piece.x}, ${piece.y}) rotate(${piece.rotation}, 0, ${
								h / 2
							})`;

							return (
								<g
									key={piece.id}
									transform={transform}
									className="cursor-pointer"
									onClick={(e) => {
										e.stopPropagation();
										if (window.confirm("Delete this piece from the layout?")) {
											onDeleteLayoutItem("piece", piece.id);
										}
									}}
								>
									{/* Strip body */}
									<rect
										x={0}
										y={0}
										width={w}
										height={h}
										fill="#111827"
										stroke="#60A5FA"
										strokeWidth={0.6}
										rx={1}
										ry={1}
									/>
									{/* Notches */}
									{strip.notches.map((notch) => {
										const center = notch.dist;
										const left = center - bitSize / 2;
										const topHeight = halfCutDepth;
										const rectY = notch.fromTop ? 0 : h - topHeight;
										return (
											<rect
												key={notch.id}
												x={left}
												y={rectY}
												width={bitSize}
												height={topHeight}
												fill="#1F2937"
												stroke="#FBBF24"
												strokeWidth={0.4}
											/>
										);
									})}
									<title>
										Piece {strip.id.slice(-4)} at ({piece.x.toFixed(1)},{" "}
										{piece.y.toFixed(1)})°
									</title>
								</g>
							);
						})}

						{/* Cuts */}
						{cuts.map((cut) => (
							<line
								key={cut.id}
								x1={cut.x1}
								y1={cut.y1}
								x2={cut.x2}
								y2={cut.y2}
								stroke="#EF4444"
								strokeWidth={bitSize / 4}
								strokeDasharray="4 4"
								className="cursor-pointer"
								onClick={(e) => {
									e.stopPropagation();
									if (window.confirm("Delete this cut from the layout?")) {
										onDeleteLayoutItem("cut", cut.id);
									}
								}}
							/>
						))}

						{/* Cut drawing start indicator */}
						{layoutCutStart && (
							<circle
								cx={layoutCutStart.x}
								cy={layoutCutStart.y}
								r={bitSize / 3}
								fill="#22C55E"
							/>
						)}
					</svg>
				</div>
			</div>
		</div>
	);
}
