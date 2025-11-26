import { createFileRoute } from "@tanstack/react-router";
import { KumikoProvider, useKumiko } from "../context/KumikoContext";
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
				/>

				{/* Main workspace */}
				{step === "design" && <GridDesignerConnected />}

				{step === "layout" && <LayoutEditorConnected />}

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
			<KumikoSidebarParamsConnected />
		</div>
	);
}

// Wrapper component that provides the context
function App() {
	return (
		<KumikoProvider>
			<AppContent />
		</KumikoProvider>
	);
}

export const Route = createFileRoute("/")({
	component: App,
});
