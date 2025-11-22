import { useCallback, useMemo, useState } from "react";

export interface KumikoParams {
	units: "mm" | "in";
	bitSize: number;
	cutDepth: number;
	halfCutDepth: number;
	gridCellSize: number;
	stockLength: number;
}

export interface KumikoParamsActions {
	setUnits: (units: "mm" | "in") => void;
	setBitSize: (size: number) => void;
	setCutDepth: (depth: number) => void;
	setHalfCutDepth: (depth: number) => void;
	setGridCellSize: (size: number) => void;
	setStockLength: (length: number) => void;
	toggleUnits: () => void;
	handleParamChange: (
		setter: (value: number) => void,
	) => (mmValue: number) => void;
	handleHalfCutParamChange: (
		setter: (value: number) => void,
	) => (mmValue: number) => void;
}

export function useKumikoParams() {
	const [units, setUnits] = useState<"mm" | "in">("mm");
	// Parameters (stored internally in mm)
	const [bitSize, setBitSize] = useState(6.35);
	const [cutDepth, setCutDepth] = useState(19);
	const [halfCutDepth, setHalfCutDepth] = useState(9.5);
	// Physical size of one grid cell in mm (determines design scale)
	const [gridCellSize, setGridCellSize] = useState(10);
	// stockLength is the physical board/stock length used in layout & SVG
	const [stockLength, setStockLength] = useState(600);

	const toggleUnits = useCallback(() => {
		setUnits((prev) => (prev === "mm" ? "in" : "mm"));
	}, []);

	const handleParamChange = useCallback(
		(setter: (value: number) => void) => (mmValue: number) => {
			setter(mmValue);
			if (setter === setCutDepth) {
				setHalfCutDepth(mmValue / 2);
			}
		},
		[],
	);

	const handleHalfCutParamChange = useCallback(
		(setter: (value: number) => void) => (mmValue: number) => {
			setter(mmValue);
		},
		[],
	);

	const params = useMemo(
		() => ({
			units,
			bitSize,
			cutDepth,
			halfCutDepth,
			gridCellSize,
			stockLength,
		}),
		[units, bitSize, cutDepth, halfCutDepth, gridCellSize, stockLength],
	);

	const actions = useMemo(
		() => ({
			setUnits,
			setBitSize,
			setCutDepth,
			setHalfCutDepth,
			setGridCellSize,
			setStockLength,
			toggleUnits,
			handleParamChange,
			handleHalfCutParamChange,
		}),
		[toggleUnits, handleParamChange, handleHalfCutParamChange],
	);

	return useMemo(
		() => ({
			params,
			actions,
		}),
		[params, actions],
	);
}
