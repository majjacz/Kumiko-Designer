import { memo } from "react";

export interface ExportPreviewProps {
	/** Generated SVG content as a string */
	svgContent: string | null;
}

/**
 * ExportPreview displays a preview of the exported SVG content.
 * Shows a white background area with the rendered SVG or a placeholder message.
 */
export const ExportPreview = memo(function ExportPreview({
	svgContent,
}: ExportPreviewProps) {
	return (
		<div className="h-48 bg-gray-900 border-t border-gray-800 p-4 flex flex-col shrink-0">
			<h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
				Export Preview
			</h3>
			<div className="flex-1 bg-white rounded overflow-hidden flex items-center justify-center">
				{svgContent ? (
					<div
						className="w-full h-full p-4 flex items-center justify-center overflow-auto"
						// biome-ignore lint: SVG preview is safe
						dangerouslySetInnerHTML={{ __html: svgContent }}
					/>
				) : (
					<span className="text-gray-400 text-sm">No content to preview</span>
				)}
			</div>
		</div>
	);
});
