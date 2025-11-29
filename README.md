# 🎋 Kumiko Designer

> *A client-side web app for designing traditional Japanese Kumiko lattice patterns and generating CNC-ready layouts. Crafted entirely by LLMs—because even robots appreciate the art of woodworking.* 🤖🪚

![Made with AI](https://img.shields.io/badge/Made%20with-AI%20%F0%9F%A4%96-blueviolet)
![React 19](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![Vite 7](https://img.shields.io/badge/Vite-7-646cff)

## ✨ What is Kumiko?

[Kumiko](https://en.wikipedia.org/wiki/Kumiko_(woodworking)) is a traditional Japanese woodworking technique where intricate geometric patterns are created by interlocking small wooden pieces—no nails, no glue, just pure satisfying geometry. 

This app helps you:

1. **🎨 Design** – Draw patterns on an interactive grid with intuitive click-and-drag
2. **⚙️ Process** – Automatically detect unique strips, calculate notches, and track intersections
3. **📐 Layout** – Group strips and arrange them for efficient CNC cutting
4. **📦 Export** – Generate SVG files ready for your CNC machine

## 🤖 Wait, LLM Generated?

Yep! This entire codebase was generated through conversations with AI assistants. Every component, every hook, every pixel of that satisfying dark mode UI—all prompted into existence. The humans just provided the vision, the domain knowledge, and the occasional "no, that's still broken" feedback.

Is it perfect? No. Is it functional? Surprisingly yes! Is it a testament to the weird future we're living in? Absolutely.

*Yes, even this README was written by an LLM. It's LLMs all the way down.* 🐢

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Start development server (port 3000)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm serve
```

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests with Playwright
pnpm test:e2e

# Run E2E tests with interactive UI
pnpm test:e2e:ui
```

## 🛠️ Tech Stack

| What | Why |
|------|-----|
| **React 19** | Because we like living on the edge |
| **TanStack Start** | File-based routing that just works™ |
| **TypeScript** | Types make the robots happy |
| **Vite 7** | Fast builds go brrr |
| **Tailwind CSS 4** | Utility-first styling for the win |
| **Biome** | Linting and formatting without the drama |
| **Vitest** | Unit testing at Vite speed |
| **Playwright** | E2E tests that actually work |
| **d3-zoom/d3-selection** | Smooth zoom and pan magic |

## 📁 Project Structure

```
src/
├── components/        # React components
│   ├── kumiko/       # Kumiko-specific components
│   └── ui/           # Generic UI components
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── lib/
│   └── kumiko/       # Core domain logic
│       ├── types.ts          # Data structures
│       ├── geometry.ts       # Math stuff
│       ├── kumiko-design-logic.ts  # Design computations
│       └── kumiko-svg-export.ts    # SVG generation
├── routes/           # TanStack Router pages
└── styles.css        # Global styles
```

## 🎯 Key Concepts

- **Grid & Lines** – Your design canvas where the magic happens
- **Intersections** – Where two lines cross (with configurable over/under)
- **Design Strips** – Physical wood pieces with calculated notches
- **Layout Groups** – Organized strips ready for CNC cutting

## 🔧 Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Unit tests
pnpm test:e2e     # E2E tests
pnpm check        # Biome lint + format check
pnpm format       # Auto-format code
pnpm lint         # Lint only
```

## 📜 License

MIT – Do whatever you want with it. The robots don't mind.

---

<p align="center">
  <i>Made with 🤖 + ☕ + occasional human supervision</i>
</p>

