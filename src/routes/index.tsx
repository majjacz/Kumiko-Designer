import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { KumikoProvider, useKumiko } from "../context/KumikoContext";
import { ToastProvider } from "../context/ToastContext";
import { GridDesignerConnected, LayoutEditorConnected } from "../lib/kumiko";
import {
	KumikoHeader,
	KumikoLoadDialog,
	KumikoSidebarParamsConnected,
	KumikoTemplateDialog,
} from "./-components/KumikoUI";

// Inner App component that consumes context
function AppContent() {
	const {
		step,
		setStep,
		persistenceState,
		persistenceActions,
		openLoadDialog,
		openTemplateDialog,
	} = useKumiko();

	const [sidebarVisible, setSidebarVisible] = useState(true);

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 font-sans">
			{/* Main content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				<KumikoHeader
					designName={persistenceState.designName}
					step={step}
					onStepChange={setStep}
					onDesignNameChange={persistenceActions.setDesignName}
					onSaveAs={persistenceActions.handleSaveAs}
					onOpenLoadDialog={openLoadDialog}
					onOpenTemplateDialog={openTemplateDialog}
					onExportJSON={persistenceActions.handleExportJSON}
					onImportJSON={persistenceActions.handleImportJSON}
					onClear={persistenceActions.handleClear}
					sidebarVisible={sidebarVisible}
					onToggleSidebar={() => setSidebarVisible(true)}
				/>

				{/* Main workspace */}
				{step === "design" && (
					<ErrorBoundary sectionName="Grid Designer">
						<GridDesignerConnected />
					</ErrorBoundary>
				)}

				{step === "layout" && (
					<ErrorBoundary sectionName="Layout Editor">
						<LayoutEditorConnected />
					</ErrorBoundary>
				)}

				{/* Load dialog */}
				{persistenceState.showLoadDialog && (
					<KumikoLoadDialog
						namedDesigns={persistenceState.namedDesigns}
						onClose={() => persistenceActions.setShowLoadDialog(false)}
						onLoadNamed={persistenceActions.handleLoadNamed}
						onDeleteNamed={persistenceActions.handleDeleteNamed}
					/>
				)}

				{/* Template dialog */}
				{persistenceState.showTemplateDialog && (
					<KumikoTemplateDialog
						onClose={() => persistenceActions.setShowTemplateDialog(false)}
						onLoadTemplate={persistenceActions.handleLoadTemplate}
					/>
				)}
			</main>

			{/* Sidebar */}
			{sidebarVisible && (
				<ErrorBoundary sectionName="Sidebar">
					<KumikoSidebarParamsConnected
						onClose={() => setSidebarVisible(false)}
					/>
				</ErrorBoundary>
			)}
		</div>
	);
}

// Wrapper component that provides the context
function App() {
	return (
		<ToastProvider>
			<KumikoProvider>
				<AppContent />
			</KumikoProvider>
		</ToastProvider>
	);
}

export const Route = createFileRoute("/")({
	component: App,
});
