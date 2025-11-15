import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Intersection, Line, Point } from "./kumiko-core";

/**
 * Kumiko Grid Designer - Rewritten for proper coordinate handling and drag-based interaction
 * 
 * Key features:
 * - Drag to draw lines (not click-click)
 * - Proper SVG coordinate transformation using getScreenCTM()
 * - Smooth pan/zoom with middle mouse or wheel
 * - Grid snapping for precise alignment
 */

export interface GridViewState {
  zoom: number;
  panX: number;
  panY: number;
  showNotchPositions: boolean;
  showHelpText: boolean;
  showLineIds: boolean;
}

export interface GridDesignerProps {
  lines: Map<string, Line>;
  intersections: Map<string, Intersection>;
  drawingLine: Point | null;
  onGridClick: (point: Point) => void;
  onCreateLine?: (start: Point, end: Point) => void;
  onToggleIntersection: (id: string) => void;
  onDragUpdate?: (start: Point, end: Point, isDeleting: boolean) => void;
  isDeleting?: boolean;
  bitSize: number;
  gridCellSize: number; // Physical size of one grid cell in mm
  hoveredStripId?: string | null;
  /** Optional externally-controlled view state (for persistence across reloads). */
  viewState?: GridViewState;
  /** Notify parent when view state changes so it can be persisted. */
  onViewStateChange?: (state: GridViewState) => void;
}

interface DragState {
  startPoint: Point;
  currentPoint: Point;
}

const DEFAULT_ZOOM = 40;
const MIN_ZOOM = DEFAULT_ZOOM / 8;
const MAX_ZOOM = DEFAULT_ZOOM * 8;
const GRID_EXTENT_CELLS = 1000; // Effective "infinite" grid extent in each direction

