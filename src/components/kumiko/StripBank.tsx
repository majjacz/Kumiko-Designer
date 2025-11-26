import { CheckCircle2, Circle } from "lucide-react";
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
	// Calculate overall progress
	const totalNeeded = uniqueStrips.reduce((sum, s) => sum + s.neededCount, 0);
	const totalPlaced = uniqueStrips.reduce((sum, s) => sum + s.placedCount, 0);
	const progressPercent =
		totalNeeded > 0 ? Math.round((totalPlaced / totalNeeded) * 100) : 0;

	return (
		<div className="w-64 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
			{/* Header */}
			<div className="px-4 py-3 border-b border-gray-800">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-sm font-semibold text-gray-200">
						Available Strips
					</h3>
					<span className="text-xs text-gray-500">
						{uniqueStrips.length} types
					</span>
				</div>

				{/* Overall progress bar */}
				{totalNeeded > 0 && (
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs">
							<span className="text-gray-400">Placement progress</span>
							<span
								className={
									progressPercent === 100
										? "text-emerald-400 font-medium"
										: "text-gray-400"
								}
							>
								{progressPercent}%
							</span>
						</div>
						<div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
							<div
								className={`h-full transition-all duration-300 rounded-full ${
									progressPercent === 100 ? "bg-emerald-500" : "bg-indigo-500"
								}`}
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Instructions */}
			<div className="px-4 py-2 bg-gray-800/30 border-b border-gray-800">
				<p className="text-xs text-gray-500">
					Select a strip, then click on a row to place it
				</p>
			</div>

			{/* Strip list */}
			<div className="flex-1 overflow-y-auto p-2 space-y-2">
				{uniqueStrips.length === 0 ? (
					<div className="text-center py-8 px-4">
						<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
							<Circle className="w-6 h-6 text-gray-600" />
						</div>
						<p className="text-sm text-gray-400">No strips yet</p>
						<p className="text-xs text-gray-500 mt-1">
							Draw lines in the Design view to create strips
						</p>
					</div>
				) : (
					uniqueStrips.map((uniqueStrip) => {
						const strip = uniqueStrip.config;
						const isSelected = uniqueStrip.stripIds.includes(
							selectedPieceId || "",
						);
						const allPlaced =
							uniqueStrip.placedCount >= uniqueStrip.neededCount;
						const stripProgress = Math.round(
							(uniqueStrip.placedCount / uniqueStrip.neededCount) * 100,
						);

						const displayId = strip.displayCode;

						return (
							<button
								key={strip.id}
								type="button"
								data-testid="strip-bank-item"
								onClick={() => {
									if (isSelected) {
										setSelectedPieceId(null);
									} else {
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
								className={`
									w-full text-left rounded-lg transition-all duration-200
									${
										isSelected
											? "bg-indigo-600 ring-2 ring-indigo-400 ring-offset-1 ring-offset-gray-900"
											: allPlaced
												? "bg-gray-800/50 opacity-60"
												: "bg-gray-800/80 hover:bg-gray-800"
									}
								`}
							>
								<div className="p-3 space-y-2">
									{/* Strip header */}
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											{allPlaced ? (
												<CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
											) : (
												<Circle
													className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-white" : "text-gray-500"}`}
												/>
											)}
											<span
												className={`text-sm font-mono font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}
												title={strip.id}
											>
												{displayId}
											</span>
										</div>
										<span
											className={`text-xs ${isSelected ? "text-indigo-200" : "text-gray-400"}`}
										>
											{formatValue(strip.lengthMM, displayUnit)} {displayUnit}
										</span>
									</div>

									{/* Strip preview */}
									<div className="h-8 bg-gray-950/60 rounded border border-gray-700/50 flex items-center justify-center p-1">
										<svg
											viewBox={`0 0 ${strip.lengthMM} 10`}
											className="w-full h-full"
											preserveAspectRatio="xMidYMid meet"
										>
											<title>Strip {displayId} preview</title>
											<rect
												x={0}
												y={2}
												width={strip.lengthMM}
												height={6}
												fill={isSelected ? "#4F46E5" : "#1E293B"}
												stroke={isSelected ? "#818CF8" : "#4B5563"}
												strokeWidth={0.5}
												rx={1}
												ry={1}
											/>
											{strip.notches.map((notch) => {
												// Determine if this strip is "bottom only" and should be visually flipped
												const topNotches = strip.notches.filter(
													(n) => n.fromTop,
												).length;
												const bottomNotches = strip.notches.length - topNotches;
												const shouldFlip =
													bottomNotches > 0 && topNotches === 0;

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
														fill={isSelected ? "#A5B4FC" : "#7C3AED"}
														stroke={isSelected ? "#C7D2FE" : "#FBBF24"}
														strokeWidth={0.4}
													/>
												);
											})}
										</svg>
									</div>

									{/* Progress indicator */}
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											<span
												className={`text-xs ${isSelected ? "text-indigo-200" : "text-gray-500"}`}
											>
												{strip.notches.length} notch
												{strip.notches.length !== 1 ? "es" : ""}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full transition-all ${
														allPlaced
															? "bg-emerald-500"
															: isSelected
																? "bg-white"
																: "bg-indigo-500"
													}`}
													style={{ width: `${stripProgress}%` }}
												/>
											</div>
											<span
												className={`text-xs font-medium ${
													allPlaced
														? "text-emerald-400"
														: isSelected
															? "text-white"
															: "text-gray-400"
												}`}
											>
												{uniqueStrip.placedCount}/{uniqueStrip.neededCount}
											</span>
										</div>
									</div>
								</div>
							</button>
						);
					})
				)}
			</div>
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
