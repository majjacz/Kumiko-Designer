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
- **Build Tool:** Vite
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Linting/Formatting:** Biome
- **Package Manager:** pnpm

## Project Structure
- `src/lib/kumiko/`: Core domain logic (geometry, grid, layout algorithms).
  - `kumiko-core.ts`: Core data structures (`Point`, `Line`, `DesignStrip`, `Notch`).
  - `kumiko-grid-designer.tsx`: Grid editor logic.
  - `kumiko-layout-editor.tsx`: Layout editor logic.
- `src/routes/`: Application routes and UI components.
  - `__root.tsx`: Root layout.
  - `index.tsx`: Main application entry.
  - `-components/`: Shared UI components (e.g., `KumikoUI.tsx`).
- `tests/`: End-to-End tests using Playwright.
- `public/`: Static assets and templates.

## Key Concepts
- **Grid & Lines:** The design is based on a grid where lines are drawn.
- **DesignStrip:** A physical strip of wood derived from a grid line.
  - `id`: Geometry-derived identifier (canonical for layout/export).
  - `sourceLineId`: Reference to the original grid line (for UI highlighting).
  - `notches`: Calculated intersections where strips cross.
- **Layout:** Strips are grouped by length and notch pattern to optimize cutting.

## Development Guidelines
- **Client-Only:** The app runs entirely in the browser. No server-side logic.
- **Stability:** The project is in early stages. Breaking changes are acceptable if they improve the architecture or features.
- **Code Style:** Follow Biome configuration (`biome.json`). Run `pnpm format` and `pnpm lint`.
- **Testing:**
  - Run unit tests: `pnpm test`
  - Run E2E tests: `pnpm test:e2e`

## Commands
- `pnpm dev`: Start development server.
- `pnpm build`: Build for production.
- `pnpm test`: Run unit tests.
- `pnpm check`: Run Biome check (lint + format).