export function GridDesigner({
  lines,
  intersections,
  drawingLine,
  onGridClick,
  onCreateLine,
  onToggleIntersection,
  onDragUpdate,
  isDeleting = false,
  bitSize,
  gridCellSize,
  hoveredStripId,
  viewState,
  onViewStateChange,
}: GridDesignerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentGroupRef = useRef<SVGGElement | null>(null);

  // Viewport state
  const [zoom, setZoom] = useState(viewState?.zoom ?? DEFAULT_ZOOM);
  const [panX, setPanX] = useState(viewState?.panX ?? 0);
  const [panY, setPanY] = useState(viewState?.panY ?? 0);
  const [showNotchPositions, setShowNotchPositions] = useState(
    viewState?.showNotchPositions ?? true
  );
  const [showHelpText, setShowHelpText] = useState(viewState?.showHelpText ?? true);
  const [showLineIds, setShowLineIds] = useState(viewState?.showLineIds ?? true);

  // Interaction state
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // For the designer view, keep individual grid cells visually square.
  // Use a large fixed grid extent so users are not constrained by a small canvas.
  const cellSize = useMemo(
    () => gridCellSize,
    [gridCellSize]
  );

  const designWidth = useMemo(
    () => GRID_EXTENT_CELLS * cellSize,
    [cellSize]
  );

  const designHeight = useMemo(
    () => GRID_EXTENT_CELLS * cellSize,
    [cellSize]
  );


  /**
   * Convert screen coordinates to grid coordinates using proper SVG transformation
   * This uses SVG's built-in getScreenCTM() for accurate coordinate mapping
   */
  const screenToGrid = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;

      try {
        // Create SVG point for proper transformation
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;

        // Get the transformation matrix from screen to SVG coordinates
        const matrix = svg.getScreenCTM();
        if (!matrix) return null;

        // Transform screen coordinates to SVG coordinates
        const svgPt = pt.matrixTransform(matrix.inverse());

        // Convert SVG coordinates to grid coordinates using uniform cell size
        const gridX = svgPt.x / cellSize;
        const gridY = svgPt.y / cellSize;

        // Clamp to grid bounds (treat grid as a large fixed extent)
        if (
          gridX < 0 ||
          gridX > GRID_EXTENT_CELLS ||
          gridY < 0 ||
          gridY > GRID_EXTENT_CELLS
        ) {
          return null;
        }

        // Snap to nearest grid point
        return {
          x: Math.round(gridX),
          y: Math.round(gridY),
        };
      } catch (error) {
        console.error("Error converting coordinates:", error);
        return null;
      }
    },
    [cellSize]
  );

  /**
   * Convert grid coordinates to SVG viewBox coordinates
   */
  const gridToSvg = useCallback(
    (point: Point): { x: number; y: number } => ({
      x: point.x * cellSize,
      y: point.y * cellSize,
    }),
    [cellSize]
  );

  /**
   * Handle mouse down - start drawing or panning
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        // Middle mouse button - start panning
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX,
          panY,
        };
        return;
      }

      if (e.button === 0) {
        // Left mouse button - start potential drag for line drawing
        const gridPt = screenToGrid(e.clientX, e.clientY);
        if (gridPt) {
          setDragState({
            startPoint: gridPt,
            currentPoint: gridPt,
          });
        }
      }
    },
    [screenToGrid, panX, panY]
  );

  /**
   * Handle mouse move - update drag state or pan
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning && panStartRef.current) {
        // Update pan position
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        
        // Convert screen delta to SVG delta (accounting for zoom)
        const svg = svgRef.current;
        if (svg) {
          const matrix = svg.getScreenCTM();
          if (matrix) {
            const newPanX = panStartRef.current.panX + dx / matrix.a;
            const newPanY = panStartRef.current.panY + dy / matrix.d;
            setPanX(newPanX);
            setPanY(newPanY);

            if (onViewStateChange) {
              onViewStateChange({
                zoom,
                panX: newPanX,
                panY: newPanY,
                showNotchPositions,
                showHelpText,
                showLineIds,
              });
            }
          }
        }
        return;
      }

      const gridPt = screenToGrid(e.clientX, e.clientY);
      
      if (dragState) {
        // Update drag end point
        if (gridPt) {
          setDragState({
            ...dragState,
            currentPoint: gridPt,
          });
          // Notify parent about drag update for overlap detection
          if (onDragUpdate) {
            onDragUpdate(dragState.startPoint, gridPt, false);
          }
        }
      } else {
        // Update hover point
        setHoverPoint(gridPt);
      }
    },
    [
      isPanning,
      dragState,
      screenToGrid,
      onDragUpdate,
      onViewStateChange,
      zoom,
      showNotchPositions,
      showHelpText,
      showLineIds,
    ]
  );

  /**
   * Handle mouse up - complete drawing or panning
   */
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        // End panning
        setIsPanning(false);
        panStartRef.current = null;
        return;
      }

      if (e.button === 0 && dragState) {
        const { startPoint, currentPoint } = dragState;
        const isDragged = startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y;
        
        if (isDragged) {
          // User dragged - create a complete line
          if (drawingLine) {
            // Complete existing drawing line
            onGridClick(currentPoint);
          } else if (onCreateLine) {
            // Use dedicated callback for creating complete line in one action
            onCreateLine(startPoint, currentPoint);
          } else {
            // Fallback: simulate two clicks (may not work due to state batching)
            onGridClick(startPoint);
            onGridClick(currentPoint);
          }
        } else {
          // Single click without drag
          onGridClick(startPoint);
        }

        setDragState(null);
      }
    },
    [dragState, drawingLine, onGridClick, onCreateLine]
  );

  /**
   * Handle mouse leave - clean up hover state
   */
  const handleMouseLeave = useCallback(() => {
    setHoverPoint(null);
  }, []);

  /**
   * Handle wheel - zoom in/out
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      // Always prevent browser zoom/scroll when interacting with the designer
      e.preventDefault();

      const svg = svgRef.current;
      if (!svg) return;

      const matrix = svg.getScreenCTM();
      if (!matrix) return;

            // On macOS trackpads, pinch-to-zoom is reported as a wheel event with ctrlKey.
            // Also treat Cmd+scroll (metaKey) as a zoom gesture inside the designer.
            const isPinchGesture = e.ctrlKey || e.metaKey;
      
            if (isPinchGesture) {
              // Zoom about the center of the current view (keep view center fixed)
              const zoomFactor = Math.exp(-e.deltaY * 0.001);
              const unclampedZoom = zoom * zoomFactor;
              const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, unclampedZoom));
      
              if (newZoom === zoom) return;
      
              // Current view center in world coordinates
              const viewWidth = designWidth / zoom;
              const viewHeight = designHeight / zoom;
              const centerX = panX + viewWidth / 2;
              const centerY = panY + viewHeight / 2;
      
              // New pan so the same world center stays centered after zoom
              const newViewWidth = designWidth / newZoom;
              const newViewHeight = designHeight / newZoom;
      
              const newPanX = centerX - newViewWidth / 2;
              const newPanY = centerY - newViewHeight / 2;
      
              setZoom(newZoom);
              setPanX(newPanX);
              setPanY(newPanY);
      
              if (onViewStateChange) {
                onViewStateChange({
                  zoom: newZoom,
                  panX: newPanX,
                  panY: newPanY,
                  showNotchPositions,
                  showHelpText,
                  showLineIds,
                });
              }
      
              return;
            }

      // Two-finger scroll / mouse wheel pans the canvas in SVG space
      const dx = e.deltaX / matrix.a;
      const dy = e.deltaY / matrix.d;

      // Invert deltas so content follows the gesture direction like a map
      const newPanX = panX - dx;
      const newPanY = panY - dy;

      setPanX(newPanX);
      setPanY(newPanY);

      if (onViewStateChange) {
        onViewStateChange({
          zoom,
          panX: newPanX,
          panY: newPanY,
          showNotchPositions,
          showHelpText,
          showLineIds,
        });
      }
    },
    [zoom, panX, panY, designWidth, designHeight, onViewStateChange, showNotchPositions, showHelpText, showLineIds]
  );

  /**
   * Reset view (Fit)
   *
   * - If there is a design, find its bounding box and fit it into the viewport.
   * - If there is no design (no lines), center the grid at DEFAULT_ZOOM.
   */
  const resetView = useCallback(() => {
    const svg = svgRef.current;

    // Helper: simple centered default when we can't compute a fit.
    const applyDefaultCenteredView = () => {
      const nextZoom = DEFAULT_ZOOM;
      const viewWidth = designWidth / nextZoom;
      const viewHeight = designHeight / nextZoom;

      // Center the viewBox over the entire grid
      const nextPanX = viewWidth / 2 - designWidth / 2;
      const nextPanY = viewHeight / 2 - designHeight / 2;

      setZoom(nextZoom);
      setPanX(nextPanX);
      setPanY(nextPanY);

      if (onViewStateChange) {
        onViewStateChange({
          zoom: nextZoom,
          panX: nextPanX,
          panY: nextPanY,
          showNotchPositions,
          showHelpText,
          showLineIds,
        });
      }
    };

    const lineArray = Array.from(lines.values());
    if (!svg || lineArray.length === 0) {
      applyDefaultCenteredView();
      return;
    }

    // Compute design-space bounding box of all line endpoints (in grid coordinates).
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const line of lineArray) {
      minX = Math.min(minX, line.x1, line.x2);
      maxX = Math.max(maxX, line.x1, line.x2);
      minY = Math.min(minY, line.y1, line.y2);
      maxY = Math.max(maxY, line.y1, line.y2);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      applyDefaultCenteredView();
      return;
    }

    // Ensure non-degenerate dimensions and add a small margin (in cells).
    const paddingCells = 1;
    const widthCells = Math.max(maxX - minX, 1) + paddingCells * 2;
    const heightCells = Math.max(maxY - minY, 1) + paddingCells * 2;

    const worldWidth = widthCells * cellSize;
    const worldHeight = heightCells * cellSize;

    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || worldWidth <= 0 || worldHeight <= 0) {
      applyDefaultCenteredView();
      return;
    }

    const aspect = rect.width / rect.height;

    // Compute the viewBox size (in design units) needed to fit the bounding box,
    // respecting the SVG's aspect ratio.
    let viewWorldWidth = worldWidth;
    let viewWorldHeight = worldHeight;

    if (worldWidth / worldHeight > aspect) {
      // Width-constrained
      viewWorldWidth = worldWidth;
      viewWorldHeight = worldWidth / aspect;
    } else {
      // Height-constrained
      viewWorldHeight = worldHeight;
      viewWorldWidth = worldHeight * aspect;
    }

    // Add a little extra padding so content isn't flush with edges.
    const paddingFactor = 1.1;
    viewWorldWidth *= paddingFactor;
    viewWorldHeight *= paddingFactor;

    // Derive zoom from desired viewBox width.
    let nextZoom = designWidth / viewWorldWidth;
    nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));

    // Recompute actual viewBox size from clamped zoom.
    const finalViewWidth = designWidth / nextZoom;
    const finalViewHeight = designHeight / nextZoom;

    // Center the viewBox on the design bounding box center.
    const centerXCells = (minX + maxX) / 2;
    const centerYCells = (minY + maxY) / 2;
    const centerX = centerXCells * cellSize;
    const centerY = centerYCells * cellSize;

    const viewBoxX = centerX - finalViewWidth / 2;
    const viewBoxY = centerY - finalViewHeight / 2;

    const nextPanX = -viewBoxX;
    const nextPanY = -viewBoxY;

    setZoom(nextZoom);
    setPanX(nextPanX);
    setPanY(nextPanY);

    if (onViewStateChange) {
      onViewStateChange({
        zoom: nextZoom,
        panX: nextPanX,
        panY: nextPanY,
        showNotchPositions,
        showHelpText,
        showLineIds,
      });
    }
  }, [
    lines,
    cellSize,
    designWidth,
    designHeight,
    onViewStateChange,
    showNotchPositions,
    showHelpText,
    showLineIds,
  ]);

  /**
   * Zoom to specific level (centered)
   */
  const zoomTo = useCallback(
    (targetZoom: number) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));

      if (newZoom === zoom) return;

      // Current view center in world coordinates
      const viewWidth = designWidth / zoom;
      const viewHeight = designHeight / zoom;
      const centerX = panX + viewWidth / 2;
      const centerY = panY + viewHeight / 2;

      // New pan so the same world center stays centered after zoom
      const newViewWidth = designWidth / newZoom;
      const newViewHeight = designHeight / newZoom;

      const newPanX = centerX - newViewWidth / 2;
      const newPanY = centerY - newViewHeight / 2;

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);

      if (onViewStateChange) {
        onViewStateChange({
          zoom: newZoom,
          panX: newPanX,
          panY: newPanY,
          showNotchPositions,
          showHelpText,
          showLineIds,
        });
      }
    },
    [zoom, panX, panY, designWidth, designHeight, onViewStateChange, showNotchPositions, showHelpText, showLineIds]
  );

  // Sync incoming persisted view state into local state
  useEffect(() => {
    if (!viewState) return;
    setZoom(viewState.zoom);
    setPanX(viewState.panX);
    setPanY(viewState.panY);
    setShowNotchPositions(viewState.showNotchPositions);
    setShowHelpText(viewState.showHelpText);
    setShowLineIds(viewState.showLineIds);
  }, [viewState]);

  // Initialize view on mount or when grid changes (only when no external view state is provided)
  useEffect(() => {
    if (viewState) return;
    const timer = setTimeout(resetView, 50);
    return () => clearTimeout(timer);
  }, [resetView, viewState]);

  // Clean up panning on global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    };

    if (isPanning) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [isPanning]);

  // Prevent browser-level scroll/zoom when the pointer is over the designer SVG
  useEffect(() => {
    const handleGlobalWheel = (event: WheelEvent) => {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const rect = svgEl.getBoundingClientRect();
      const { clientX, clientY } = event;
      const isInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (isInside) {
        event.preventDefault();
      }
    };

    // Some browsers (notably Safari) use gesture events for pinch zoom
    const handleGlobalGesture = (event: any) => {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const rect = svgEl.getBoundingClientRect();
      const { clientX, clientY } = event;
      const isInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (isInside && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    (window as any).addEventListener("gesturestart", handleGlobalGesture, { passive: false });
    (window as any).addEventListener("gesturechange", handleGlobalGesture, { passive: false });
    (window as any).addEventListener("gestureend", handleGlobalGesture, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      (window as any).removeEventListener("gesturestart", handleGlobalGesture);
      (window as any).removeEventListener("gesturechange", handleGlobalGesture);
      (window as any).removeEventListener("gestureend", handleGlobalGesture);
    };
  }, []);

  // Render grid lines
  const gridLines = useMemo(() => {
    const linesEls: React.ReactElement[] = [];
    const strokeWidth = Math.max(0.25, 0.5 / zoom);
    
    // Vertical lines (X axis divisions)
    for (let i = 0; i <= GRID_EXTENT_CELLS; i++) {
      const x = i * cellSize;
      
      linesEls.push(
        <line
          key={`v${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={designHeight}
          stroke="#374151"
          strokeWidth={strokeWidth}
        />
      );
    }

    // Horizontal lines (Y axis divisions)
    for (let j = 0; j <= GRID_EXTENT_CELLS; j++) {
      const y = j * cellSize;

      linesEls.push(
        <line
          key={`h${j}`}
          x1={0}
          y1={y}
          x2={designWidth}
          y2={y}
          stroke="#374151"
          strokeWidth={strokeWidth}
        />
      );
    }
    
    return linesEls;
  }, [cellSize, designWidth, designHeight, zoom]);

  // Render user-drawn lines
  const lineElements = useMemo(
    () =>
      Array.from(lines.values()).map((line) => {
        const start = gridToSvg({ x: line.x1, y: line.y1 });
        const end = gridToSvg({ x: line.x2, y: line.y2 });
        const isHovered = line.id === hoveredStripId;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        return (
          <g key={line.id}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={isHovered ? "#FBBF24" : "#60A5FA"}
              strokeWidth={isHovered ? Math.max(2, bitSize / 2) : Math.max(1, bitSize / 4)}
              strokeLinecap="round"
            />
            {showLineIds && (
              <>
                <rect
                  x={midX - 10}
                  y={midY - 5}
                  width={20}
                  height={10}
                  fill="rgba(0,0,0,0.5)"
                  rx={2}
                />
                <text
                  x={midX}
                  y={midY}
                  fill={isHovered ? "#FBBF24" : "#E5E7EB"}
                  fontSize={Math.max(5, bitSize / 1.2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                  style={{ fontWeight: 'bold' }}
                >
                  {line.id.slice(-4)}
                </text>
              </>
            )}
          </g>
        );
      }),
    [lines, gridToSvg, bitSize, hoveredStripId, showLineIds]
  );

  // Render intersections as notch symbols
  const intersectionElements = useMemo(
    () =>
      Array.from(intersections.values()).map((intersection) => {
        const pos = gridToSvg({ x: intersection.x, y: intersection.y });
        const symbolW = Math.max(10, bitSize * 1.2);
        const symbolH = Math.max(6, bitSize * 0.7);
        const offset = Math.max(8, bitSize); // Distance from intersection point

        const line1 = lines.get(intersection.line1Id);
        const line2 = lines.get(intersection.line2Id);

        const isLine1Horizontal =
          !!line1 && line1.y1 === line1.y2 && line1.x1 !== line1.x2;
        const isLine2Horizontal =
          !!line2 && line2.y1 === line2.y2 && line2.x1 !== line2.x2;

        const hasHorizontal = isLine1Horizontal || isLine2Horizontal;

        // If there is no horizontal line involved, just render a small passive marker.
        if (!hasHorizontal) {
          return (
            <g key={intersection.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={Math.max(1.5, bitSize / 5)}
                fill="#9CA3AF"
                opacity={0.6}
                pointerEvents="none"
              />
            </g>
          );
        }

        // Determine whether the horizontal strip is currently on top.
        const horizontalOnTop = (() => {
          if (isLine1Horizontal && !isLine2Horizontal) {
            return intersection.line1Over;
          }
          if (isLine2Horizontal && !isLine1Horizontal) {
            // If the horizontal strip is line2, invert the stored flag.
            return !intersection.line1Over;
          }
          // Fallback for uncommon cases (both horizontal, both non-horizontal, etc.)
          return intersection.line1Over;
        })();

        let notchX: number;
        let notchY: number;
        const notchWidth = symbolH;
        const notchHeight = symbolW;

        // Attach the notch above or below the horizontal strip so it always
        // visually belongs to the horizontal line.
        notchX = pos.x - notchWidth / 2;
        notchY = horizontalOnTop
          ? pos.y - offset - notchHeight // above
          : pos.y + offset; // below

        const fillColor = horizontalOnTop ? "#10B981" : "#3B82F6";
        const label = horizontalOnTop ? "B" : "T";
        const labelDescription = horizontalOnTop
          ? "Cut from bottom"
          : "Cut from top";

        // Create a larger clickable area around the notch
        const clickPadding = 5;
        const labelX = notchX + notchWidth / 2;
        const labelY = notchY + notchHeight / 2;

        return (
          <g key={intersection.id}>
            {/* Larger invisible clickable area – no visual chrome, just an easy hit target */}
            <rect
              x={notchX - clickPadding}
              y={notchY - clickPadding}
              width={notchWidth + clickPadding * 2}
              height={notchHeight + clickPadding * 2}
              fill="transparent"
              className="cursor-pointer"
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleIntersection(intersection.id);
              }}
            />
            {/* Visible notch rectangle */}
            <rect
              x={notchX}
              y={notchY}
              width={notchWidth}
              height={notchHeight}
              fill={fillColor}
              stroke="#FFFFFF"
              strokeWidth={0.8}
              className="pointer-events-none transition-all"
              style={{ opacity: 0.95 }}
            />
            {/* Direction label inside the notch: T = top cut, B = bottom cut */}
            <text
              x={labelX}
              y={labelY}
              fill="#F9FAFB"
              fontSize={Math.max(4, bitSize * 0.6)}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              style={{ fontWeight: "bold" }}
            >
              {label}
            </text>
            {/* Small dot at intersection point for reference */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={Math.max(1.5, bitSize / 5)}
              fill="#9CA3AF"
              opacity={0.6}
              pointerEvents="none"
            />
            <title>
              {labelDescription} (horizontal strip) (click to toggle)
            </title>
          </g>
        );
      }),
    [lines, intersections, gridToSvg, bitSize, onToggleIntersection]
  );

  // Render drawing line (first point placed)
  const drawingElement = useMemo(() => {
    if (!drawingLine) return null;
    const pos = gridToSvg(drawingLine);
    return (
      <circle
        cx={pos.x}
        cy={pos.y}
        r={Math.max(2, bitSize / 2)}
        fill="#34D399"
        stroke="#10B981"
        strokeWidth={1}
      />
    );
  }, [drawingLine, gridToSvg, bitSize]);

  // Render drag preview line
  const dragPreviewElement = useMemo(() => {
    if (!dragState) return null;
    
    const start = gridToSvg(dragState.startPoint);
    const end = gridToSvg(dragState.currentPoint);
    
    // Only show if points are different
    if (dragState.startPoint.x === dragState.currentPoint.x &&
        dragState.startPoint.y === dragState.currentPoint.y) {
      return null;
    }
    
    // Use red color when deleting, green when creating/merging
    const strokeColor = isDeleting ? "#EF4444" : "#34D399";
    const startFillColor = isDeleting ? "#EF4444" : "#34D399";
    const endFillColor = isDeleting ? "#DC2626" : "#10B981";
    
    return (
      <>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={strokeColor}
          strokeWidth={Math.max(1, bitSize / 4)}
          strokeLinecap="round"
          strokeDasharray="4,4"
          opacity={0.7}
        />
        <circle cx={start.x} cy={start.y} r={Math.max(2, bitSize / 3)} fill={startFillColor} />
        <circle cx={end.x} cy={end.y} r={Math.max(2, bitSize / 3)} fill={endFillColor} />
      </>
    );
  }, [dragState, gridToSvg, bitSize, isDeleting]);

  // Render hover point
  const hoverElement = useMemo(() => {
    if (!hoverPoint || dragState) return null;
    const pos = gridToSvg(hoverPoint);
    return (
      <circle
        cx={pos.x}
        cy={pos.y}
        r={Math.max(1, bitSize / 3)}
        fill="#8B5CF6"
        opacity={0.6}
        stroke="#7C3AED"
        strokeWidth={1}
      />
    );
  }, [hoverPoint, dragState, gridToSvg, bitSize]);

  return (
    <div className="flex-1 bg-gray-800 p-4 m-4 rounded-lg shadow-inner overflow-hidden relative">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm">
          <div className="text-xs text-gray-400 mb-1">
            Zoom: {Math.round((zoom / DEFAULT_ZOOM) * 100)}%
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => zoomTo(zoom * 1.5)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomTo(zoom / 1.5)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
              title="Reset View"
            >
              Fit
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-gray-300">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-500 bg-gray-800"
                checked={showNotchPositions}
                onChange={(e) => {
                  const next = e.target.checked;
                  setShowNotchPositions(next);
                  if (onViewStateChange) {
                    onViewStateChange({
                      zoom,
                      panX,
                      panY,
                      showNotchPositions: next,
                      showHelpText,
                      showLineIds,
                    });
                  }
                }}
              />
              <span>Show notch markers</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-500 bg-gray-800"
                checked={showHelpText}
                onChange={(e) => {
                  const next = e.target.checked;
                  setShowHelpText(next);
                  if (onViewStateChange) {
                    onViewStateChange({
                      zoom,
                      panX,
                      panY,
                      showNotchPositions,
                      showHelpText: next,
                      showLineIds,
                    });
                  }
                }}
              />
              <span>Show help text</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-500 bg-gray-800"
                checked={showLineIds}
                onChange={(e) => {
                  const next = e.target.checked;
                  setShowLineIds(next);
                  if (onViewStateChange) {
                    onViewStateChange({
                      zoom,
                      panX,
                      panY,
                      showNotchPositions,
                      showHelpText,
                      showLineIds: next,
                    });
                  }
                }}
              />
              <span>Show line IDs</span>
            </label>
          </div>
        </div>
      </div>

      {/* Help text */}
      {showHelpText && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-xs text-gray-400 space-y-0.5">
            <div>Drag on the grid to draw lines. Drag across an existing line to remove a segment.</div>
            <div>Click a notch symbol on a horizontal strip to toggle which strip is on top (B = cut from bottom, T = cut from top).</div>
            <div>Middle mouse drag or two-finger scroll to pan the view.</div>
            <div>Pinch on trackpad (or Ctrl+scroll) to zoom in and out.</div>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`${-panX} ${-panY} ${designWidth / zoom} ${designHeight / zoom}`}
        className="w-full h-full bg-gray-900 border border-gray-700 rounded"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ 
          cursor: isPanning ? "grabbing" : dragState ? "crosshair" : "crosshair",
          touchAction: "none"
        }}
      >
        <title>Kumiko grid designer - Drag to draw lines</title>

        <g ref={contentGroupRef}>
          {/* Background */}
          <rect
            x={0}
            y={0}
            width={designWidth}
            height={designHeight}
            fill="#1F2937"
          />

          {/* Grid */}
          {gridLines}

          {/* User content */}
          {lineElements}
          {showNotchPositions && intersectionElements}
          {drawingElement}
          {dragPreviewElement}
          {hoverElement}

          {/* Border */}
          <rect
            x={0}
            y={0}
            width={designWidth}
            height={designHeight}
            fill="none"
            stroke="#6B7280"
            strokeWidth={Math.max(0.5, 1 / zoom)}
          />
        </g>
      </svg>
    </div>
  );
}
