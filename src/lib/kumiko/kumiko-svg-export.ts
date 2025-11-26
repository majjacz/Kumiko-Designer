import { GRID_CELL_HEIGHT } from "./config";
import type { DesignStrip, Group, Piece } from "./kumiko-core";

type Segment = {
	y1: number;
	y2: number;
	type: "notch" | "cut";
};

export interface GenerateGroupSVGOptions {
	group: Group | undefined;
	designStrips: DesignStrip[];
	bitSize: number;
	stockLength: number;
}

export function generateGroupSVG({
	group,
	designStrips,
	bitSize,
	stockLength,
}: GenerateGroupSVGOptions): string | null {
	if (!group) return null;

	const pieces: Piece[] = Array.from(group.pieces.values());
	if (pieces.length === 0) return null;

	const cutsByX = new Map<
		string,
		{
			x: number;
			segments: Segment[];
		}
	>();

	const addSegment = (
		x: number,
		y1: number,
		y2: number,
		type: Segment["type"],
	) => {
		const key = x.toFixed(3);
		let entry = cutsByX.get(key);
		if (!entry) {
			entry = { x, segments: [] };
			cutsByX.set(key, entry);
		}
		entry.segments.push({ y1, y2, type });
	};

	const rowMap = new Map<number, Piece[]>();
	for (const piece of pieces) {
		const rowIndex = piece.rowIndex;
		if (!rowMap.has(rowIndex)) {
			rowMap.set(rowIndex, []);
		}
		rowMap.get(rowIndex)?.push(piece);
	}

	for (const [rowIndex, rowPieces] of rowMap) {
		if (rowPieces.length === 0) continue;

		rowPieces.sort((a, b) => a.x - b.x);

		const rowY1 = rowIndex * GRID_CELL_HEIGHT;
		const rowY2 = rowY1 + GRID_CELL_HEIGHT;

		let boundaryX = 0;

		for (const piece of rowPieces) {
			const strip = designStrips.find((s) => s.id === piece.lineId);
			if (!strip) continue;

			const stripLength = strip.lengthMM;

			const stripStartCutX = boundaryX;
			const stripEndCutX = boundaryX + stripLength + bitSize;

			addSegment(stripStartCutX, rowY1, rowY2, "cut");
			addSegment(stripEndCutX, rowY1, rowY2, "cut");

			const leftFaceX = stripStartCutX + bitSize / 2;

			for (const notch of strip.notches) {
				const notchX = leftFaceX + notch.dist;
				addSegment(notchX, rowY1, rowY2, "notch");
			}

			boundaryX = stripEndCutX;
		}
	}

	if (cutsByX.size === 0) {
		return null;
	}

	const mergedLines: {
		x: number;
		y1: number;
		y2: number;
		type: Segment["type"];
	}[] = [];
	const EPS = 1e-3;

	for (const { x, segments } of cutsByX.values()) {
		if (segments.length === 0) continue;

		const segmentsByType: Record<Segment["type"], Segment[]> = {
			notch: [],
			cut: [],
		};

		for (const seg of segments) {
			const normalized =
				seg.y1 <= seg.y2
					? seg
					: {
							y1: seg.y2,
							y2: seg.y1,
							type: seg.type,
						};
			segmentsByType[seg.type].push(normalized);
		}

		(["notch", "cut"] as const).forEach((type) => {
			const typeSegments = segmentsByType[type].sort((a, b) => a.y1 - b.y1);

			let current: Segment | null = null;

			for (const seg of typeSegments) {
				if (!current) {
					current = { ...seg };
					continue;
				}

				if (seg.y1 <= current.y2 + EPS) {
					current.y2 = Math.max(current.y2, seg.y2);
				} else {
					mergedLines.push({ x, y1: current.y1, y2: current.y2, type });
					current = { ...seg };
				}
			}

			if (current) {
				mergedLines.push({ x, y1: current.y1, y2: current.y2, type });
			}
		});
	}

	if (mergedLines.length === 0) {
		return null;
	}

	const rowIndices = pieces.map((p) => p.rowIndex);
	const minRowIndex = Math.min(...rowIndices);
	const maxRowIndex = Math.max(...rowIndices);
	const globalMinY = minRowIndex * GRID_CELL_HEIGHT;
	const globalMaxY = (maxRowIndex + 1) * GRID_CELL_HEIGHT;

	for (const line of mergedLines) {
		line.y1 = globalMinY;
		line.y2 = globalMaxY;
	}

	const minX = 0;
	let maxX = 0;

	for (const line of mergedLines) {
		maxX = Math.max(maxX, line.x);
	}

	maxX = Math.max(maxX, stockLength);

	const minY = globalMinY;
	const maxY = globalMaxY;

	const viewBoxWidth = maxX - minX || 100;
	const viewBoxHeight = maxY - minY || 100;

	const mmToCm = (value: number) => value / 10;

	const widthMM = viewBoxWidth;
	const heightMM = viewBoxHeight;

	const widthCM = mmToCm(widthMM);
	const heightCM = mmToCm(heightMM);

	const CUT_STROKE = "#000000";
	const NOTCH_STROKE = "#808080";
	const BOUNDING_STROKE = "#E6E6E6";

	const offsetY = minY;

	const linesSvg = mergedLines
		.map((line) => {
			const stroke = line.type === "cut" ? CUT_STROKE : NOTCH_STROKE;
			const xCm = mmToCm(line.x);
			const y1Cm = mmToCm(line.y1 - offsetY);
			const y2Cm = mmToCm(line.y2 - offsetY);
			return `  <line x1="${xCm.toFixed(3)}" y1="${y1Cm.toFixed(
				3,
			)}" x2="${xCm.toFixed(3)}" y2="${y2Cm.toFixed(
				3,
			)}" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" />`;
		})
		.join("\n");

	const boxHeightMM = maxY - minY;
	const boxRect = `  <rect x="0" y="0" width="${mmToCm(stockLength).toFixed(
		3,
	)}" height="${mmToCm(boxHeightMM).toFixed(
		3,
	)}" fill="none" stroke="${BOUNDING_STROKE}" stroke-width="${mmToCm(
		0.5,
	).toFixed(3)}" />`;

	return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthCM.toFixed(
		3,
	)}cm" height="${heightCM.toFixed(
		3,
	)}cm" version="1.1" x="0cm" y="0cm" viewBox="0 0 ${widthCM.toFixed(
		3,
	)} ${heightCM.toFixed(3)}" xml:space="preserve">
${boxRect}
${linesSvg}
</svg>`;
}
