import type React from "react";
import { memo, useMemo, useState } from "react";
import { ExportPreview } from "../../components/kumiko/ExportPreview";
import { GroupToolbar } from "../../components/kumiko/GroupToolbar";
import { LayoutCanvas } from "../../components/kumiko/LayoutCanvas";
import {
	computeUniqueStrips,
	StripBank,
} from "../../components/kumiko/StripBank";
import { useKumiko } from "../../context/KumikoContext";
import type { NotificationType } from "../../lib/errors";
import { GRID_CELL_HEIGHT, GRID_MARGIN } from "./config";
import type { DesignStrip, Group, Piece, Point } from "./kumiko-core";
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
	/** Optional callback for showing notifications to the user */
	onNotify?: (type: NotificationType, message: string) => void;
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
	onNotify,
}: LayoutEditorProps) {
	const [_svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);

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

	const svgPreview = useMemo(() => {
		return generateGroupSVG({
			group: safeActiveGroup,
			designStrips,
			bitSize,
			stockLength,
		});
	}, [safeActiveGroup, designStrips, bitSize, stockLength]);

	const handleClearLayout = () => {
		// Delete all pieces in the current group
		for (const piece of pieces) {
			onDeleteLayoutItem("piece", piece.id);
		}
	};

	const handleDeletePiece = (pieceId: string) => {
		onDeleteLayoutItem("piece", pieceId);
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
			<GroupToolbar
				groups={groups}
				activeGroupId={activeGroupId}
				setActiveGroupId={setActiveGroupId}
				addNewGroup={addNewGroup}
				deleteGroup={deleteGroup}
				renameGroup={renameGroup}
				totalStripLength={totalStripLength}
				displayUnit={displayUnit}
				piecesCount={pieces.length}
				onClearLayout={handleClearLayout}
				onDownload={onDownload}
				onDownloadAllGroups={onDownloadAllGroups}
			/>

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
				<LayoutCanvas
					setSvgElement={setSvgElement}
					layoutData={layoutData}
					designStrips={designStrips}
					dynamicLayoutRows={dynamicLayoutRows}
					stockLength={stockLength}
					bitSize={bitSize}
					halfCutDepth={halfCutDepth}
					rowLengths={rowLengths}
					selectedPieceId={selectedPieceId}
					onLayoutClick={onLayoutClick}
					onDeletePiece={handleDeletePiece}
					displayUnit={displayUnit}
					onNotify={onNotify}
				/>
			</div>

			{/* SVG Preview */}
			<ExportPreview svgContent={svgPreview} />
		</div>
	);
});

/**
 * Context-connected version of LayoutEditor.
 * Automatically consumes state from KumikoContext.
 */
export function LayoutEditorConnected() {
	const {
		designState,
		layoutState,
		layoutActions,
		params,
		handleDownloadSVG,
		handleDownloadAllGroupsSVG,
		notify,
	} = useKumiko();

	return (
		<LayoutEditor
			designStrips={designState.designStrips}
			activeGroup={layoutState.activeGroup}
			groups={layoutState.groups}
			activeGroupId={layoutState.activeGroupId}
			setActiveGroupId={layoutActions.setActiveGroupId}
			addNewGroup={layoutActions.addNewGroup}
			deleteGroup={layoutActions.deleteGroup}
			renameGroup={layoutActions.renameGroup}
			selectedPieceId={layoutState.selectedPieceId}
			setSelectedPieceId={layoutActions.setSelectedPieceId}
			onLayoutClick={layoutActions.handleLayoutClick}
			stockLength={params.stockLength}
			bitSize={params.bitSize}
			halfCutDepth={params.halfCutDepth}
			cutDepth={params.cutDepth}
			onDownload={handleDownloadSVG}
			onDownloadAllGroups={handleDownloadAllGroupsSVG}
			onDeleteLayoutItem={layoutActions.deleteLayoutItem}
			onHoverStrip={layoutActions.setHoveredStripId}
			displayUnit={params.units}
			onNotify={notify}
		/>
	);
}
