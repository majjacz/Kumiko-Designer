import type { SavedDesignPayload } from "./kumiko-storage";

export interface TemplateInfo {
	id: string;
	name: string;
	description: string;
	path: string;
}

export const TEMPLATES: TemplateInfo[] = [
	{
		id: "squares",
		name: "Squares",
		description: "Geometric pattern featuring square shapes",
		path: "/templates/squares.json",
	},
	{
		id: "temlate-1",
		name: "Template 1",
		description: "Template design 1",
		path: "/templates/temlate-1.json",
	},
	{
		id: "complex",
		name: "Complex",
		description: "Complex",
		path: "/templates/complex.json",
	},
];

/**
 * Load a template design from the public folder
 */
export async function loadTemplate(
	templateId: string,
): Promise<SavedDesignPayload | null> {
	const template = TEMPLATES.find((t) => t.id === templateId);
	if (!template) {
		console.error(`Template ${templateId} not found`);
		return null;
	}

	try {
		// Resolve template path relative to the Vite base URL so it works on GitHub Pages
		// where the app is served from a sub-path (e.g. /USERNAME/REPO/).
		const resolvedPath = `${import.meta.env.BASE_URL}${template.path.replace(/^\//, "")}`;
		console.log(`[kumiko-templates] Fetching template from: ${resolvedPath}`);

		const response = await fetch(resolvedPath);
		if (!response.ok) {
			throw new Error(`Failed to load template: ${response.statusText}`);
		}

		const data = (await response.json()) as SavedDesignPayload;
		console.log(
			`[kumiko-templates] Loaded data for ${templateId}, designName: ${data.designName}`,
		);

		// Validate the template against the current non-legacy format
		if (data.version !== 1) {
			throw new Error("Invalid template version");
		}

		if (!data.lines || !data.groups) {
			throw new Error("Invalid template: missing required design data");
		}

		if (typeof data.gridCellSize !== "number") {
			throw new Error("Invalid template: missing gridCellSize");
		}

		if (typeof data.stockLength !== "number") {
			throw new Error("Invalid template: missing stockLength");
		}

		return data;
	} catch (error) {
		console.error(`Failed to load template ${templateId}:`, error);
		return null;
	}
}

/**
 * Get the default template (first in the list)
 */
export function getDefaultTemplateId(): string | null {
	return TEMPLATES.length > 0 ? TEMPLATES[0].id : null;
}
