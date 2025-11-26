import type React from "react";
import {
	type DesignStrip,
	formatValue,
	getStripConfigKey,
	type Piece,
} from "../../lib/kumiko";

export interface UniqueStripConfig {
	config: DesignStrip;
	stripIds: string[];
	neededCount: number;
	placedCount: number;
}

export interface StripBankProps {
	uniqueStrips: UniqueStripConfig[];
	selectedPieceId: string | null;
	setSelectedPieceId: React.Dispatch<React.SetStateAction<string | null>>;
	pieces: Piece[];
	bitSize: number;
	displayUnit: "mm" | "in";
	onHoverStrip?: (id: string | null) => void;
}

/**
 * StripBank displays available strips that can be placed on the layout.
 * It groups strips by their unique configuration and shows placement counts.
 */
export function StripBank({
	uniqueStrips,
	selectedPieceId,
	setSelectedPieceId,
	pieces,
	bitSize,
	displayUnit,
}: StripBankProps) {
	return (
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
			{uniqueStrips.map((uniqueStrip) => {
				const strip = uniqueStrip.config;
				// Check if any of the strip IDs in this unique config is selected
				const isSelected = uniqueStrip.stripIds.includes(selectedPieceId || "");
				const allPlaced = uniqueStrip.placedCount >= uniqueStrip.neededCount;

				// Determine predominant notch orientation for preview flipping
				const topNotches = strip.notches.filter((n) => n.fromTop).length;
				const bottomNotches = strip.notches.length - topNotches;
				const shouldFlip = bottomNotches > topNotches;

				// Show only the last 4 characters of the strip ID in the UI
				const displayId = strip.displayCode;

				return (
					<button
						key={strip.id}
						type="button"
						data-testid="strip-bank-item"
						onClick={() => {
							// Select the first available strip ID that hasn't been placed yet
							if (isSelected) {
								setSelectedPieceId(null);
							} else {
								// Find the first strip ID that still needs to be placed
								const availableStripId =
									uniqueStrip.stripIds.find((id) => {
										const usedCount = pieces.filter(
											(p) => p.lineId === id,
										).length;
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
									{formatValue(strip.lengthMM, displayUnit)} {displayUnit} ·{" "}
									{strip.notches.length} notches
								</span>
							</div>
							<div className="w-full h-6 bg-gray-950/40 rounded border border-gray-800 flex items-center justify-center">
								<svg
									viewBox={`0 0 ${strip.lengthMM} 10`}
									className="w-full h-full"
								>
									<title>Strip {displayId} preview</title>
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
										const isTopNotch = shouldFlip
											? !notch.fromTop
											: notch.fromTop;
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
	);
}

/**
 * Calculate unique strips grouped by configuration.
 * This helper is useful to compute the uniqueStrips prop for StripBank.
 */
export function computeUniqueStrips(
	designStrips: DesignStrip[],
	allPieces: Piece[],
): UniqueStripConfig[] {
	const stripsByConfig = new Map<string, UniqueStripConfig>();

	// Group design strips by configuration
	for (const strip of designStrips) {
		const key = getStripConfigKey(strip);
		const existing = stripsByConfig.get(key);
		if (!existing) {
			stripsByConfig.set(key, {
				config: strip,
				stripIds: [strip.id],
				neededCount: 1,
				placedCount: 0,
			});
		} else {
			existing.stripIds.push(strip.id);
			existing.neededCount += 1;
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
}
