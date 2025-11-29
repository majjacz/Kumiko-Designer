import {
	Check,
	ChevronDown,
	Download,
	Eraser,
	MoreHorizontal,
	Pencil,
	Plus,
	Ruler,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { formatValue, type Group } from "../../lib/kumiko";

export type ExportPassType = "both" | "top" | "bottom";

export interface GroupToolbarProps {
	/** All groups available */
	groups: Map<string, Group>;
	/** Currently active group ID */
	activeGroupId: string;
	/** Handler to change active group */
	setActiveGroupId: React.Dispatch<React.SetStateAction<string>>;
	/** Handler to add new group */
	addNewGroup: () => void;
	/** Handler to delete a group */
	deleteGroup: (id: string) => void;
	/** Handler to rename a group */
	renameGroup: (id: string, newName: string) => void;
	/** Total length of strips in current group (mm) */
	totalStripLength: number;
	/** Total length of strips across all groups (mm) */
	allGroupsTotalLength: number;
	/** Display unit for formatting */
	displayUnit: "mm" | "in";
	/** Number of pieces in current group (for disabling clear button) */
	piecesCount: number;
	/** Handler to clear all pieces in the layout */
	onClearLayout: () => void;
	/** Handler to export current group SVG with optional pass type */
	onDownload: (passType?: ExportPassType) => void;
	/** Handler to export all groups SVG */
	onDownloadAllGroups: () => void;
	/** Whether the current group needs multiple passes (has both top and bottom notches) */
	needsMultiplePasses?: boolean;
}

/**
 * GroupToolbar displays the group selector, rename controls,
 * layout info, and export buttons for the layout editor.
 */
export function GroupToolbar({
	groups,
	activeGroupId,
	setActiveGroupId,
	addNewGroup,
	deleteGroup,
	renameGroup,
	totalStripLength,
	allGroupsTotalLength,
	displayUnit,
	piecesCount,
	onClearLayout,
	onDownload,
	onDownloadAllGroups,
	needsMultiplePasses = false,
}: GroupToolbarProps) {
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState("");
	const [showMoreMenu, setShowMoreMenu] = useState(false);
	const [showExportMenu, setShowExportMenu] = useState(false);
	const exportMenuRef = useRef<HTMLDivElement>(null);

	// Close export menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				exportMenuRef.current &&
				!exportMenuRef.current.contains(event.target as Node)
			) {
				setShowExportMenu(false);
			}
		};

		if (showExportMenu) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showExportMenu]);

	const activeGroup = groups.get(activeGroupId);

	return (
		<div className="flex items-center justify-between gap-4 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
			{/* Group selector */}
			<div className="flex items-center gap-3">
				<span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
					Group
				</span>

				{isRenaming ? (
					<div className="flex items-center gap-2">
						<input
							type="text"
							className="bg-gray-800 border border-gray-600 text-gray-100 text-sm rounded-lg px-3 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
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
							className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
							title="Save"
						>
							<Check className="w-4 h-4" />
						</button>
						<button
							type="button"
							onClick={() => setIsRenaming(false)}
							className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
							title="Cancel"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<div className="relative">
							<select
								className="appearance-none bg-gray-800 border border-gray-700 text-gray-100 text-sm font-medium rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer hover:bg-gray-750"
								value={activeGroupId}
								onChange={(e) => setActiveGroupId(e.target.value)}
							>
								{Array.from(groups.values()).map((g) => (
									<option key={g.id} value={g.id}>
										{g.name}
									</option>
								))}
							</select>
							<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
						</div>

						<button
							type="button"
							onClick={addNewGroup}
							className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md"
							title="Add new group"
						>
							<Plus className="w-4 h-4" />
						</button>

						{/* More actions dropdown */}
						<div className="relative">
							<button
								type="button"
								onClick={() => setShowMoreMenu(!showMoreMenu)}
								className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
								title="More actions"
							>
								<MoreHorizontal className="w-4 h-4" />
							</button>

							{showMoreMenu && (
								<>
									<button
										type="button"
										className="fixed inset-0 z-10 cursor-default bg-transparent"
										onClick={() => setShowMoreMenu(false)}
										aria-label="Close menu"
									/>
									<div className="absolute top-full left-0 mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
										<button
											type="button"
											onClick={() => {
												const currentName = activeGroup?.name ?? "";
												setRenameValue(currentName);
												setIsRenaming(true);
												setShowMoreMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
										>
											<Pencil className="w-4 h-4 text-blue-400" />
											Rename group
										</button>
										<button
											type="button"
											onClick={() => {
												onClearLayout();
												setShowMoreMenu(false);
											}}
											disabled={piecesCount === 0}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<Eraser className="w-4 h-4 text-amber-400" />
											Clear layout
										</button>
										<div className="border-t border-gray-700 my-1" />
										<button
											type="button"
											onClick={() => {
												if (
													window.confirm(`Delete group "${activeGroup?.name}"?`)
												) {
													deleteGroup(activeGroupId);
												}
												setShowMoreMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
										>
											<Trash2 className="w-4 h-4" />
											Delete group
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Layout info */}
			<div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
				<Ruler className="w-4 h-4 text-emerald-400" />
				<div className="flex items-center gap-1">
					<span className="text-sm font-medium text-gray-200">
						{formatValue(totalStripLength, displayUnit)} {displayUnit}
					</span>
					<span className="text-xs text-gray-500">group</span>
				</div>
				<span className="text-gray-600">|</span>
				<div className="flex items-center gap-1">
					<span className="text-sm font-medium text-gray-200">
						{formatValue(allGroupsTotalLength, displayUnit)} {displayUnit}
					</span>
					<span className="text-xs text-gray-500">total</span>
				</div>
			</div>

			{/* Export actions */}
			<div className="flex items-center gap-2">
				{needsMultiplePasses ? (
					<div className="relative" ref={exportMenuRef}>
						<button
							type="button"
							onClick={() => setShowExportMenu(!showExportMenu)}
							className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md"
						>
							<Download className="w-4 h-4" />
							Export SVG
							<ChevronDown
								className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
							/>
						</button>

						{showExportMenu && (
							<div className="absolute top-full right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
								<button
									type="button"
									onClick={() => {
										onDownload("both");
										setShowExportMenu(false);
									}}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
								>
									<Download className="w-4 h-4 text-indigo-400" />
									Export Both Passes
								</button>
								<button
									type="button"
									onClick={() => {
										onDownload("top");
										setShowExportMenu(false);
									}}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
								>
									<Download className="w-4 h-4 text-blue-400" />
									Export Pass 1 (Top)
								</button>
								<button
									type="button"
									onClick={() => {
										onDownload("bottom");
										setShowExportMenu(false);
									}}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
								>
									<Download className="w-4 h-4 text-amber-400" />
									Export Pass 2 (Bottom)
								</button>
							</div>
						)}
					</div>
				) : (
					<button
						type="button"
						onClick={() => onDownload()}
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md"
					>
						<Download className="w-4 h-4" />
						Export SVG
					</button>
				)}
				<button
					type="button"
					onClick={onDownloadAllGroups}
					className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
					title="Export all groups as separate SVG files"
				>
					<Download className="w-4 h-4" />
					All Groups
				</button>
			</div>
		</div>
	);
}
