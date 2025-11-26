import { Download, Eraser, Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { formatValue, type Group } from "../../lib/kumiko";

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
	/** Total length of strips in mm */
	totalStripLength: number;
	/** Display unit for formatting */
	displayUnit: "mm" | "in";
	/** Number of pieces in current group (for disabling clear button) */
	piecesCount: number;
	/** Handler to clear all pieces in the layout */
	onClearLayout: () => void;
	/** Handler to export current group SVG */
	onDownload: () => void;
	/** Handler to export all groups SVG */
	onDownloadAllGroups: () => void;
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
	displayUnit,
	piecesCount,
	onClearLayout,
	onDownload,
	onDownloadAllGroups,
}: GroupToolbarProps) {
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState("");

	const activeGroup = groups.get(activeGroupId);

	return (
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
								const currentName = activeGroup?.name ?? "";
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
							onClick={onClearLayout}
							className="inline-flex items-center px-2 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white"
							disabled={piecesCount === 0}
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
	);
}
