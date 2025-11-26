import {
	ChevronDown,
	Download,
	FolderOpen,
	Grid,
	HelpCircle,
	Keyboard,
	Layout,
	MoreHorizontal,
	Mouse,
	PanelRight,
	PanelRightClose,
	Save,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import type React from "react";
import { useId, useRef, useState } from "react";
import { type AppStep, useKumiko } from "../../context/KumikoContext";
import {
	type NamedDesignSummary,
	ParamInput,
	TEMPLATES,
} from "../../lib/kumiko";

export interface KumikoHeaderProps {
	designName: string;
	step: AppStep;
	onStepChange: (step: AppStep) => void;
	onDesignNameChange: (name: string) => void;
	onSaveAs: () => void;
	onOpenLoadDialog: () => void;
	onOpenTemplateDialog: () => void;
	onExportJSON: () => void;
	onImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onClear: () => void;
	sidebarVisible?: boolean;
	onToggleSidebar?: () => void;
}

/**
 * Navigation tab component for switching between Design and Layout views
 */
function NavigationTabs({
	step,
	onStepChange,
}: {
	step: AppStep;
	onStepChange: (step: AppStep) => void;
}) {
	return (
		<div className="flex bg-gray-900/50 rounded-lg p-1" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={step === "design"}
				onClick={() => onStepChange("design")}
				className={`
					inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
					transition-all duration-200
					${
						step === "design"
							? "bg-indigo-600 text-white shadow-md"
							: "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
					}
				`}
			>
				<Grid className="w-4 h-4" />
				<span>Design</span>
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={step === "layout"}
				onClick={() => onStepChange("layout")}
				className={`
					inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
					transition-all duration-200
					${
						step === "layout"
							? "bg-indigo-600 text-white shadow-md"
							: "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
					}
				`}
			>
				<Layout className="w-4 h-4" />
				<span>Layout</span>
			</button>
		</div>
	);
}

/**
 * Dropdown menu for file operations
 */
function FileMenu({
	onSaveAs,
	onOpenLoadDialog,
	onOpenTemplateDialog,
	onExportJSON,
	onImportJSON,
	onClear,
}: {
	onSaveAs: () => void;
	onOpenLoadDialog: () => void;
	onOpenTemplateDialog: () => void;
	onExportJSON: () => void;
	onImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onClear: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const fileInputId = useId();
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

	const handleOpen = () => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			setMenuPosition({
				top: rect.bottom + 4,
				left: rect.left,
			});
		}
		setIsOpen(!isOpen);
	};

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				type="button"
				onClick={handleOpen}
				className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg
					bg-gray-800 text-gray-200 border border-gray-700
					hover:bg-gray-700 hover:border-gray-600
					transition-colors"
			>
				<MoreHorizontal className="w-4 h-4" />
				<span>File</span>
				<ChevronDown
					className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<>
					{/* Backdrop to close menu */}
					<button
						type="button"
						className="fixed inset-0 z-40 cursor-default bg-transparent"
						onClick={() => setIsOpen(false)}
						onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
						aria-label="Close menu"
					/>

					<div
						className="fixed w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden"
						style={{ top: menuPosition.top, left: menuPosition.left }}
					>
						<button
							type="button"
							onClick={() => {
								onSaveAs();
								setIsOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
						>
							<Save className="w-4 h-4 text-indigo-400" />
							Save As...
						</button>
						<button
							type="button"
							onClick={() => {
								onOpenLoadDialog();
								setIsOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
						>
							<FolderOpen className="w-4 h-4 text-blue-400" />
							Load Design...
						</button>

						<div className="border-t border-gray-700 my-1" />

						<button
							type="button"
							onClick={() => {
								onOpenTemplateDialog();
								setIsOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
						>
							<Sparkles className="w-4 h-4 text-purple-400" />
							Load Template...
						</button>

						<div className="border-t border-gray-700 my-1" />

						<button
							type="button"
							onClick={() => {
								onExportJSON();
								setIsOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
						>
							<Download className="w-4 h-4 text-emerald-400" />
							Export JSON
						</button>
						<label className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer">
							<Upload className="w-4 h-4 text-cyan-400" />
							Import JSON
							<input
								id={fileInputId}
								type="file"
								accept=".json"
								onChange={(e) => {
									onImportJSON(e);
									setIsOpen(false);
								}}
								className="hidden"
							/>
						</label>

						<div className="border-t border-gray-700 my-1" />

						<button
							type="button"
							onClick={() => {
								if (
									window.confirm(
										"Are you sure you want to clear all saved data?",
									)
								) {
									onClear();
								}
								setIsOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
						>
							<Trash2 className="w-4 h-4" />
							Clear All Data
						</button>
					</div>
				</>
			)}
		</div>
	);
}

export function KumikoHeader({
	designName,
	step,
	onStepChange,
	onDesignNameChange,
	onSaveAs,
	onOpenLoadDialog,
	onOpenTemplateDialog,
	onExportJSON,
	onImportJSON,
	onClear,
	sidebarVisible,
	onToggleSidebar,
}: KumikoHeaderProps) {
	const [showHelp, setShowHelp] = useState(false);
	const helpDialogTitleId = useId();

	return (
		<header className="flex-shrink-0 bg-gray-850 border-b border-gray-700/50 px-4 py-3 z-30 relative">
			<div className="flex items-center justify-between gap-6">
				{/* Left: Logo & Title */}
				<div className="flex items-center gap-3">
					<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
						<Grid className="w-4 h-4 text-white" />
					</div>
					<div className="hidden sm:block">
						<h1 className="text-sm font-semibold text-gray-100 leading-tight">
							Kumiko Designer
						</h1>
						<p className="text-xs text-gray-500">Grid & Layout Tool</p>
					</div>
				</div>

				{/* Center: Navigation Tabs */}
				<NavigationTabs step={step} onStepChange={onStepChange} />

				{/* Right: Design Name & Actions */}
				<div className="flex items-center gap-3">
					{/* Design Name Input */}
					<div className="relative">
						<input
							type="text"
							value={designName}
							onChange={(e) => onDesignNameChange(e.target.value)}
							placeholder="Untitled design"
							className="w-40 px-3 py-2 text-sm rounded-lg
								bg-gray-900 text-gray-100
								border border-gray-700
								placeholder:text-gray-500
								focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
								transition-colors"
						/>
					</div>

					{/* File Menu */}
					<FileMenu
						onSaveAs={onSaveAs}
						onOpenLoadDialog={onOpenLoadDialog}
						onOpenTemplateDialog={onOpenTemplateDialog}
						onExportJSON={onExportJSON}
						onImportJSON={onImportJSON}
						onClear={onClear}
					/>

					{/* Help Button */}
					<button
						type="button"
						onClick={() => setShowHelp(true)}
						className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
						title="Help & keyboard shortcuts"
					>
						<HelpCircle className="w-5 h-5" />
					</button>

					{/* Sidebar Toggle Button */}
					{onToggleSidebar && !sidebarVisible && (
						<button
							type="button"
							onClick={onToggleSidebar}
							className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
							title="Show parameters sidebar"
						>
							<PanelRight className="w-6 h-6" />
						</button>
					)}
				</div>
			</div>

			{/* Help Dialog */}
			{showHelp && (
				<div
					className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
					role="dialog"
					aria-modal="true"
					aria-labelledby={helpDialogTitleId}
				>
					<div
						className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[32rem] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col"
						role="document"
					>
						{/* Header */}
						<div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
							<div className="flex items-center gap-2">
								<HelpCircle className="w-5 h-5 text-indigo-400" />
								<h2
									id={helpDialogTitleId}
									className="text-base font-semibold text-gray-100"
								>
									Help & Shortcuts
								</h2>
							</div>
							<button
								type="button"
								onClick={() => setShowHelp(false)}
								className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
								aria-label="Close dialog"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-5 space-y-6">
							{/* Grid Designer Section */}
							<div>
								<div className="flex items-center gap-2 mb-3">
									<Grid className="w-4 h-4 text-indigo-400" />
									<h3 className="text-sm font-semibold text-gray-200">
										Grid Designer
									</h3>
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">Drag</strong> on grid to
											draw lines
										</span>
									</div>
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">
												Drag across line
											</strong>{" "}
											to delete it
										</span>
									</div>
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">Click markers</strong>{" "}
											to toggle notch direction
										</span>
									</div>
								</div>
							</div>

							{/* Layout Editor Section */}
							<div>
								<div className="flex items-center gap-2 mb-3">
									<Layout className="w-4 h-4 text-purple-400" />
									<h3 className="text-sm font-semibold text-gray-200">
										Layout Editor
									</h3>
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">Click strip</strong> in
											bank to select
										</span>
									</div>
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">Click canvas</strong> to
											place strip
										</span>
									</div>
									<div className="flex items-center gap-3 text-gray-400">
										<Mouse className="w-4 h-4 text-gray-500 flex-shrink-0" />
										<span>
											<strong className="text-gray-300">
												Drag placed strip
											</strong>{" "}
											to reposition
										</span>
									</div>
								</div>
							</div>

							{/* Navigation Section */}
							<div>
								<div className="flex items-center gap-2 mb-3">
									<Keyboard className="w-4 h-4 text-emerald-400" />
									<h3 className="text-sm font-semibold text-gray-200">
										Navigation
									</h3>
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center justify-between text-gray-400">
										<span>Pan view</span>
										<kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 font-mono">
											Scroll
										</kbd>
									</div>
									<div className="flex items-center justify-between text-gray-400">
										<span>Zoom in/out</span>
										<kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 font-mono">
											Ctrl + Scroll
										</kbd>
									</div>
									<div className="flex items-center justify-between text-gray-400">
										<span>Fit to view</span>
										<span className="text-xs text-gray-500">
											Use toolbar button
										</span>
									</div>
								</div>
							</div>

							{/* Saving & Export Section */}
							<div>
								<div className="flex items-center gap-2 mb-3">
									<Save className="w-4 h-4 text-amber-400" />
									<h3 className="text-sm font-semibold text-gray-200">
										Saving & Export
									</h3>
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-start gap-3 text-gray-400">
										<span className="text-gray-500 flex-shrink-0 mt-0.5">
											•
										</span>
										<span>
											<strong className="text-gray-300">Auto-save:</strong> Your
											design is automatically saved to browser local storage as
											you work
										</span>
									</div>
									<div className="flex items-start gap-3 text-gray-400">
										<span className="text-gray-500 flex-shrink-0 mt-0.5">
											•
										</span>
										<span>
											<strong className="text-gray-300">Save As:</strong>{" "}
											Creates a new design copy with a different name, leaving
											the original unchanged
										</span>
									</div>
									<div className="flex items-start gap-3 text-gray-400">
										<span className="text-gray-500 flex-shrink-0 mt-0.5">
											•
										</span>
										<span>
											<strong className="text-gray-300">JSON Export:</strong>{" "}
											Download your design as a JSON file for backup or sharing
											with others
										</span>
									</div>
									<div className="flex items-start gap-3 text-gray-400">
										<span className="text-gray-500 flex-shrink-0 mt-0.5">
											•
										</span>
										<span>
											<strong className="text-gray-300">SVG Export:</strong>{" "}
											Generate CNC-ready SVG files from the Layout Editor
										</span>
									</div>
								</div>
							</div>

							{/* Tips */}
							<div className="p-3 bg-indigo-950/30 rounded-lg border border-indigo-800/30">
								<p className="text-xs text-indigo-300">
									<strong>Tip:</strong> Use the sidebar to configure CNC
									parameters like bit size and cut depth before exporting your
									design.
								</p>
							</div>
						</div>

						{/* Footer */}
						<div className="px-5 py-3 border-t border-gray-700 bg-gray-900/50">
							<button
								type="button"
								onClick={() => setShowHelp(false)}
								className="w-full px-4 py-2 text-sm font-medium rounded-lg
									bg-gray-800 text-gray-200 border border-gray-700
									hover:bg-gray-700 transition-colors"
							>
								Got it
							</button>
						</div>
					</div>
				</div>
			)}
		</header>
	);
}

export interface KumikoLoadDialogProps {
	namedDesigns: NamedDesignSummary[];
	onClose: () => void;
	onLoadNamed: (name: string) => void;
	onDeleteNamed: (name: string) => void;
}

export function KumikoLoadDialog({
	namedDesigns,
	onClose,
	onLoadNamed,
	onDeleteNamed,
}: KumikoLoadDialogProps) {
	const dialogTitleId = useId();

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
			<div
				className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-96 max-w-[90vw] overflow-hidden"
				role="dialog"
				aria-labelledby={dialogTitleId}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
					<div className="flex items-center gap-2">
						<FolderOpen className="w-5 h-5 text-indigo-400" />
						<h2
							id={dialogTitleId}
							className="text-base font-semibold text-gray-100"
						>
							Load Design
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
						aria-label="Close dialog"
					>
						<svg
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="p-5">
					{namedDesigns.length === 0 ? (
						<div className="text-center py-8">
							<FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
							<p className="text-sm text-gray-400">No saved designs yet</p>
							<p className="text-xs text-gray-500 mt-1">
								Save a design to see it here
							</p>
						</div>
					) : (
						<ul className="space-y-2 max-h-64 overflow-y-auto">
							{namedDesigns.map((d) => (
								<li
									key={d.name}
									className="flex items-center justify-between gap-3 bg-gray-800/60 hover:bg-gray-800 px-4 py-3 rounded-lg transition-colors group"
								>
									<div className="flex-1 min-w-0">
										<span className="block text-sm font-medium text-gray-100 truncate">
											{d.name}
										</span>
										<span className="text-xs text-gray-500">
											{new Date(d.savedAt).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => onLoadNamed(d.name)}
											className="px-3 py-1.5 rounded-md bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
										>
											Load
										</button>
										<button
											type="button"
											onClick={() => onDeleteNamed(d.name)}
											className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
											title="Delete design"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Footer */}
				<div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
					<button
						type="button"
						onClick={onClose}
						className="w-full px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

export interface KumikoTemplateDialogProps {
	onClose: () => void;
	onLoadTemplate: (templateId: string) => void;
}

export function KumikoTemplateDialog({
	onClose,
	onLoadTemplate,
}: KumikoTemplateDialogProps) {
	const dialogTitleId = useId();

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
			<div
				className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-96 max-w-[90vw] overflow-hidden"
				role="dialog"
				aria-labelledby={dialogTitleId}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
					<div className="flex items-center gap-2">
						<Sparkles className="w-5 h-5 text-purple-400" />
						<h2
							id={dialogTitleId}
							className="text-base font-semibold text-gray-100"
						>
							Templates
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
						aria-label="Close dialog"
					>
						<svg
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="p-5">
					{TEMPLATES.length === 0 ? (
						<div className="text-center py-8">
							<Sparkles className="w-12 h-12 text-gray-700 mx-auto mb-3" />
							<p className="text-sm text-gray-400">No templates available</p>
						</div>
					) : (
						<ul className="space-y-2 max-h-64 overflow-y-auto">
							{TEMPLATES.map((template) => (
								<li
									key={template.id}
									className="flex items-center justify-between gap-3 bg-gray-800/60 hover:bg-gray-800 px-4 py-3 rounded-lg transition-colors group"
								>
									<div className="flex-1 min-w-0">
										<span className="block text-sm font-medium text-gray-100">
											{template.name}
										</span>
										<span className="text-xs text-gray-500">
											{template.description}
										</span>
									</div>
									<button
										type="button"
										onClick={() => onLoadTemplate(template.id)}
										className="px-3 py-1.5 rounded-md bg-purple-600 text-xs font-medium text-white hover:bg-purple-500 transition-colors"
									>
										Use
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Footer */}
				<div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
					<button
						type="button"
						onClick={onClose}
						className="w-full px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

export interface KumikoSidebarParamsProps {
	displayUnit: "mm" | "in";
	onToggleUnits: () => void;
	bitSize: number;
	cutDepth: number;
	halfCutDepth: number;
	gridCellSize: number;
	stockLength: number;
	onBitSizeChange: (mmValue: number) => void;
	onCutDepthChange: (mmValue: number) => void;
	onHalfCutDepthChange: (mmValue: number) => void;
	onGridCellSizeChange: (mmValue: number) => void;
	onStockLengthChange: (mmValue: number) => void;
	onClose?: () => void;
}

/**
 * Collapsible section component for grouping related parameters
 */
function ParamSection({
	title,
	description,
	children,
	defaultOpen = true,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<div className="border border-gray-700/50 rounded-lg overflow-hidden">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
			>
				<div className="flex flex-col items-start">
					<span className="text-sm font-medium text-gray-200">{title}</span>
					{description && (
						<span className="text-xs text-gray-500 mt-0.5">{description}</span>
					)}
				</div>
				<ChevronDown
					className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>
			{isOpen && (
				<div className="px-4 py-4 space-y-4 bg-gray-900/30">{children}</div>
			)}
		</div>
	);
}

/**
 * Sidebar params component that accepts explicit props.
 * Use KumikoSidebarParamsConnected for automatic context consumption.
 */
export function KumikoSidebarParams({
	displayUnit,
	onToggleUnits,
	bitSize,
	cutDepth,
	halfCutDepth,
	gridCellSize,
	stockLength,
	onBitSizeChange,
	onCutDepthChange,
	onHalfCutDepthChange,
	onGridCellSizeChange,
	onStockLengthChange,
	onClose,
}: KumikoSidebarParamsProps) {
	const bitSizeId = useId();
	const cutDepthId = useId();
	const halfCutDepthId = useId();
	const gridCellSizeId = useId();
	const stockLengthId = useId();

	return (
		<aside className="w-full md:w-72 flex-shrink-0 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 overflow-y-auto">
			{/* Header */}
			<div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-4 z-10">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-gray-100">Parameters</h2>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onToggleUnits}
							className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
								bg-gray-800 text-gray-300 border border-gray-700
								hover:bg-gray-700 hover:text-gray-100
								transition-colors"
							title="Toggle between millimeters and inches"
						>
							<span
								className={
									displayUnit === "mm" ? "text-indigo-400" : "text-gray-500"
								}
							>
								mm
							</span>
							<span className="text-gray-600">/</span>
							<span
								className={
									displayUnit === "in" ? "text-indigo-400" : "text-gray-500"
								}
							>
								in
							</span>
						</button>
						{onClose && (
							<button
								type="button"
								onClick={onClose}
								className="p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
								title="Hide parameters sidebar"
							>
								<PanelRightClose className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Parameter Sections */}
			<div className="p-4 space-y-3">
				{/* CNC Cutting Parameters */}
				<ParamSection title="CNC Cutting" description="Tool and cut settings">
					<ParamInput
						label="Bit Size"
						id={bitSizeId}
						mmValue={bitSize}
						onChange={onBitSizeChange}
						displayUnit={displayUnit}
						precision={3}
					/>
					<div className="text-xs text-gray-500 -mt-2">
						Diameter of the router bit
					</div>

					<ParamInput
						label="Full Cut Depth"
						id={cutDepthId}
						mmValue={cutDepth}
						onChange={onCutDepthChange}
						displayUnit={displayUnit}
					/>
					<div className="text-xs text-gray-500 -mt-2">
						Depth for through cuts
					</div>

					<ParamInput
						label="Half Cut Depth"
						id={halfCutDepthId}
						mmValue={halfCutDepth}
						onChange={onHalfCutDepthChange}
						displayUnit={displayUnit}
					/>
					<div className="text-xs text-gray-500 -mt-2">
						Depth for notch cuts (typically half of strip thickness)
					</div>
				</ParamSection>

				{/* Grid Settings */}
				<ParamSection title="Grid" description="Design grid configuration">
					<ParamInput
						label="Cell Size"
						id={gridCellSizeId}
						mmValue={gridCellSize}
						onChange={onGridCellSizeChange}
						displayUnit={displayUnit}
					/>
					<div className="text-xs text-gray-500 -mt-2">
						Physical size of each grid cell
					</div>
				</ParamSection>

				{/* Stock Settings */}
				<ParamSection title="Stock Material" description="Board dimensions">
					<ParamInput
						label="Board Length"
						id={stockLengthId}
						mmValue={stockLength}
						onChange={onStockLengthChange}
						displayUnit={displayUnit}
					/>
					<div className="text-xs text-gray-500 -mt-2">
						Maximum length of stock boards for layout
					</div>
				</ParamSection>

				{/* Quick Tips */}
				<div className="mt-6 p-3 bg-indigo-900/20 border border-indigo-800/30 rounded-lg">
					<div className="flex items-start gap-2">
						<HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
						<div className="text-xs text-indigo-300/80">
							<p className="font-medium text-indigo-300 mb-1">Quick tip</p>
							<p>
								These parameters affect how your design will be cut. Make sure
								to match your actual CNC settings.
							</p>
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}

/**
 * Context-connected version of KumikoSidebarParams.
 * Automatically consumes params from KumikoContext.
 */
export function KumikoSidebarParamsConnected({
	onClose,
}: {
	onClose?: () => void;
}) {
	const { params, paramActions } = useKumiko();

	return (
		<KumikoSidebarParams
			displayUnit={params.units}
			onToggleUnits={paramActions.toggleUnits}
			bitSize={params.bitSize}
			cutDepth={params.cutDepth}
			halfCutDepth={params.halfCutDepth}
			gridCellSize={params.gridCellSize}
			stockLength={params.stockLength}
			onBitSizeChange={paramActions.handleParamChange(paramActions.setBitSize)}
			onCutDepthChange={paramActions.handleParamChange(
				paramActions.setCutDepth,
			)}
			onHalfCutDepthChange={paramActions.handleHalfCutParamChange(
				paramActions.setHalfCutDepth,
			)}
			onGridCellSizeChange={paramActions.handleParamChange(
				paramActions.setGridCellSize,
			)}
			onStockLengthChange={paramActions.handleParamChange(
				paramActions.setStockLength,
			)}
			onClose={onClose}
		/>
	);
}
