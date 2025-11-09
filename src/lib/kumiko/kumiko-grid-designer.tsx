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

export interface GridDesignerProps {
  lines: Map<string, Line>;
  intersections: Map<string, Intersection>;
  drawingLine: Point | null;
  onGridClick: (point: Point) => void;
  onCreateLine?: (start: Point, end: Point) => void;
  onToggleIntersection: (id: string) => void;
  bitSize: number;
  stripLength: number;
  gridSize: number;
}

interface DragState {
  startPoint: Point;
  currentPoint: Point;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

export function GridDesigner({
  lines,
  intersections,
  drawingLine,
  onGridClick,
  onCreateLine,
  onToggleIntersection,
  bitSize,
  stripLength,
  gridSize,
}: GridDesignerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentGroupRef = useRef<SVGGElement | null>(null);

  // Viewport state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Interaction state
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Grid cell size in SVG units
  const cellSize = useMemo(
    () => stripLength / gridSize,
    [stripLength, gridSize]
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

        // Convert SVG coordinates to grid coordinates
        const gridX = (svgPt.x / stripLength) * gridSize;
        const gridY = (svgPt.y / stripLength) * gridSize;

        // Clamp to grid bounds
        if (gridX < 0 || gridX > gridSize || gridY < 0 || gridY > gridSize) {
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
    [stripLength, gridSize]
  );

  /**
   * Convert grid coordinates to SVG viewBox coordinates
   */
  const gridToSvg = useCallback(
    (point: Point): { x: number; y: number } => ({
      x: (point.x / gridSize) * stripLength,
      y: (point.y / gridSize) * stripLength,
    }),
    [gridSize, stripLength]
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
            setPanX(panStartRef.current.panX + dx / matrix.a);
            setPanY(panStartRef.current.panY + dy / matrix.d);
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
        }
      } else {
        // Update hover point
        setHoverPoint(gridPt);
      }
    },
    [isPanning, dragState, screenToGrid]
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
      e.preventDefault();

      const svg = svgRef.current;
      if (!svg) return;

      // Get mouse position in SVG coordinates before zoom
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      
      const svgPtBefore = pt.matrixTransform(matrix.inverse());

      // Calculate new zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
      
      if (newZoom === zoom) return;

      // Get mouse position in SVG coordinates after zoom
      // We need to adjust pan so the point under the mouse stays fixed
      const zoomRatio = newZoom / zoom;
      
      // Calculate new pan to keep mouse position fixed
      const newPanX = svgPtBefore.x - (svgPtBefore.x - panX) * zoomRatio;
      const newPanY = svgPtBefore.y - (svgPtBefore.y - panY) * zoomRatio;

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    },
    [zoom, panX, panY]
  );

  /**
   * Reset view to fit the grid
   */
  const resetView = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Calculate zoom to fit grid with padding
    const scaleX = rect.width / stripLength;
    const scaleY = rect.height / stripLength;
    const newZoom = Math.min(scaleX, scaleY) * 0.9;

    // Center the grid
    const centeredPanX = (rect.width / newZoom - stripLength) / 2;
    const centeredPanY = (rect.height / newZoom - stripLength) / 2;

    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
    setPanX(centeredPanX);
    setPanY(centeredPanY);
  }, [stripLength]);

  /**
   * Zoom to specific level (centered)
   */
  const zoomTo = useCallback(
    (targetZoom: number) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const pt = svg.createSVGPoint();
      pt.x = centerX;
      pt.y = centerY;
      
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      
      const svgPtBefore = pt.matrixTransform(matrix.inverse());

      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      const zoomRatio = newZoom / zoom;

      const newPanX = svgPtBefore.x - (svgPtBefore.x - panX) * zoomRatio;
      const newPanY = svgPtBefore.y - (svgPtBefore.y - panY) * zoomRatio;

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    },
    [zoom, panX, panY]
  );

  // Initialize view on mount or when grid changes
  useEffect(() => {
    const timer = setTimeout(resetView, 50);
    return () => clearTimeout(timer);
  }, [resetView, gridSize, stripLength]);

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

  // Render grid lines
  const gridLines = useMemo(() => {
    const lines: React.ReactElement[] = [];
    const strokeWidth = Math.max(0.25, 0.5 / zoom);
    
    for (let i = 0; i <= gridSize; i++) {
      const pos = (i / gridSize) * stripLength;
      
      // Vertical line
      lines.push(
        <line
          key={`v${i}`}
          x1={pos}
          y1={0}
          x2={pos}
          y2={stripLength}
          stroke="#374151"
          strokeWidth={strokeWidth}
        />
      );
      
      // Horizontal line
      lines.push(
        <line
          key={`h${i}`}
          x1={0}
          y1={pos}
          x2={stripLength}
          y2={pos}
          stroke="#374151"
          strokeWidth={strokeWidth}
        />
      );
    }
    
    return lines;
  }, [gridSize, stripLength, zoom]);

  // Render user-drawn lines
  const lineElements = useMemo(
    () =>
      Array.from(lines.values()).map((line) => {
        const start = gridToSvg({ x: line.x1, y: line.y1 });
        const end = gridToSvg({ x: line.x2, y: line.y2 });
        return (
          <line
            key={line.id}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#60A5FA"
            strokeWidth={Math.max(1, bitSize / 4)}
            strokeLinecap="round"
          />
        );
      }),
    [lines, gridToSvg, bitSize]
  );

  // Render intersections
  const intersectionElements = useMemo(
    () =>
      Array.from(intersections.values()).map((intersection) => {
        const pos = gridToSvg({ x: intersection.x, y: intersection.y });
        const radius = Math.max(2, bitSize / 3);
        return (
          <circle
            key={intersection.id}
            cx={pos.x}
            cy={pos.y}
            r={radius}
            fill={intersection.line1Over ? "#FBBF24" : "#EF4444"}
            className="cursor-pointer hover:stroke-white hover:stroke-2 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onToggleIntersection(intersection.id);
            }}
          />
        );
      }),
    [intersections, gridToSvg, bitSize, onToggleIntersection]
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
    
    return (
      <>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#34D399"
          strokeWidth={Math.max(1, bitSize / 4)}
          strokeLinecap="round"
          strokeDasharray="4,4"
          opacity={0.7}
        />
        <circle cx={start.x} cy={start.y} r={Math.max(2, bitSize / 3)} fill="#34D399" />
        <circle cx={end.x} cy={end.y} r={Math.max(2, bitSize / 3)} fill="#10B981" />
      </>
    );
  }, [dragState, gridToSvg, bitSize]);

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
            Zoom: {Math.round(zoom * 100)}%
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
        </div>
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-xs text-gray-400">
          <div>⬅️ Drag to draw lines</div>
          <div>🖱️ Middle mouse to pan</div>
          <div>🔍 Scroll wheel to zoom</div>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`${-panX} ${-panY} ${stripLength / zoom} ${stripLength / zoom}`}
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
            width={stripLength}
            height={stripLength}
            fill="#1F2937"
          />

          {/* Grid */}
          {gridLines}

          {/* User content */}
          {lineElements}
          {intersectionElements}
          {drawingElement}
          {dragPreviewElement}
          {hoverElement}

          {/* Border */}
          <rect
            x={0}
            y={0}
            width={stripLength}
            height={stripLength}
            fill="none"
            stroke="#6B7280"
            strokeWidth={Math.max(0.5, 1 / zoom)}
          />
        </g>
      </svg>
    </div>
  );
}