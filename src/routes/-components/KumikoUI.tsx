import { Download, Grid, Layout, Settings, Upload } from "lucide-react";
import type React from "react";
import { useId } from "react";
import { ParamInput } from "../../lib/kumiko/kumiko-params";
import { TEMPLATES } from "../../lib/kumiko/kumiko-templates";

export type AppStep = "design" | "layout";

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
}: KumikoHeaderProps) {
	return (
		<header className="flex-shrink-0 bg-gray-800 p-3 flex justify-between items-center shadow-md z-10">
			<div className="flex items-center space-x-2">
				<Settings className="w-4 h-4 text-indigo-400" />
				<h1 className="text-sm font-semibold tracking-wide text-gray-100">
					Kumiko Grid & Layout Designer
				</h1>
			</div>
			<div className="flex items-center space-x-3">
				<input
					type="text"
					value={designName}
					onChange={(e) => onDesignNameChange(e.target.value)}
					placeholder="Design name"
					className="px-2 py-1 text-[10px] rounded bg-gray-900 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
				<button
					type="button"
					onClick={onSaveAs}
					className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-indigo-600 text-white hover:bg-indigo-500"
				>
					Save As
				</button>
				<button
					type="button"
					onClick={onOpenLoadDialog}
					className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
				>
					Load
				</button>
				<button
					type="button"
					onClick={onOpenTemplateDialog}
					className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-purple-600 text-white hover:bg-purple-500"
					title="Load a template design"
				>
					Templates
				</button>
				<button
					type="button"
					onClick={onExportJSON}
					className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-emerald-600 text-white hover:bg-emerald-500"
					title="Export design to JSON file"
				>
					<Download className="w-3 h-3 mr-1" />
					Export
				</button>
				<label
					className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
					title="Import design from JSON file"
				>
					<Upload className="w-3 h-3 mr-1" />
					Import
					<input
						type="file"
						accept=".json"
						onChange={onImportJSON}
						className="hidden"
					/>
				</label>
				<button
					type="button"
					onClick={() => onStepChange("design")}
					className={`inline-flex items-center px-2 py-1 text-xs rounded ${
						step === "design"
							? "bg-indigo-600 text-white"
							: "bg-gray-700 text-gray-300"
					}`}
				>
					<Grid className="w-3 h-3 mr-1" />
					Design Grid
				</button>
				<button
					type="button"
					onClick={() => onStepChange("layout")}
					className={`inline-flex items-center px-2 py-1 text-xs rounded ${
						step === "layout"
							? "bg-indigo-600 text-white"
							: "bg-gray-700 text-gray-300"
					}`}
				>
					<Layout className="w-3 h-3 mr-1" />
					Layout Strips
				</button>
				<button
					type="button"
					onClick={onClear}
					className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-900 text-gray-300 border border-gray-700 hover:bg-red-600 hover:text-white hover:border-red-500"
				>
					Clear Saved
				</button>
			</div>
		</header>
	);
}

export interface NamedDesignSummary {
	name: string;
	savedAt: string;
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
	return (
		<div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
			<div className="bg-gray-900 border border-gray-700 rounded-md p-4 w-80 space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-xs font-semibold text-gray-200">
						Load saved design
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-500 hover:text-gray-300 text-xs"
					>
						✕
					</button>
				</div>
				{namedDesigns.length === 0 ? (
					<p className="text-[10px] text-gray-400">
						No named designs saved in this browser yet.
					</p>
				) : (
					<ul className="space-y-1 max-h-52 overflow-y-auto text-[10px]">
						{namedDesigns.map((d) => (
							<li
								key={d.name}
								className="flex items-center justify-between gap-2 bg-gray-800/80 px-2 py-1 rounded"
							>
								<div className="flex flex-col">
									<span className="text-gray-100">{d.name}</span>
									<span className="text-[8px] text-gray-500">
										{new Date(d.savedAt).toLocaleString()}
									</span>
								</div>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => onLoadNamed(d.name)}
										className="px-1.5 py-0.5 rounded bg-indigo-600 text-[8px] text-white hover:bg-indigo-500"
									>
										Load
									</button>
									<button
										type="button"
										onClick={() => onDeleteNamed(d.name)}
										className="px-1.5 py-0.5 rounded bg-gray-700 text-[8px] text-red-300 hover:bg-red-600 hover:text-white"
									>
										Delete
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
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
	return (
		<div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
			<div className="bg-gray-900 border border-gray-700 rounded-md p-4 w-80 space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-xs font-semibold text-gray-200">Load Template</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-500 hover:text-gray-300 text-xs"
					>
						✕
					</button>
				</div>
				{TEMPLATES.length === 0 ? (
					<p className="text-[10px] text-gray-400">No templates available.</p>
				) : (
					<ul className="space-y-1 max-h-52 overflow-y-auto text-[10px]">
						{TEMPLATES.map((template) => (
							<li
								key={template.id}
								className="flex items-center justify-between gap-2 bg-gray-800/80 px-2 py-1.5 rounded"
							>
								<div className="flex flex-col">
									<span className="text-gray-100 font-medium">
										{template.name}
									</span>
									<span className="text-[9px] text-gray-500">
										{template.description}
									</span>
								</div>
								<button
									type="button"
									onClick={() => onLoadTemplate(template.id)}
									className="px-2 py-0.5 rounded bg-emerald-600 text-[8px] text-white hover:bg-emerald-500"
								>
									Load
								</button>
							</li>
						))}
					</ul>
				)}
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
}

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
}: KumikoSidebarParamsProps) {
	const bitSizeId = useId();
	const cutDepthId = useId();
	const halfCutDepthId = useId();
	const gridCellSizeId = useId();
	const stockLengthId = useId();

	return (
		<aside className="w-full md:w-80 lg:w-50 flex-shrink-0 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 p-4 overflow-y-auto">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
					Parameters
				</h2>
				<button
					type="button"
					onClick={onToggleUnits}
					className="px-2 py-1 text-[10px] rounded bg-gray-900 text-gray-300 border border-gray-700 hover:bg-gray-700"
				>
					Units: {displayUnit.toUpperCase()}
				</button>
			</div>

			<div className="space-y-4">
				<ParamInput
					label="Bit Size"
					id={bitSizeId}
					mmValue={bitSize}
					onChange={onBitSizeChange}
					displayUnit={displayUnit}
					precision={3}
				/>
				<ParamInput
					label="Cut Depth"
					id={cutDepthId}
					mmValue={cutDepth}
					onChange={onCutDepthChange}
					displayUnit={displayUnit}
				/>
				<ParamInput
					label="Half Cut Depth"
					id={halfCutDepthId}
					mmValue={halfCutDepth}
					onChange={onHalfCutDepthChange}
					displayUnit={displayUnit}
				/>
				<ParamInput
					label="Grid Cell Size"
					id={gridCellSizeId}
					mmValue={gridCellSize}
					onChange={onGridCellSizeChange}
					displayUnit={displayUnit}
				/>
				<ParamInput
					label="Stock Length (board max)"
					id={stockLengthId}
					mmValue={stockLength}
					onChange={onStockLengthChange}
					displayUnit={displayUnit}
				/>
			</div>
		</aside>
	);
}
