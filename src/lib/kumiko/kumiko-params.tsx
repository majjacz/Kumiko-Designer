import React from "react";
import { convertUnit, formatValue } from "./kumiko-core";

export interface ParamInputProps {
	label: string;
	id: string;
	mmValue: number;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
	const displayValue =
		precision != null
			? convertUnit(mmValue, "mm", displayUnit).toFixed(precision)
			: formatValue(mmValue, displayUnit);

	return (
		<div className="flex flex-col space-y-1">
			<label
				htmlFor={id}
				className="text-xs font-semibold text-gray-400 uppercase tracking-wide"
			>
				{label}
			</label>
			<div className="flex items-center space-x-2">
				<input
					id={id}
					type="number"
					value={displayValue}
					onChange={onChange}
					onBlur={onChange}
					className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<span className="text-xs text-gray-500">{displayUnit}</span>
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
		<div className="flex flex-col space-y-1">
			<label
				htmlFor={id}
				className="text-xs font-semibold text-gray-400 uppercase tracking-wide"
			>
				{label}
			</label>
			<input
				id={id}
				type="number"
				value={value}
				onChange={onChange}
				className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
	);
}
