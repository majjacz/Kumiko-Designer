export interface Point {
	x: number;
	y: number;
}

export interface Line {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Intersection {
	id: string;
	x: number;
	y: number;
	line1Id: string;
	line2Id: string;
	line1Over: boolean;
}

export interface Notch {
	id: string;
	otherLineId: string;
	dist: number;
	fromTop: boolean;
}

export interface DesignStrip extends Line {
	lengthMM: number;
	notches: Notch[];
}

export interface Piece {
	id: string;
	lineId: string;
	x: number;
	y: number;
	rotation: number;
}

export interface Cut {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Group {
	id: string;
	name: string;
	pieces: Map<string, Piece>;
	fullCuts: Map<string, Cut>;
}

export const INCH_TO_MM = 25.4;
export const MM_TO_INCH = 1 / INCH_TO_MM;

export const convertUnit = (
	value: number,
	fromUnit: "mm" | "in",
	toUnit: "mm" | "in",
): number => {
	if (fromUnit === toUnit || !value) return value;
	if (fromUnit === "mm" && toUnit === "in") return value * MM_TO_INCH;
	if (fromUnit === "in" && toUnit === "mm") return value * INCH_TO_MM;
	return value;
};

export const formatValue = (
	mmValue: number,
	displayUnit: "mm" | "in",
): string => {
	const value = convertUnit(mmValue, "mm", displayUnit);
	return value.toFixed(displayUnit === "mm" ? 1 : 3);
};

export const newId = (): string =>
	`id_${Math.random().toString(36).substr(2, 9)}`;

export const findIntersection = (line1: Line, line2: Line): Point | null => {
	const { x1, y1, x2, y2 } = line1;
	const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

	const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	if (den === 0) return null;

	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
	const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
		return {
			x: Math.round(x1 + t * (x2 - x1)),
			y: Math.round(y1 + t * (y2 - y1)),
		};
	}

	return null;
};
