import { useCallback, useMemo, useState } from "react";
import {
	type Cut,
	type Group,
	newId,
	type Piece,
	type Point,
} from "../lib/kumiko/kumiko-core";

export function useKumikoLayout() {
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
	const [hoveredStripId, setHoveredStripId] = useState<string | null>(null);

	const activeGroup = useMemo<Group | undefined>(
		() => groups.get(activeGroupId),
		[groups, activeGroupId],
	);

	const addNewGroup = useCallback(() => {
		const id = newId();
		setGroups((prev) => {
			const newGroup: Group = {
				id,
				name: `Group ${prev.size + 1}`,
				pieces: new Map<string, Piece>(),
				fullCuts: new Map<string, Cut>(),
			};
			return new Map(prev).set(id, newGroup);
		});
		setActiveGroupId(id);
	}, []);

	const deleteGroup = useCallback(
		(id: string) => {
			if (groups.size <= 1) {
				console.warn("Cannot delete the last group.");
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
		},
		[groups, activeGroupId],
	);

	const renameGroup = useCallback((id: string, newName: string) => {
		const trimmed = newName.trim();
		if (!trimmed) {
			return;
		}
		setGroups((prev) => {
			const next = new Map(prev);
			const group = next.get(id);
			if (group) {
				group.name = trimmed;
			}
			return next;
		});
	}, []);

	const handleLayoutClick = useCallback(
		(point: Point, rowIndex: number) => {
			const { x, y } = point;

			if (selectedPieceId && activeGroup) {
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
							rowIndex,
						});
					}
					return next;
				});
			}
		},
		[selectedPieceId, activeGroup, activeGroupId],
	);

	const deleteLayoutItem = useCallback(
		(_type: "piece", id: string) => {
			setGroups((prev) => {
				const next = new Map(prev);
				const group = next.get(activeGroupId);
				if (group) {
					group.pieces.delete(id);
				}
				return next;
			});
		},
		[activeGroupId],
	);

	const clearLayoutState = useCallback(() => {
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
	}, []);

	const actions = useMemo(
		() => ({
			setGroups,
			setActiveGroupId,
			setSelectedPieceId,
			setHoveredStripId,
			addNewGroup,
			deleteGroup,
			renameGroup,
			handleLayoutClick,
			deleteLayoutItem,
			clearLayoutState,
		}),
		[
			addNewGroup,
			deleteGroup,
			renameGroup,
			handleLayoutClick,
			deleteLayoutItem,
			clearLayoutState,
		],
	);

	const state = useMemo(
		() => ({
			groups,
			activeGroupId,
			selectedPieceId,
			hoveredStripId,
			activeGroup,
		}),
		[groups, activeGroupId, selectedPieceId, hoveredStripId, activeGroup],
	);

	return useMemo(
		() => ({
			state,
			actions,
		}),
		[state, actions],
	);
}
