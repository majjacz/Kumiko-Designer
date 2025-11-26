import React from "react";
import { convertUnit, formatValue } from "./kumiko-core";

export interface ParamInputProps {
	label: string;
	id: string;
	mmValue: number;
	/**
	 * Called with the underlying value in millimeters whenever the input
	 * holds a valid number. Handles unit conversion internally.
	 */
	onChange: (mmValue: number) => void;
	displayUnit: "mm" | "in";
	precision?: number;
}

export function ParamInput({
	label,
	id,
	mmValue,
	onChange,
	displayUnit,
	precision,
}: ParamInputProps) {
	// Determine how many decimal places are shown in this field
	const decimals = precision != null ? precision : displayUnit === "mm" ? 1 : 3;

	const formatDisplayValue = React.useCallback(
		(valueMm: number): string => {
			if (precision != null) {
				return convertUnit(valueMm, "mm", displayUnit).toFixed(precision);
			}
			return formatValue(valueMm, displayUnit);
		},
		[precision, displayUnit],
	);

	// Local text state so the user can freely type without being
	// immediately clobbered by formatted output or NaN -> 0 coercion.
	const [inputValue, setInputValue] = React.useState<string>(() =>
		formatDisplayValue(mmValue),
	);
	const [isFocused, setIsFocused] = React.useState(false);

	// Track previous values to detect changes
	const [prevMmValue, setPrevMmValue] = React.useState(mmValue);
	const [prevDisplayUnit, setPrevDisplayUnit] = React.useState(displayUnit);
	const [prevPrecision, setPrevPrecision] = React.useState(precision);

	if (
		mmValue !== prevMmValue ||
		displayUnit !== prevDisplayUnit ||
		precision !== prevPrecision
	) {
		setPrevMmValue(mmValue);
		setPrevDisplayUnit(displayUnit);
		setPrevPrecision(precision);

		if (!isFocused) {
			setInputValue(formatDisplayValue(mmValue));
		}
	}

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const next = event.target.value;
		setInputValue(next);

		const parsed = parseFloat(next);
		if (Number.isNaN(parsed)) {
			// Allow intermediate states like "", "-", "0." without forcing 0
			return;
		}

		const mm = convertUnit(parsed, displayUnit, "mm");
		onChange(mm);
	};

	const handleFocus = () => {
		setIsFocused(true);
	};

	const handleBlur = () => {
		const parsed = parseFloat(inputValue);

		if (Number.isNaN(parsed)) {
			// Revert to the last valid value from props if the field is left invalid/empty
			setInputValue(formatDisplayValue(mmValue));
		} else {
			const mm = convertUnit(parsed, displayUnit, "mm");

			if (mm !== mmValue) {
				onChange(mm);
			}
		}

		setIsFocused(false);
	};

	// Step so the native arrows adjust the least significant displayed digit
	const step = 10 ** -decimals;

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-xs font-medium text-gray-300">
				{label}
			</label>
			<div className="flex items-center gap-2">
				<input
					id={id}
					type="number"
					value={inputValue}
					onChange={handleChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					step={step}
					className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100
						focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
						placeholder:text-gray-500
						transition-colors"
				/>
				<span className="text-xs text-gray-500 min-w-[24px]">
					{displayUnit}
				</span>
			</div>
		</div>
	);
}

export interface SimpleParamInputProps {
	label: string;
	id: string;
	value: number;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SimpleParamInput({
	label,
	id,
	value,
	onChange,
}: SimpleParamInputProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-xs font-medium text-gray-300">
				{label}
			</label>
			<input
				id={id}
				type="number"
				value={value}
				onChange={onChange}
				className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100
					focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
					transition-colors"
			/>
		</div>
	);
}
