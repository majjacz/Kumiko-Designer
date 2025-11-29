import type React from "react";
import { memo, useMemo, useState } from "react";
import { useKumiko } from "../../context/KumikoContext";
import type { NotifyCallback } from "../../lib/errors";
import {
	analyzeGroupPasses,
	generateGroupSVG,
} from "../../lib/kumiko/kumiko-svg-export";
import {
	computeKerfedLayoutRows,
	computeRowLengths,
} from "../../lib/kumiko/layout-helpers";
import type { DesignStrip, Group, Piece, Point } from "../../lib/kumiko/types";
import { ExportPreview } from "./ExportPreview";
import { type ExportPassType, GroupToolbar } from "./GroupToolbar";
import { LayoutCanvas } from "./LayoutCanvas";
import { computeUniqueStrips, StripBank } from "./StripBank";

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
	onDownload: (passType?: ExportPassType) => void;
	onDownloadAllGroups: () => void;
	onDeleteLayoutItem: (type: "piece", id: string) => void;
	onHoverStrip?: (id: string | null) => void;
	displayUnit: "mm" | "in";
	/** Optional callback for showing notifications to the user */
	onNotify?: NotifyCallback;
}

const LayoutEditor = memo(function LayoutEditor({
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

	// Calculate total length of strips in current group
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

	// Calculate total length across all groups
	const allGroupsTotalLength = useMemo(() => {
		let total = 0;
		for (const piece of allPieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (strip) {
				total += strip.lengthMM;
			}
		}
		return total;
	}, [allPieces, designStrips]);

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

	const groupPasses = useMemo(() => {
		if (!safeActiveGroup) return { hasTop: false, hasBottom: false };
		return analyzeGroupPasses(safeActiveGroup, designStrips);
	}, [safeActiveGroup, designStrips]);

	const svgPreview = useMemo(() => {
		if (!safeActiveGroup) return null;

		const { hasTop, hasBottom } = groupPasses;

		// Case 1: Mixed (Double-sided) - strips with both top and bottom notches
		// Note: After normalization, this only occurs for truly double-sided strips
		// (i.e., strips that cannot be flipped to single-sided)
		if (hasTop && hasBottom) {
			const top = generateGroupSVG({
				group: safeActiveGroup,
				designStrips,
				bitSize,
				stockLength,
				pass: "top",
			});
			const bottom = generateGroupSVG({
				group: safeActiveGroup,
				designStrips,
				bitSize,
				stockLength,
				pass: "bottom",
			});

			if (top && bottom) {
				return { top, bottom };
			}
			return top || bottom || null;
		}

		// Case 2: Single-sided (all notches on one side after normalization)
		// Bottom-only strips are automatically normalized to top-only at design time,
		// so we just need a standard pass without flipping
		return generateGroupSVG({
			group: safeActiveGroup,
			designStrips,
			bitSize,
			stockLength,
			pass: "all",
		});
	}, [safeActiveGroup, designStrips, bitSize, stockLength, groupPasses]);

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
				allGroupsTotalLength={allGroupsTotalLength}
				displayUnit={displayUnit}
				piecesCount={pieces.length}
				onClearLayout={handleClearLayout}
				onDownload={onDownload}
				onDownloadAllGroups={onDownloadAllGroups}
				needsMultiplePasses={groupPasses.hasTop && groupPasses.hasBottom}
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

			{/* Double-sided warning */}
			{(() => {
				if (!safeActiveGroup) return null;
				const { hasTop, hasBottom } = analyzeGroupPasses(
					safeActiveGroup,
					designStrips,
				);

				if (hasTop && hasBottom) {
					return (
						<div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 flex items-start gap-3 mx-4">
							<div className="p-1 bg-amber-900/50 rounded text-amber-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
									<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
									<line x1="12" y1="22.08" x2="12" y2="12" />
								</svg>
							</div>
							<div className="text-sm text-amber-200">
								<p className="font-medium">Double-sided cuts detected</p>
								<p className="text-amber-200/70 mt-0.5">
									This group contains strips with notches on both sides. Export
									will generate two files: one for the top pass (top notches
									only) and one for the bottom pass (bottom notches + profile
									cuts).
								</p>
							</div>
						</div>
					);
				}

				if (hasBottom && !hasTop) {
					// Auto-flipped, no warning needed as it becomes a standard single pass
					return null;
				}

				return null;
			})()}

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
