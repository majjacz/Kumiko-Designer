import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Derive router basepath from Vite's base URL so routing works under /Kumiko-Designer/
const basepath =
	import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
		? import.meta.env.BASE_URL.replace(/\/$/, "")
		: "/";

// Create a new router instance
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		basepath,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
	});

	return router;
};
