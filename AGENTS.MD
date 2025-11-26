# Kumiko Designer - Agent Guide

## Project Overview
Kumiko Designer is a client-only web application for designing traditional Kumiko lattice patterns and producing CNC-ready layouts of the wood strips.

**Core Workflow:**
1. **Design:** Create patterns on an interactive grid.
2. **Process:** Detect unique wood strips, calculate notches and intersections.
3. **Layout:** Group strips and arrange them for efficient CNC cutting.
4. **Export:** Generate SVG files for CNC machines.

## Tech Stack
- **Framework:** React 19, TanStack Start, TanStack Router
- **Language:** TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Linting/Formatting:** Biome
- **Package Manager:** pnpm
- **Additional Libraries:** d3-zoom/d3-selection (zoom/pan), lucide-react (icons)

## Project Structure

### Core Domain Logic (`src/lib/kumiko/`)
- `kumiko-core.ts`: Core data structures (`Point`, `Line`, `DesignStrip`, `Notch`, `Intersection`, `Piece`, `Cut`, `Group`) and unit conversion utilities.
- `geometry.ts`: Geometry utilities (`findIntersection`, `computeLineOverlapForSingleLine`, `gcd`, `distancePointToSegment`).
- `kumiko-design-logic.ts`: Design computation functions (`computeIntersections`, `computeDesignStrips`, `computeLineOverlaps`, `normalizeLines`).
- `kumiko-grid-designer.tsx`: Grid editor component (`GridDesigner`, `GridDesignerConnected`).
- `kumiko-layout-editor.tsx`: Layout editor component (`LayoutEditor`, `LayoutEditorConnected`).
- `kumiko-params.tsx`: Parameter configuration UI (`ParamInput`).
- `kumiko-storage.ts`: Save/load design payloads (localStorage persistence).
- `kumiko-svg-export.ts`: Generate CNC-ready SVG output.
- `kumiko-templates.ts`: Template loading utilities.
- `config.ts`: Configuration constants (grid dimensions, zoom limits, default values).
- `index.ts`: Barrel export file for the kumiko library.

### Custom Hooks (`src/hooks/`)
- `useKumikoDesign.ts`: Manages design state (lines, intersections, design strips).
- `useKumikoLayout.ts`: Manages layout state (groups, pieces, cuts).
- `useKumikoParams.ts`: Manages parameter state (units, bit size, cut depth, grid cell size, stock length).
- `useZoomPan.ts`: D3-based zoom/pan behavior for the grid.
- `useGridCoordinates.ts`: Screen-to-grid coordinate transformation utilities.
- `useDesignPersistence.ts`: Save/load/export/import logic for designs.

### Context (`src/context/`)
- `KumikoContext.tsx`: Central state management via React Context.
  - `KumikoProvider`: Wraps the app and provides all state hooks.
  - `useKumiko()`: Hook to consume context values.
  - Exports `AppStep` type for workflow navigation.

### Components (`src/components/`)
- `kumiko/GridRenderer.tsx`: SVG rendering of the design grid, lines, intersections, and notches.

### Routes (`src/routes/`)
- `__root.tsx`: Root layout.
- `index.tsx`: Main application entry.
- `-components/KumikoUI.tsx`: Main UI component orchestrating the design workflow.

### Tests
- `src/**/*.test.ts`: Unit tests (colocated with source files).
- `tests/e2e/`: End-to-End tests using Playwright (`grid.spec.ts`, `layout.spec.ts`, `export.spec.ts`).

### Static Assets (`public/`)
- `templates/`: Design templates (JSON format).

## Key Concepts
- **Grid & Lines:** The design is based on a grid where lines are drawn.
- **Intersection:** Where two lines cross, with `line1Over` determining which strip is on top.
- **DesignStrip:** A physical strip of wood derived from a grid line.
  - `id`: Geometry-derived identifier (canonical for layout/export).
  - `sourceLineId`: Reference to the original grid line (for UI highlighting).
  - `displayCode`: Short, user-friendly code (e.g., 4-character base36) derived from geometry.
  - `notches`: Calculated intersections where strips cross.
- **Layout:** Strips are grouped (`Group`) and pieces (`Piece`) are placed for efficient CNC cutting.
- **Persistence:** Designs are saved as `SavedDesignPayload` (version 1) with lines, intersection states, groups, and view state.

## Development Guidelines
- **Client-Only:** The app runs entirely in the browser. No server-side logic.
- **Stability:** The project is in early stages. Breaking changes are acceptable if they improve the architecture or features.
- **Code Style:** Follow Biome configuration (`biome.json`). Run `pnpm format` and `pnpm lint`.
- **Testing:**
  - Run unit tests: `pnpm test`
  - Run E2E tests: `pnpm test:e2e`
  - Run E2E with UI: `pnpm test:e2e:ui`

## Hook Return Type Convention

Custom hooks that manage state should follow a consistent return pattern:

```typescript
// For hooks with both state and actions
return {
  state: { /* reactive state values */ },
  actions: { /* functions to mutate state */ }
};

// For hooks with only actions (utility functions)
return { functionA, functionB };
```

**Examples:**
- `useKumikoDesign` → `{ state, actions }` - manages lines, intersections
- `useKumikoLayout` → `{ state, actions }` - manages groups, pieces
- `useKumikoParams` → `{ params, actions }` - manages parameters
- `useZoomPan` → `{ state, actions }` - manages zoom/pan state
- `useDesignPersistence` → `{ state, actions }` - manages persistence
- `useGridCoordinates` → `{ screenToGrid, gridToSvg }` - pure utilities, no state

Hooks that accept an optional `onNotify` callback can display user-facing notifications:
```typescript
interface UseMyHookOptions {
  onNotify?: (type: NotificationType, message: string) => void;
}
```

## Error Handling

- **Toast Notifications:** User-facing errors use the toast system via `useToast()` hook or `onNotify` callback.
- **Error Boundaries:** Major UI sections are wrapped with `<ErrorBoundary>` components.
- **Typed Errors:** Use error classes from `src/lib/errors.ts` for structured error handling.

## Commands
- `pnpm dev`: Start development server (port 3000).
- `pnpm build`: Build for production.
- `pnpm serve`: Preview production build.
- `pnpm test`: Run unit tests.
- `pnpm test:e2e`: Run E2E tests.
- `pnpm test:e2e:ui`: Run E2E tests with interactive UI.
- `pnpm check`: Run Biome check (lint + format).
