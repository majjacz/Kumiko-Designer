import { INCH_TO_MM, MM_TO_INCH } from "./config";

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
