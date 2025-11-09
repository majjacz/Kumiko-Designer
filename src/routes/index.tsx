import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Grid, Layout, Settings } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
	Cut,
	convertUnit,
	DesignStrip,
	findIntersection,
	Group,
	Intersection,
	Line,
	newId,
	Piece,
	Point,
} from "../lib/kumiko/kumiko-core";
import { GridDesigner } from "../lib/kumiko/kumiko-grid-designer";
import { LayoutEditor } from "../lib/kumiko/kumiko-layout-editor";
import { ParamInput, SimpleParamInput } from "../lib/kumiko/kumiko-params";
import {
	clearDesign,
	loadDesign,
	saveDesign,
	type SavedDesignPayload,
	listNamedDesigns,
	saveNamedDesign,
	loadNamedDesign,
	deleteNamedDesign,
} from "../lib/kumiko/kumiko-storage";

// Thin route-level App orchestrating state and wiring child modules

function App() {
	const [step, setStep] = useState<"design" | "layout">("design");
	const [units, setUnits] = useState<"mm" | "in">("mm");

	// Parameters (stored internally in mm)
	const [bitSize, setBitSize] = useState(6.35);
	const [cutDepth, setCutDepth] = useState(19);
	const [halfCutDepth, setHalfCutDepth] = useState(9.5);
	const [stripLength, setStripLength] = useState(600);
	const [gridSize, setGridSize] = useState(20);

	// Design state
	const [lines, setLines] = useState<Map<string, Line>>(new Map());
	const [drawingLine, setDrawingLine] = useState<Point | null>(null);

	// Layout state
	const [groups, setGroups] = useState<Map<string, Group>>(
		() =>
			new Map([
				[
					"group1",
					{
						id: "group1",
						name: "Default Group",
						pieces: new Map<string, Piece>(),
						fullCuts: new Map<string, Cut>(),
					},
				],
			]),
	);
	const [activeGroupId, setActiveGroupId] = useState<string>("group1");
	const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
	const [nextRotation, setNextRotation] = useState(0);
	const [layoutTool, setLayoutTool] = useState<"place" | "cut">("place");
	const [layoutCutStart, setLayoutCutStart] = useState<Point | null>(null);

	// Named design state
	const [designName, setDesignName] = useState<string>("");
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [namedDesigns, setNamedDesigns] = useState<
		{ name: string; savedAt: string }[]
	>([]);

	// Helper to apply a loaded design payload into state
	const applyLoadedDesign = (loaded: SavedDesignPayload | null) => {
		if (!loaded) return;

		setUnits(loaded.units);
		setBitSize(loaded.bitSize);
		setCutDepth(loaded.cutDepth);
		setHalfCutDepth(loaded.halfCutDepth);
		setStripLength(loaded.stripLength);
		setGridSize(loaded.gridSize);

		setLines(() => {
			const next = new Map<string, Line>();
			for (const line of loaded.lines) {
				next.set(line.id, { ...line });
			}
			return next;
		});

		setGroups(() => {
			const next = new Map<string, Group>();
			for (const g of loaded.groups) {
				next.set(g.id, {
					id: g.id,
					name: g.name,
					pieces: new Map(g.pieces.map((p) => [p.id, { ...p }])),
					fullCuts: new Map(g.fullCuts.map((c) => [c.id, { ...c }])),
				});
			}
			return next;
		});

		setActiveGroupId(loaded.activeGroupId);
		setDesignName(loaded.designName ?? "");
	};

	// Derived intersections
	const intersections = useMemo<Map<string, Intersection>>(() => {
		const newIntersections = new Map<string, Intersection>();
		const lineArray = Array.from(lines.values());

		for (let i = 0; i < lineArray.length; i++) {
			for (let j = i + 1; j < lineArray.length; j++) {
				const line1 = lineArray[i];
				const line2 = lineArray[j];
				const point = findIntersection(line1, line2);

				if (point) {
					const id = `int_${line1.id}_${line2.id}`;
					newIntersections.set(id, {
						id,
						x: point.x,
						y: point.y,
						line1Id: line1.id,
						line2Id: line2.id,
						line1Over: true,
					});
				}
			}
		}
		return newIntersections;
	}, [lines]);

	// Derived design strips for layout
	const designStrips = useMemo<DesignStrip[]>(() => {
		const gridUnitSize = stripLength / gridSize;

		return Array.from(lines.values()).map((line: Line) => {
			const { x1, y1, x2, y2 } = line;
			const lengthGrid = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
			const lengthMM = lengthGrid * gridUnitSize;

			const related = Array.from(intersections.values()).filter(
				(int) => int.line1Id === line.id || int.line2Id === line.id,
			);

			const notches = related
				.map((int) => {
					const isLine1 = int.line1Id === line.id;
					const otherLineId = isLine1 ? int.line2Id : int.line1Id;

					const distGrid = Math.sqrt((int.x - x1) ** 2 + (int.y - y1) ** 2);
					const distMM = distGrid * gridUnitSize;

					let fromTop: boolean;
					if (int.line1Over) {
						fromTop = isLine1 ? false : true;
					} else {
						fromTop = isLine1 ? true : false;
					}

					return {
						id: `${int.id}_${line.id}`,
						otherLineId,
						dist: distMM,
						fromTop,
					};
				})
				.sort((a, b) => a.dist - b.dist);

			return {
				...line,
				lengthMM,
				notches,
			};
		});
	}, [lines, intersections, stripLength, gridSize]);

	const activeGroup = useMemo<Group | undefined>(
		() => groups.get(activeGroupId),
		[groups, activeGroupId],
	);

	// On mount, load the last working design (if any)
	useEffect(() => {
		const loaded = loadDesign();
		if (!loaded) return;
		applyLoadedDesign(loaded);
	}, []);

	// Load named designs list (for Load dialog)
	useEffect(() => {
		setNamedDesigns(listNamedDesigns());
	}, []);

	const handleClear = () => {
		if (
			!window.confirm(
				"Clear current design and layout? This will reset the working state.",
			)
		) {
			return;
		}

		// Clear persisted autosave
		clearDesign();

		// Reset design state
		setLines(new Map());
		setDrawingLine(null);

		// Reset layout to single empty default group
		const defaultGroupId = "group1";
		setGroups(
			new Map([
				[
					defaultGroupId,
					{
						id: defaultGroupId,
						name: "Default Group",
						pieces: new Map<string, Piece>(),
						fullCuts: new Map<string, Cut>(),
					},
				],
			]),
		);
		setActiveGroupId(defaultGroupId);
		setSelectedPieceId(null);
		setNextRotation(0);
		setLayoutTool("place");
		setLayoutCutStart(null);

		// Reset named design metadata
		setDesignName("");
	};
	// Persist to local storage whenever the core design/layout state changes
	useEffect(() => {
		const payload: SavedDesignPayload = {
			version: 1 as const,
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			stripLength,
			gridSize,
			lines: Array.from(lines.values()),
			groups: Array.from(groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				pieces: Array.from(g.pieces.values()),
				fullCuts: Array.from(g.fullCuts.values()),
			})),
			activeGroupId,
			designName: designName || undefined,
		};

		saveDesign(payload);
	}, [
		units,
		bitSize,
		cutDepth,
		halfCutDepth,
		stripLength,
		gridSize,
		lines,
		groups,
		activeGroupId,
		designName,
	]);

	// Explicit save-as of current state under a name
	const handleSaveAs = () => {
		const name = designName.trim();
		if (!name) {
			alert("Enter a design name before saving.");
			return;
		}

		const payload: SavedDesignPayload = {
			version: 1 as const,
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			stripLength,
			gridSize,
			lines: Array.from(lines.values()),
			groups: Array.from(groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				pieces: Array.from(g.pieces.values()),
				fullCuts: Array.from(g.fullCuts.values()),
			})),
			activeGroupId,
			designName: name,
		};

		saveNamedDesign(name, payload);
		setNamedDesigns(listNamedDesigns());
		alert(`Saved design "${name}" to this browser.`);
	};

	// Open the load dialog and refresh the list
	const openLoadDialog = () => {
		setNamedDesigns(listNamedDesigns());
		setShowLoadDialog(true);
	};

	// Load a named design chosen from the dialog
	const handleLoadNamed = (name: string) => {
		const loaded = loadNamedDesign(name);
		if (!loaded) {
			alert(`No data found for design "${name}".`);
			return;
		}
		applyLoadedDesign(loaded);
		setShowLoadDialog(false);
	};

	// Delete a named design from the dialog
	const handleDeleteNamed = (name: string) => {
		if (!window.confirm(`Delete saved design "${name}"?`)) return;
		deleteNamedDesign(name);
		setNamedDesigns(listNamedDesigns());
	};

	// Handlers

	const toggleIntersection = (id: string) => {
		const int = intersections.get(id);
		if (!int) return;
		int.line1Over = !int.line1Over;
		// intersections derived from lines; we need a lines update to retrigger
		setLines(new Map(lines));
	};

	const handleGridClick = (point: Point) => {
		// Use coordinates directly from getGridPoint (already snapped to grid)
		const gridPoint = point;

		if (!drawingLine) {
			setDrawingLine(gridPoint);
			return;
		}

		if (drawingLine.x === gridPoint.x && drawingLine.y === gridPoint.y) {
			setDrawingLine(null);
			return;
		}

		const id = newId();
		const newLine: Line = {
			id,
			x1: drawingLine.x,
			y1: drawingLine.y,
			x2: gridPoint.x,
			y2: gridPoint.y,
		};
		setLines((prev) => new Map(prev).set(id, newLine));
		setDrawingLine(null);
	};

	const handleCreateLine = (start: Point, end: Point) => {
		// Create a complete line directly from drag operation
		const id = newId();
		const newLine: Line = {
			id,
			x1: start.x,
			y1: start.y,
			x2: end.x,
			y2: end.y,
		};
		setLines((prev) => new Map(prev).set(id, newLine));
		setDrawingLine(null);
	};

	const handleParamChange =
		(setter: React.Dispatch<React.SetStateAction<number>>) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const displayValue = parseFloat(e.target.value) || 0;
			const mmValue = convertUnit(displayValue, units, "mm");
			setter(mmValue);

			if (setter === setCutDepth) {
				setHalfCutDepth(mmValue / 2);
			}
		};

	const handleHalfCutParamChange =
		(setter: React.Dispatch<React.SetStateAction<number>>) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const displayValue = parseFloat(e.target.value) || 0;
			const mmValue = convertUnit(displayValue, units, "mm");
			setter(mmValue);
		};

	const toggleUnits = () => {
		setUnits((prev) => (prev === "mm" ? "in" : "mm"));
	};

	const addNewGroup = () => {
		const id = newId();
		const newGroup: Group = {
			id,
			name: `Group ${groups.size + 1}`,
			pieces: new Map<string, Piece>(),
			fullCuts: new Map<string, Cut>(),
		};
		setGroups((prev) => new Map(prev).set(id, newGroup));
		setActiveGroupId(id);
	};

	const deleteGroup = (id: string) => {
		if (groups.size <= 1) {
			alert("Cannot delete the last group.");
			return;
		}
		setGroups((prev) => {
			const next = new Map(prev);
			next.delete(id);
			if (activeGroupId === id) {
				const first = next.keys().next().value;
				if (first) setActiveGroupId(first);
			}
			return next;
		});
	};

	const handleLayoutClick = (point: Point) => {
		const { x, y } = point;

		if (layoutTool === "place" && selectedPieceId) {
			if (!activeGroup) return;
			const id = newId();
			setGroups((prev) => {
				const next = new Map(prev);
				const group = next.get(activeGroupId);
				if (group) {
					group.pieces.set(id, {
						id,
						lineId: selectedPieceId,
						x,
						y,
						rotation: nextRotation,
					});
				}
				return next;
			});
			return;
		}

		if (layoutTool === "cut") {
			if (!layoutCutStart) {
				setLayoutCutStart({ x, y });
			} else {
				const id = newId();
				setGroups((prev) => {
					const next = new Map(prev);
					const group = next.get(activeGroupId);
					if (group) {
						group.fullCuts.set(id, {
							id,
							x1: layoutCutStart.x,
							y1: layoutCutStart.y,
							x2: x,
							y2: y,
						});
					}
					return next;
				});
				setLayoutCutStart(null);
			}
		}
	};

	const deleteLayoutItem = (type: "piece" | "cut", id: string) => {
		setGroups((prev) => {
			const next = new Map(prev);
			const group = next.get(activeGroupId);
			if (group) {
				if (type === "piece") group.pieces.delete(id);
				if (type === "cut") group.fullCuts.delete(id);
			}
			return next;
		});
	};

	const generateSVG = (group: Group | undefined): string | null => {
		if (!group) return null;

		const pieces = Array.from(group.pieces.values());
		const cuts = Array.from(group.fullCuts.values());

		let minX = 0;
		let minY = 0;
		let maxX = stripLength;
		let maxY = stripLength;

		if (pieces.length > 0 || cuts.length > 0) {
			const allPoints = [
				...pieces.map((p) => {
					const strip = designStrips.find((s) => s.id === p.lineId);
					const w = strip ? strip.lengthMM : 0;
					const h = bitSize;
					return [p.x, p.y, p.x + w, p.y + h];
				}),
				...cuts.map((c) => [c.x1, c.y1, c.x2, c.y2]),
			].flat() as number[];
			minX = Math.min(0, ...allPoints) - 50;
			minY = Math.min(0, ...allPoints) - 50;
			maxX = Math.max(stripLength, ...allPoints) + 50;
			maxY = Math.max(stripLength, ...allPoints) + 50;
		}

		const viewBoxWidth = maxX - minX;
		const viewBoxHeight = maxY - minY;

		const segments: string[] = [];

		pieces.forEach((piece) => {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (!strip) return;

			const { x, y, rotation } = piece;
			const w = strip.lengthMM;
			const h = bitSize;
			const fullDepth = `${cutDepth.toFixed(3)}mm`;
			const halfDepth = `${halfCutDepth.toFixed(3)}mm`;

			const transform = `translate(${x}, ${y}) rotate(${rotation}, 0, ${h / 2})`;

			const notches = strip.notches
				.map((notch) => {
					const center = notch.dist;
					const left = center - bitSize / 2;
					const right = center + bitSize / 2;
					return { id: notch.id, left, right, fromTop: notch.fromTop };
				})
				.sort((a, b) => a.left - b.left);

			const pieceLines: string[] = [];
			let currentX = 0;

			if (notches.length === 0) {
				pieceLines.push(
					`<line x1="0" y1="0" x2="${w}" y2="0" shaper:cutDepth="${fullDepth}" />`,
				);
			} else {
				pieceLines.push(
					`<line x1="${currentX}" y1="0" x2="${notches[0].left}" y2="0" shaper:cutDepth="${fullDepth}" />`,
				);
				currentX = notches[0].left;
			}

			for (let i = 0; i < notches.length; i++) {
				const notch = notches[i];
				pieceLines.push(
					`<line x1="${notch.left.toFixed(
						3,
					)}" y1="0" x2="${notch.left.toFixed(
						3,
					)}" y2="${h.toFixed(3)}" shaper:cutDepth="${halfDepth}" />`,
				);
				pieceLines.push(
					`<line x1="${notch.left.toFixed(
						3,
					)}" y1="${h.toFixed(3)}" x2="${notch.right.toFixed(
						3,
					)}" y2="${h.toFixed(3)}" shaper:cutDepth="${halfDepth}" />`,
				);
				pieceLines.push(
					`<line x1="${notch.right.toFixed(
						3,
					)}" y1="${h.toFixed(3)}" x2="${notch.right.toFixed(
						3,
					)}" y2="0" shaper:cutDepth="${halfDepth}" />`,
				);
				currentX = notch.right;

				if (i < notches.length - 1) {
					const next = notches[i + 1];
					pieceLines.push(
						`<line x1="${currentX}" y1="0" x2="${next.left}" y2="0" shaper:cutDepth="${fullDepth}" />`,
					);
					currentX = next.left;
				}
			}

			if (currentX < w) {
				pieceLines.push(
					`<line x1="${currentX}" y1="0" x2="${w}" y2="0" shaper:cutDepth="${fullDepth}" />`,
				);
			}

			pieceLines.push(
				`<line x1="0" y1="${h}" x2="${w}" y2="${h}" shaper:cutDepth="${fullDepth}" />`,
			);
			pieceLines.push(
				`<line x1="0" y1="0" x2="0" y2="${h}" shaper:cutDepth="${fullDepth}" />`,
			);
			pieceLines.push(
				`<line x1="${w}" y1="0" x2="${w}" y2="${h}" shaper:cutDepth="${fullDepth}" />`,
			);

			segments.push(
				`<g transform="${transform}">\n${pieceLines
					.map((l) => `  ${l}`)
					.join("\n")}\n</g>`,
			);
		});

		cuts.forEach((cut) => {
			segments.push(
				`<line x1="${cut.x1}" y1="${cut.y1}" x2="${cut.x2}" y2="${cut.y2}" shaper:cutDepth="${cutDepth.toFixed(
					3,
				)}mm" />`,
			);
		});

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" shaper:cutDepthUnit="mm">\n${segments.join(
			"\n",
		)}\n</svg>`;
	};

	const downloadSVG = () => {
		const svg = generateSVG(activeGroup);
		if (!svg) return;
		const blob = new Blob([svg], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${activeGroup?.name || "kumiko-group"}.svg`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};



	const displayUnit = units;

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 font-sans">
			{/* Main content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				{/* Header */}
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
							onChange={(e) => setDesignName(e.target.value)}
							placeholder="Design name"
							className="px-2 py-1 text-[10px] rounded bg-gray-900 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
						<button
							type="button"
							onClick={handleSaveAs}
							className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-indigo-600 text-white hover:bg-indigo-500"
						>
							Save As
						</button>
						<button
							type="button"
							onClick={openLoadDialog}
							className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
						>
							Load
						</button>
						<button
							type="button"
							onClick={() => setStep("design")}
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
							onClick={() => setStep("layout")}
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
							onClick={handleClear}
							className="inline-flex items-center px-2 py-1 text-xs rounded bg-gray-900 text-gray-300 border border-gray-700 hover:bg-red-600 hover:text-white hover:border-red-500"
						>
							Clear Saved
						</button>
					</div>
				</header>

				{/* Step indicator */}
				<div className="flex-shrink-0 bg-gray-900 px-4 py-2 border-b border-gray-800 text-[10px] text-gray-400 flex items-center gap-2">
					<span
						className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
							step === "design"
								? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40"
								: "bg-gray-800 text-gray-400 border border-gray-700"
						}`}
					>
						<span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
						Grid design
					</span>
					<ArrowRight className="w-3 h-3 text-gray-600" />
					<span
						className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
							step === "layout"
								? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40"
								: "bg-gray-800 text-gray-400 border border-gray-700"
						}`}
					>
						<span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
						Strip layout
					</span>
				</div>

				{/* Main workspace */}
				{step === "design" && (
					<GridDesigner
						lines={lines}
						intersections={intersections}
						drawingLine={drawingLine}
						onGridClick={handleGridClick}
						onCreateLine={handleCreateLine}
						onToggleIntersection={toggleIntersection}
						bitSize={bitSize}
						stripLength={stripLength}
						gridSize={gridSize}
					/>
				)}

				{step === "layout" && (
					<LayoutEditor
						designStrips={designStrips}
						activeGroup={activeGroup}
						groups={groups}
						activeGroupId={activeGroupId}
						setActiveGroupId={setActiveGroupId}
						addNewGroup={addNewGroup}
						deleteGroup={deleteGroup}
						selectedPieceId={selectedPieceId}
						setSelectedPieceId={setSelectedPieceId}
						layoutTool={layoutTool}
						setLayoutTool={setLayoutTool}
						nextRotation={nextRotation}
						setNextRotation={setNextRotation}
						onLayoutClick={handleLayoutClick}
						layoutCutStart={layoutCutStart}
						stripLength={stripLength}
						bitSize={bitSize}
						halfCutDepth={halfCutDepth}
						cutDepth={cutDepth}
						onDownload={downloadSVG}
						onDeleteLayoutItem={deleteLayoutItem}
					/>
				)}

				{/* Simple inline "modal" for Load dialog */}
				{showLoadDialog && (
					<div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
						<div className="bg-gray-900 border border-gray-700 rounded-md p-4 w-80 space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-xs font-semibold text-gray-200">
									Load saved design
								</h2>
								<button
									type="button"
									onClick={() => setShowLoadDialog(false)}
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
													onClick={() => handleLoadNamed(d.name)}
													className="px-1.5 py-0.5 rounded bg-indigo-600 text-[8px] text-white hover:bg-indigo-500"
												>
													Load
												</button>
												<button
													type="button"
													onClick={() => handleDeleteNamed(d.name)}
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
				)}
			</main>

			{/* Sidebar */}
			<aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 p-4 overflow-y-auto">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
						Parameters
					</h2>
					<button
						type="button"
						onClick={toggleUnits}
						className="px-2 py-1 text-[10px] rounded bg-gray-900 text-gray-300 border border-gray-700 hover:bg-gray-700"
					>
						Units: {displayUnit.toUpperCase()}
					</button>
				</div>

				<div className="space-y-4">
					<ParamInput
						label="Bit Size"
						id="bitSize"
						mmValue={bitSize}
						onChange={handleParamChange(setBitSize)}
						displayUnit={displayUnit}
					/>
					<ParamInput
						label="Cut Depth"
						id="cutDepth"
						mmValue={cutDepth}
						onChange={handleParamChange(setCutDepth)}
						displayUnit={displayUnit}
					/>
					<ParamInput
						label="Half Cut Depth"
						id="halfCutDepth"
						mmValue={halfCutDepth}
						onChange={handleHalfCutParamChange(setHalfCutDepth)}
						displayUnit={displayUnit}
					/>
					<ParamInput
						label="Strip Length"
						id="stripLength"
						mmValue={stripLength}
						onChange={handleParamChange(setStripLength)}
						displayUnit={displayUnit}
					/>
					<SimpleParamInput
						label="Grid Size"
						id="gridSize"
						value={gridSize}
						onChange={(e) =>
							setGridSize(
								Number.isFinite(parseInt(e.target.value, 10))
									? parseInt(e.target.value, 10)
									: gridSize,
							)
						}
					/>
				</div>
			</aside>
		</div>
	);
}

export const Route = createFileRoute("/")({
	component: App,
});
