import { memo } from "react";

export interface ExportPreviewProps {
	/** Generated SVG content as a string, or an object with top/bottom passes */
	svgContent: string | { top: string; bottom: string } | null;
}

/**
 * ExportPreview displays a preview of the exported SVG content.
 * Shows a white background area with the rendered SVG or a placeholder message.
 */
export const ExportPreview = memo(function ExportPreview({
	svgContent,
}: ExportPreviewProps) {
	const isDoublePass =
		typeof svgContent === "object" && svgContent !== null && "top" in svgContent;

	return (
		<div className="h-48 bg-gray-900 border-t border-gray-800 p-4 flex flex-col shrink-0">
			<h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
				Export Preview
			</h3>
			<div className="flex-1 bg-white rounded overflow-hidden flex items-center justify-center">
				{svgContent ? (
					isDoublePass ? (
						<div className="w-full h-full flex flex-col divide-y divide-gray-200">
							<div className="flex-1 relative min-h-0">
								<div className="absolute top-1 left-1 text-[10px] text-gray-400 font-mono uppercase bg-white/80 px-1 rounded z-10 pointer-events-none">
									Top Pass
								</div>
								<div
									className="w-full h-full p-2 flex items-center justify-center overflow-auto"
									// biome-ignore lint: SVG preview is safe
									dangerouslySetInnerHTML={{
										__html: (svgContent as { top: string }).top,
									}}
								/>
							</div>
							<div className="flex-1 relative min-h-0">
								<div className="absolute top-1 left-1 text-[10px] text-gray-400 font-mono uppercase bg-white/80 px-1 rounded z-10 pointer-events-none">
									Bottom Pass
								</div>
								<div
									className="w-full h-full p-2 flex items-center justify-center overflow-auto"
									// biome-ignore lint: SVG preview is safe
									dangerouslySetInnerHTML={{
										__html: (svgContent as { bottom: string }).bottom,
									}}
								/>
							</div>
						</div>
					) : (
						<div
							className="w-full h-full p-4 flex items-center justify-center overflow-auto"
							// biome-ignore lint: SVG preview is safe
							dangerouslySetInnerHTML={{ __html: svgContent as string }}
						/>
					)
				) : (
					<span className="text-gray-400 text-sm">No content to preview</span>
				)}
			</div>
		</div>
	);
});
