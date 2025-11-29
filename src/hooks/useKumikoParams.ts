import { useCallback, useMemo, useState } from "react";
import {
	DEFAULT_BIT_SIZE,
	DEFAULT_CUT_DEPTH,
	DEFAULT_GRID_CELL_SIZE,
	DEFAULT_HALF_CUT_DEPTH,
	DEFAULT_STOCK_LENGTH,
	DEFAULT_UNITS,
} from "../lib/kumiko";

export function useKumikoParams() {
	const [units, setUnits] = useState<"mm" | "in">(DEFAULT_UNITS);
	// Parameters (stored internally in mm)
	const [bitSize, setBitSize] = useState(DEFAULT_BIT_SIZE);
	const [cutDepth, setCutDepth] = useState(DEFAULT_CUT_DEPTH);
	const [halfCutDepth, setHalfCutDepth] = useState(DEFAULT_HALF_CUT_DEPTH);
	// Physical size of one grid cell in mm (determines design scale)
	const [gridCellSize, setGridCellSize] = useState(DEFAULT_GRID_CELL_SIZE);
	// stockLength is the physical board/stock length used in layout & SVG
	const [stockLength, setStockLength] = useState(DEFAULT_STOCK_LENGTH);

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
