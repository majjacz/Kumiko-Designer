import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKumikoLayout } from "./useKumikoLayout";

describe("useKumikoLayout", () => {
	it("should initialize with default group", () => {
		const { result } = renderHook(() => useKumikoLayout());

		expect(result.current.state.groups.size).toBe(1);
		expect(result.current.state.activeGroupId).toBe("group1");
		expect(result.current.state.activeGroup).toBeDefined();
		expect(result.current.state.activeGroup?.name).toBe("Default Group");
	});

	it("should add a new group", () => {
		const { result } = renderHook(() => useKumikoLayout());

		act(() => {
			result.current.actions.addNewGroup();
		});

		expect(result.current.state.groups.size).toBe(2);
		expect(result.current.state.activeGroupId).not.toBe("group1");
	});

	it("should rename a group", () => {
		const { result } = renderHook(() => useKumikoLayout());
		const groupId = "group1";

		act(() => {
			result.current.actions.renameGroup(groupId, "New Name");
		});

		expect(result.current.state.groups.get(groupId)?.name).toBe("New Name");
	});

	it("should delete a group", () => {
		const { result } = renderHook(() => useKumikoLayout());

		// Add a second group first
		act(() => {
			result.current.actions.addNewGroup();
		});
		expect(result.current.state.groups.size).toBe(2);
		const newGroupId = result.current.state.activeGroupId;

		act(() => {
			result.current.actions.deleteGroup(newGroupId);
		});

		expect(result.current.state.groups.size).toBe(1);
		expect(result.current.state.activeGroupId).toBe("group1");
	});

	it("should not delete the last group", () => {
		const { result } = renderHook(() => useKumikoLayout());

		// Mock alert
		global.alert = vi.fn();

		act(() => {
			result.current.actions.deleteGroup("group1");
		});

		expect(result.current.state.groups.size).toBe(1);
	});

	it("should add a piece to layout", () => {
		const { result } = renderHook(() => useKumikoLayout());

		// Select a piece first
		act(() => {
			result.current.actions.setSelectedPieceId("some-strip-id");
		});

		// Click on layout to place it
		act(() => {
			result.current.actions.handleLayoutClick({ x: 100, y: 100 }, 0);
		});

		const group = result.current.state.activeGroup;
		expect(group?.pieces.size).toBe(1);
		const piece = Array.from(group?.pieces.values() ?? [])[0];
		expect(piece.lineId).toBe("some-strip-id");
		expect(piece.x).toBe(100);
		expect(piece.y).toBe(100);
	});

	it("should delete a layout item", () => {
		const { result } = renderHook(() => useKumikoLayout());

		// Add a piece
		act(() => {
			result.current.actions.setSelectedPieceId("some-strip-id");
			result.current.actions.handleLayoutClick({ x: 100, y: 100 }, 0);
		});

		const group = result.current.state.activeGroup;
		const pieceId = Array.from(group?.pieces.keys() ?? [])[0];

		act(() => {
			result.current.actions.deleteLayoutItem("piece", pieceId);
		});

		expect(result.current.state.activeGroup?.pieces.size).toBe(0);
	});
});
