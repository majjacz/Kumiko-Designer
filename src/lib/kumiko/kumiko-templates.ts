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
];

/**
 * Load a template design from the public folder
 */
export async function loadTemplate(templateId: string): Promise<SavedDesignPayload | null> {
	const template = TEMPLATES.find((t) => t.id === templateId);
	if (!template) {
		console.error(`Template ${templateId} not found`);
		return null;
	}

	try {
		const response = await fetch(template.path);
		if (!response.ok) {
			throw new Error(`Failed to load template: ${response.statusText}`);
		}

		const data = await response.json() as SavedDesignPayload;
		
		// Validate the template
		if (data.version !== 1) {
			throw new Error("Invalid template version");
		}
		
		if (!data.lines || !data.groups) {
			throw new Error("Invalid template: missing required data");
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