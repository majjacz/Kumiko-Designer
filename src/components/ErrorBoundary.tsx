import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	/** Optional fallback UI to render when an error occurs */
	fallback?: ReactNode;
	/** Optional callback when an error is caught */
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	/** Section name for display in the error UI */
	sectionName?: string;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI when an error occurs instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Log error to console for debugging
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		// Call optional error callback
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			// Render custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI
			return (
				<div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-red-800 rounded-lg m-4">
					<div className="flex items-center gap-3 mb-4">
						<AlertTriangle className="h-8 w-8 text-red-500" />
						<h2 className="text-xl font-semibold text-red-400">
							{this.props.sectionName
								? `Error in ${this.props.sectionName}`
								: "Something went wrong"}
						</h2>
					</div>

					<p className="text-gray-400 text-sm mb-4 text-center max-w-md">
						An unexpected error occurred. Try refreshing this section or reload
						the page.
					</p>

					{this.state.error && (
						<details className="mb-4 w-full max-w-md">
							<summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
								Error details
							</summary>
							<pre className="mt-2 p-3 bg-gray-950 rounded text-xs text-red-300 overflow-auto max-h-32">
								{this.state.error.message}
							</pre>
						</details>
					)}

					<button
						type="button"
						onClick={this.handleReset}
						className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
					>
						<RefreshCw className="h-4 w-4" />
						Try again
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
