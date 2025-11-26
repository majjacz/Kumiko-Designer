# Kumiko Designer - Refactoring Plan

This document tracks the implementation of codebase improvements for better maintainability and extensibility.

---

## High Priority (Low Risk, Immediate Value)

### 1. Remove Unused Code

- [x] **1.1** Remove unused error classes from `src/lib/errors.ts`:
  - `KumikoError` (base class)
  - `DesignValidationError`
  - `ImportError`
  - `ExportError`
  - `StorageError`
  - `TemplateError`
  - `LayoutError`

- [x] **1.2** Remove unused `SimpleParamInput` component from `src/lib/kumiko/kumiko-params.tsx`

- [x] **1.3** Remove `hasDoubleSidedStrips` function from `src/lib/kumiko/kumiko-svg-export.ts` (only used in tests)

### 2. Fix Documentation

- [x] **2.1** Update `AGENTS.MD` to replace incorrect `kumiko-core.ts` reference with accurate file descriptions (`types.ts` and `utils.ts`)

### 3. Fix Template Typo

- [x] **3.1** Rename template from `temlate-1` to `template-1`:
  - Update `src/lib/kumiko/kumiko-templates.ts`
  - Rename `public/templates/temlate-1.json` to `public/templates/template-1.json`

---

## Medium Priority (Some Refactoring Required)

### 4. Clean Up Exports

- [x] **4.1** Remove `computeLineOverlapForSingleLine` from public exports in `src/lib/kumiko/index.ts` (internal implementation detail)

- [x] **4.2** Remove redundant `GridViewState` re-export from `src/lib/kumiko/kumiko-storage.ts`

- [x] **4.3** Remove backward compatibility re-exports from `src/lib/kumiko/kumiko-layout-editor.tsx`:
  - `GRID_CELL_HEIGHT`
  - `GRID_MARGIN`
  - Update any tests to import from correct location

### 5. Create Shared Type Alias

- [x] **5.1** Create `NotifyCallback` type alias in `src/lib/errors.ts`:
  ```typescript
  export type NotifyCallback = (type: NotificationType, message: string) => void;
  ```

- [x] **5.2** Update usages across the codebase:
  - `src/hooks/useKumikoLayout.ts`
  - `src/hooks/useDesignPersistence.ts`
  - `src/lib/kumiko/kumiko-layout-editor.tsx`
  - `src/components/kumiko/LayoutCanvas.tsx`

### 6. Remove Deprecated Patterns

- [x] **6.1** Remove deprecated `DEFAULT_ZOOM` export from `useZoomPan.ts` return value
- [x] **6.2** Update `kumiko-grid-designer.tsx` to use `state.zoom` or import `DEFAULT_ZOOM` from config

---

## Lower Priority (Larger Refactoring)

### 7. Move UI Components from lib to components

- [x] **7.1** Move `src/lib/kumiko/kumiko-grid-designer.tsx` to `src/components/kumiko/GridDesigner.tsx`
- [x] **7.2** Move `src/lib/kumiko/kumiko-layout-editor.tsx` to `src/components/kumiko/LayoutEditor.tsx`
- [x] **7.3** Move `src/lib/kumiko/kumiko-params.tsx` to `src/components/kumiko/ParamInput.tsx`
- [x] **7.4** Update all imports throughout the codebase
- [x] **7.5** Update barrel exports in `src/lib/kumiko/index.ts`

### 8. Improve Context Organization

- [ ] **8.1** Split `KumikoContextValue` interface into domain-specific interfaces:
  - `DesignContextValue`
  - `LayoutContextValue`
  - `ParamsContextValue`
  - `PersistenceContextValue`

- [ ] **8.2** Consider creating separate context hooks for each domain

### 9. Improve D3 Type Safety

- [ ] **9.1** Create proper type declarations for D3 zoom behavior interactions
- [ ] **9.2** Replace `any` casts with specific type assertions in `useZoomPan.ts`

---

## Validation Checklist

After completing changes:

- [x] Run `pnpm check` - Biome lint and format passes
- [x] Run `pnpm test` - All unit tests pass
- [x] Run `pnpm build` - Production build succeeds
- [ ] Manual testing - App functions correctly in browser

---

## Notes

- Each checkbox should be checked off as the corresponding change is implemented and tested
- Changes within the same priority level can generally be done independently
- Lower priority items may require updates to the barrel export and multiple import statements
