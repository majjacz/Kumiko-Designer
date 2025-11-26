# Kumiko Designer - Refactoring Plan

This document outlines planned refactoring tasks to improve code extendability and maintainability without changing user-facing functionality.

## High Priority (Quick Wins)

### 1. Consolidate Type Definitions
- [x] Move `GridViewState` from `kumiko-grid-designer.tsx` to `kumiko-core.ts` (keep `kumiko-storage.ts` import)
- [x] Remove duplicate `NamedDesignSummary` from `KumikoUI.tsx`, import from `kumiko-storage.ts`
- [x] Audit all files for other duplicate type definitions

### 2. Extract Payload Serialization
- [x] Create `createDesignPayload()` function in `kumiko-storage.ts`
- [x] Refactor autosave effect in `index.tsx` to use new function
- [x] Refactor `handleSaveAs()` to use new function
- [x] Refactor `handleExportJSON()` to use new function

### 3. Add Barrel Exports
- [x] Create `src/lib/kumiko/index.ts` barrel file
- [x] Export all public types and functions
- [x] Update imports in hooks to use barrel
- [x] Update imports in components to use barrel
- [x] Update imports in routes to use barrel

### 4. Extract Magic Numbers into Configuration
- [x] Create `src/lib/kumiko/config.ts`
- [x] Move grid constants (`GRID_EXTENT_CELLS`, `GRID_CELL_HEIGHT`, `GRID_MARGIN`)
- [x] Move zoom constants (`DEFAULT_ZOOM`, `MIN_ZOOM`, `MAX_ZOOM`)
- [x] Move precision constants (`EDGE_NOTCH_EPS`, `EPSILON`)
- [x] Move default parameter values (`bitSize`, `cutDepth`, `gridCellSize`, `stockLength`)
- [x] Update all files to import from config

---

## Medium Priority (Moderate Effort)

### 5. Extract Geometry Utilities
- [x] Create `src/lib/kumiko/geometry.ts`
- [x] Move `findIntersection()` from `kumiko-core.ts`
- [x] Move `computeLineOverlapForSingleLine()` from `kumiko-design-logic.ts`
- [x] Move `gcd()` from `kumiko-design-logic.ts`
- [x] Extract `distancePointToSegment()` from `GridRenderer.tsx`
- [x] Add unit tests for geometry functions
- [x] Update imports across codebase

### 6. Extract Download/Export Utilities
- [x] Create `src/lib/utils/download.ts`
- [x] Implement `downloadBlob(blob: Blob, filename: string)`
- [x] Implement `downloadSVG(svg: string, filename: string)`
- [x] Implement `downloadJSON(data: unknown, filename: string)`
- [x] Refactor `downloadSVG` in `index.tsx`
- [x] Refactor `downloadAllGroupsSVG` in `index.tsx`
- [x] Refactor `handleExportJSON` in `index.tsx`

### 7. Fix Piece.rotation Semantics
- [x] Add `rowIndex` field to `Piece` interface in `kumiko-core.ts`
- [x] Update `useKumikoLayout.ts` to use `rowIndex` instead of `rotation`
- [x] Update `kumiko-layout-editor.tsx` to use `rowIndex`
- [x] Update `kumiko-svg-export.ts` to use `rowIndex`
- [x] Update `kumiko-storage.ts` payload serialization
- [x] ~~Add migration for existing saved designs~~ (skipped - breaking changes acceptable)
- [x] Remove `rotation` field (replaced with `rowIndex`)

---

## Lower Priority (Larger Refactors)

### 8. Split Large Components

#### 8a. Split LayoutEditor (998 lines)
- [x] Extract `StripBank.tsx` component (~150 lines)
- [ ] Extract `LayoutCanvas.tsx` component (~200 lines)
- [ ] Extract `GroupToolbar.tsx` component (~100 lines)
- [ ] Extract `StripPreviewSVG.tsx` component (~80 lines)
- [ ] Extract `RowLengthIndicator.tsx` component
- [ ] Update `kumiko-layout-editor.tsx` to compose extracted components

#### 8b. Split GridRenderer (532 lines)
- [x] Extract `IntersectionMarker.tsx` component (~150 lines)
- [ ] Extract `LineRenderer.tsx` component (~100 lines)
- [ ] Extract `DragPreview.tsx` component (~50 lines)
- [ ] Extract `GridBackground.tsx` component
- [ ] Update `GridRenderer.tsx` to compose extracted components

#### 8c. Split index.tsx (531 lines)
- [ ] Extract `useDesignPersistence.ts` hook (save/load/export logic)
- [ ] Extract `useDesignImportExport.ts` hook (JSON import/export)
- [ ] Simplify `App` component to pure orchestration

### 9. Introduce KumikoContext
- [ ] Create `src/context/KumikoContext.tsx`
- [ ] Define `KumikoContextValue` interface
- [ ] Create `KumikoProvider` component
- [ ] Create `useKumiko()` hook for consuming context
- [ ] Migrate `index.tsx` to use provider
- [ ] Update `GridDesigner` to consume context (reduce props)
- [ ] Update `LayoutEditor` to consume context (reduce props)
- [ ] Update `KumikoSidebarParams` to consume context

### 10. Add Error Handling Infrastructure
- [ ] Create `src/lib/errors.ts` with typed error classes
- [ ] Create `src/components/ui/Toast.tsx` notification component
- [ ] Create `src/context/ToastContext.tsx` for toast state
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Replace `console.warn` calls with user-facing notifications
- [ ] Add error boundaries around major sections

### 11. Standardize Hook Return Types
- [ ] Update `useZoomPan.ts` to return `{ state, actions }` shape
- [ ] Update `useGridCoordinates.ts` to return `{ state, actions }` shape (if applicable)
- [ ] Document hook return type convention in `AGENTS.MD`

### 12. Extract Notch Visualization
- [ ] Create `src/components/kumiko/NotchToggleMarker.tsx`
- [ ] Move notch badge/triangle rendering logic
- [ ] Move notch color determination logic
- [ ] Add props for customization (colors, sizes)
- [ ] Update `GridRenderer.tsx` to use new component

---

## Testing Checklist

After each refactoring task:
- [ ] Run `pnpm test` - all unit tests pass
- [ ] Run `pnpm test:e2e` - all E2E tests pass
- [ ] Run `pnpm check` - no lint/format errors
- [ ] Manual smoke test: create design, add lines, toggle intersections
- [ ] Manual smoke test: layout strips, export SVG
- [ ] Manual smoke test: save/load design

---

## Notes

- Each task should be a separate commit/PR for easy review
- Maintain backward compatibility with saved designs
- Update `AGENTS.MD` documentation after structural changes
- Add tests for any new utility functions
- After each numbered task is finshed and fully tested, create a commit with the new changes.
