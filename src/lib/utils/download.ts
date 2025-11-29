/**
 * Download/Export Utilities
 *
 * Centralized utilities for downloading files (SVG, JSON, etc.)
 */

/**
 * Download a Blob as a file with the given filename.
 */
function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Download an SVG string as an .svg file.
 */
export function downloadSVG(svg: string, filename: string): void {
	const blob = new Blob([svg], { type: "image/svg+xml" });
	downloadBlob(blob, filename.endsWith(".svg") ? filename : `${filename}.svg`);
}

/**
 * Download a JSON object as a .json file.
 */
export function downloadJSON(data: unknown, filename: string): void {
	const jsonString = JSON.stringify(data, null, 2);
	const blob = new Blob([jsonString], { type: "application/json" });
	downloadBlob(
		blob,
		filename.endsWith(".json") ? filename : `${filename}.json`,
	);
}
