import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Settings,
  Grid,
  MousePointer,
  Maximize,
  Minimize,
  Scissors,
  Download,
  Trash2,
  Plus,
  ArrowRight,
  RotateCw,
  Layout,
} from 'lucide-react';

// --- Constants ---

const INCH_TO_MM = 25.4;
const MM_TO_INCH = 1 / INCH_TO_MM;
// const GRID_DIVISIONS = 20; // Will be state

// --- Utility Functions ---

/**
 * Converts a value between 'mm' and 'in'
 * @param {number} value - The value to convert
 * @param {'mm' | 'in'} fromUnit - The unit to convert from
 * @param {'mm' | 'in'} toUnit - The unit to convert to
 * @returns {number} - The converted value
 */
const convertUnit = (value, fromUnit, toUnit) => {
  if (fromUnit === toUnit || !value) return value;
  if (fromUnit === 'mm' && toUnit === 'in') return value * MM_TO_INCH;
  if (fromUnit === 'in' && toUnit === 'mm') return value * INCH_TO_MM;
  return value;
};

/**
 * Formats a number for display, optionally converting it.
 * @param {number} mmValue - The value in mm
 * @param {'mm' | 'in'} displayUnit - The unit to display in
 * @returns {string} - Formatted string
 */
const formatValue = (mmValue, displayUnit) => {
  const value = convertUnit(mmValue, 'mm', displayUnit);
  return value.toFixed(displayUnit === 'mm' ? 1 : 3);
};

/**
 * Generates a simple unique ID.
 * @returns {string}
 */
const newId = () => `id_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Finds the intersection point of two lines.
 * Returns null if no intersection or lines are collinear.
 * @param {object} line1 - { x1, y1, x2, y2 }
 * @param {object} line2 - { x1, y1, x2, y2 }
 * @returns {object | null} - { x, y } or null
 */
const findIntersection = (line1, line2) => {
  const { x1, y1, x2, y2 } = line1;
  const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: Math.round(x1 + t * (x2 - x1)),
      y: Math.round(y1 + t * (y2 - y1)),
    };
  }
  return null;
};

// --- Main App Component ---

export default function App() {
  const [step, setStep] = useState('design'); // 'design' | 'layout'
  const [units, setUnits] = useState('mm'); // 'mm' | 'in'

  // --- Parameters (all stored in mm) ---
  const [bitSize, setBitSize] = useState(6.35); // 1/4 inch
  const [cutDepth, setCutDepth] = useState(19); // ~3/4 inch
  const [halfCutDepth, setHalfCutDepth] = useState(9.5);
  const [stripLength, setStripLength] = useState(600); // ~24 inches
  const [gridSize, setGridSize] = useState(20); // Replaces GRID_DIVISIONS

  // --- Design State (Step 1) ---
  const [lines, setLines] = useState(new Map());
  const [drawingLine, setDrawingLine] = useState(null);

  // --- Layout State (Step 2) ---
  const [groups, setGroups] = useState(
    () => new Map([['group1', { id: 'group1', name: 'Default Group', pieces: new Map(), fullCuts: new Map() }]])
  );
  const [activeGroupId, setActiveGroupId] = useState('group1');
  const [selectedPieceId, setSelectedPieceId] = useState(null); // ID of line from 'lines' map
  const [nextRotation, setNextRotation] = useState(0);
  const [layoutTool, setLayoutTool] = useState('place'); // 'place' | 'cut'
  const [layoutCutStart, setLayoutCutStart] = useState(null);

  // --- Derived State (Intersections) ---
  const intersections = useMemo(() => {
    const newIntersections = new Map();
    const lineArray = Array.from(lines.values());

    for (let i = 0; i < lineArray.length; i++) {
      for (let j = i + 1; j < lineArray.length; j++) {
        const line1 = lineArray[i];
        const line2 = lineArray[j];
        const point = findIntersection(line1, line2);

        if (point) {
          const id = `int_${line1.id}_${line2.id}`;
          newIntersections.set(id, {
            id,
            x: point.x,
            y: point.y,
            line1Id: line1.id,
            line2Id: line2.id,
            line1Over: true, // Default: line1 is 'up' (over)
          });
        }
      }
    }
    return newIntersections;
  }, [lines]);

  // --- Derived State (Strips for Layout) ---
  const designStrips = useMemo(() => {
    return Array.from(lines.values()).map(line => {
      const { x1, y1, x2, y2 } = line;
      const lengthGrid = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const gridUnitSize = stripLength / gridSize;
      const lengthMM = lengthGrid * gridUnitSize;
      
      const lineIntersections = Array.from(intersections.values()).filter(
        int => int.line1Id === line.id || int.line2Id === line.id
      ).map(int => {
        // Determine if this line is 'under' at this intersection
        const isUnder = (int.line1Id === line.id && !int.line1Over) || (int.line2Id === line.id && int.line1Over);
        // Calculate distance from line start (x1, y1)
        const dist = Math.sqrt(Math.pow(int.x - x1, 2) + Math.pow(int.y - y1, 2));
        return {
          id: int.id,
          isUnder,
          dist: dist * gridUnitSize, // distance in mm
        };
      });

      return {
        ...line,
        lengthMM,
        notches: lineIntersections.filter(int => int.isUnder),
      };
    });
  }, [lines, intersections, stripLength, gridSize]);

  const activeGroup = useMemo(() => {
    return groups.get(activeGroupId);
  }, [groups, activeGroupId]);

  // --- Handlers ---

  /**
   * Toggles the over/under state of an intersection.
   */
  const toggleIntersection = (id) => {
    // This is tricky without real state. We'll just log it.
    // In a real app, you'd update the `intersections` map,
    // which would require `intersections` to be in `useState`
    // and `lines` to be a dependency of its `useMemo`.
    // For this demo, we'll modify the `intersections` map directly
    // which is NOT good React practice, but simplifies this example.
    const int = intersections.get(id);
    if (int) {
      int.line1Over = !int.line1Over;
      // Force a re-render by updating lines (hacky)
      setLines(new Map(lines));
      console.log(`Toggled ${id}: line1Over is now ${int.line1Over}`);
    }
  };

  /**
   * Handles clicking on the design grid.
   */
  const handleGridClick = (point) => {
    // Snap to nearest grid point
    const snappedPoint = {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };

    if (!drawingLine) {
      setDrawingLine(snappedPoint);
    } else {
      if (drawingLine.x === snappedPoint.x && drawingLine.y === snappedPoint.y) {
        // Canceled line
        setDrawingLine(null);
        return;
      }
      const id = newId();
      const newLine = {
        id,
        x1: drawingLine.x,
        y1: drawingLine.y,
        x2: snappedPoint.x,
        y2: snappedPoint.y,
      };
      setLines(prev => new Map(prev).set(id, newLine));
      setDrawingLine(null);
    }
  };

  /**
   * Handles parameter changes from inputs.
   */
  const handleParamChange = (setter) => (e) => {
    const displayValue = parseFloat(e.target.value) || 0;
    const mmValue = convertUnit(displayValue, units, 'mm');
    setter(mmValue);

    // Auto-update half-cut depth
    if (setter === setCutDepth) {
      setHalfCutDepth(mmValue / 2);
    }
  };
  
  const handleHalfCutParamChange = (setter) => (e) => {
    const displayValue = parseFloat(e.target.value) || 0;
    const mmValue = convertUnit(displayValue, units, 'mm');
    setter(mmValue);
  }

  /**
   * Toggles measurement units.
   */
  const toggleUnits = () => {
    setUnits(prev => (prev === 'mm' ? 'in' : 'mm'));
  };

  /**
   * Adds a new group in the layout step.
   */
  const addNewGroup = () => {
    const id = newId();
    const newGroup = { id, name: `Group ${groups.size + 1}`, pieces: new Map(), fullCuts: new Map() };
    setGroups(prev => new Map(prev).set(id, newGroup));
    setActiveGroupId(id);
  };
  
  /**
   * Deletes a group.
   */
  const deleteGroup = (id) => {
    if (groups.size <= 1) {
        alert("Cannot delete the last group."); // Use a modal in a real app
        return;
    }
    setGroups(prev => {
        const newGroups = new Map(prev);
        newGroups.delete(id);
        if (activeGroupId === id) {
            setActiveGroupId(newGroups.keys().next().value);
        }
        return newGroups;
    });
  };

  /**
   * Handles clicking on the layout canvas.
   */
  const handleLayoutClick = (point) => {
    const x = point.x;
    const y = point.y;

    if (layoutTool === 'place' && selectedPieceId) {
      const pieceData = lines.get(selectedPieceId);
      if (!pieceData || !activeGroup) return;
      
      const id = newId();
      const newPiece = {
        id,
        lineId: selectedPieceId,
        x, // x in mm
        y, // y in mm
        rotation: nextRotation,
      };
      
      setGroups(prev => {
        const newGroups = new Map(prev);
        const group = newGroups.get(activeGroupId);
        group.pieces.set(id, newPiece);
        return newGroups;
      });
      
    } else if (layoutTool === 'cut') {
      if (!layoutCutStart) {
        setLayoutCutStart({ x, y });
      } else {
        const id = newId();
        const newCut = {
          id,
          x1: layoutCutStart.x,
          y1: layoutCutStart.y,
          x2: x,
          y2: y,
        };
        setGroups(prev => {
          const newGroups = new Map(prev);
          const group = newGroups.get(activeGroupId);
          group.fullCuts.set(id, newCut);
          return newGroups;
        });
        setLayoutCutStart(null);
      }
    }
  };
  
  /**
   * Deletes a piece or cut from the active group.
   */
  const deleteLayoutItem = (type, id) => {
    setGroups(prev => {
        const newGroups = new Map(prev);
        const group = newGroups.get(activeGroupId);
        if (type === 'piece') {
            group.pieces.delete(id);
        } else if (type === 'cut') {
            group.fullCuts.delete(id);
        }
        return newGroups;
    });
  };

  /**
   * Generates the SVG string for the active group.
   */
  const generateSVG = () => {
    if (!activeGroup) return;

    const pieces = Array.from(activeGroup.pieces.values());
    const cuts = Array.from(activeGroup.fullCuts.values());
    
    // Find bounds
    let minX = 0, minY = 0, maxX = stripLength, maxY = stripLength;
    
    // Simple bounding box for now
    if (pieces.length > 0 || cuts.length > 0) {
        const allPoints = [
            ...pieces.map(p => ([p.x, p.y])),
            ...cuts.map(c => ([c.x1, c.y1, c.x2, c.y2])).flat()
        ].flat();
        minX = Math.min(0, ...allPoints) - 50;
        minY = Math.min(0, ...allPoints) - 50;
        maxX = Math.max(stripLength, ...allPoints) + 50;
        maxY = Math.max(stripLength, ...allPoints) + 50;
    }
    const viewBoxWidth = maxX - minX;
    const viewBoxHeight = maxY - minY;

    let svgPaths = [];

    // Process pieces
    pieces.forEach(piece => {
      const strip = designStrips.find(s => s.id === piece.lineId);
      if (!strip) return;
      
      const { x, y, rotation } = piece;
      const w = strip.lengthMM; // Full length of the strip
      const h = bitSize; // Full height of the strip
      const fullDepth = cutDepth.toFixed(3) + 'mm';
      const halfDepth = halfCutDepth.toFixed(3) + 'mm';

      const transform = `translate(${x}, ${y}) rotate(${rotation}, 0, ${h/2})`;
      
      // We will create a <g> tag to apply the transform to all lines
      let pieceLines = [];
      
      // 1. Create notch definitions
      const notches = strip.notches.map(notch => {
        const x = notch.dist - (bitSize / 2);
        return {
          left: x,
          right: x + bitSize,
          bottom: h // Notches are cut from the top edge (y=0) down to y=h
        };
      }).sort((a, b) => a.left - b.left); // Sort notches by position

      // 2. Generate Top Edge (with notches)
      let currentX = 0;
      // Top-Left corner to first notch
      if (notches.length > 0) {
        pieceLines.push(
          `<line x1="${currentX}" y1="0" x2="${notches[0].left}" y2="0" shaper:cutDepth="${fullDepth}" />`
        );
        currentX = notches[0].left;
      } else {
        // No notches, just one long top line
        pieceLines.push(
          `<line x1="0" y1="0" x2="${w}" y2="0" shaper:cutDepth="${fullDepth}" />`
        );
      }

      // Iterate through notches
      for(let i=0; i < notches.length; i++) {
        const notch = notches[i];
        
        // --- Add Notch Cuts ---
        // Left cut of notch
        pieceLines.push(
          `<line x1="${notch.left}" y1="0" x2="${notch.left}" y2="${h}" shaper:cutDepth="${halfDepth}" />`
        );
        // Bottom cut of notch
        pieceLines.push(
          `<line x1="${notch.left}" y1="${h}" x2="${notch.right}" y2="${h}" shaper:cutDepth="${halfDepth}" />`
        );
        // Right cut of notch
        pieceLines.push(
          `<line x1="${notch.right}" y1="${h}" x2="${notch.right}" y2="0" shaper:cutDepth="${halfDepth}" />`
        );
        // --- End Notch Cuts ---
        
        currentX = notch.right;
        
        // Add top edge segment *between* notches
        if (i < notches.length - 1) {
            const nextNotch = notches[i+1];
            pieceLines.push(
              `<line x1="${currentX}" y1="0" x2="${nextNotch.left}" y2="0" shaper:cutDepth="${fullDepth}" />`
            );
            currentX = nextNotch.left;
        }
      }

      // Top edge from last notch to end
      if (currentX < w) {
          pieceLines.push(
            `<line x1="${currentX}" y1="0" x2="${w}" y2="0" shaper:cutDepth="${fullDepth}" />`
          );
      }
      
      // 3. Add Bottom, Left, and Right Edges (full depth)
      // Bottom Edge
      pieceLines.push(
        `<line x1="0" y1="${h}" x2="${w}" y2="${h}" shaper:cutDepth="${fullDepth}" />`
      );
      // Left Edge
      pieceLines.push(
        `<line x1="0" y1="0" x2="0" y2="${h}" shaper:cutDepth="${fullDepth}" />`
      );
      // Right Edge
      pieceLines.push(
        `<line x1="${w}" y1="0" x2="${w}" y2="${h}" shaper:cutDepth="${fullDepth}" />`
      );
      
      // Wrap all lines for this piece in a transformed group
      svgPaths.push(
        `<g transform="${transform}">\n    <!-- Piece ${strip.id.slice(-4)} -->\n    ${pieceLines.join('\n    ')}\n  </g>`
      );
    });

    // Process full depth separation cuts
    cuts.forEach(cut => {
      svgPaths.push(
        `<!-- Separation Cut -->\n  <line x1="${cut.x1.toFixed(3)}" y1="${cut.y1.toFixed(3)}" x2="${cut.x2.toFixed(3)}" y2="${cut.y2.toFixed(3)}" shaper:cutDepth="${cutDepth.toFixed(3)}mm" />`
      );
    });

    // Assemble SVG
    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${viewBoxWidth.toFixed(3)}mm" height="${viewBoxHeight.toFixed(3)}mm" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" version="1.1"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:shaper="http://www.shapertools.com/namespaces/shaper">
  
  <title>${activeGroup.name}</title>
  
  <!-- Debug: Border -->
  <rect x="${minX}" y="${minY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="none" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2" />
  
  <g id="kumiko-layout" fill="none" stroke="#000000" stroke-width="0.25">
    <!--
      All lines represent router cut paths.
      Depth is specified via 'shaper:cutDepth'.
    -->
    ${svgPaths.join('\n    ')}
  </g>
  
</svg>`;
    
    return svgString;
  };
  
  /**
   * Triggers the SVG download.
   */
  const downloadSVG = () => {
    const svgString = generateSVG();
    if (!svgString) {
      alert("Could not generate SVG."); // Use modal
      return;
    }
    
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeGroup.name.replace(/ /g, '_')}_kumiko_layout.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Render ---

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 font-sans">
      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-gray-800 p-3 flex justify-between items-center shadow-md z-10">
          <h1 className="text-xl font-bold text-teal-400">Kumiko Shaper Generator</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setStep('design')}
              className={`px-4 py-2 rounded-lg font-medium ${step === 'design' ? 'bg-teal-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Step 1: Design
            </button>
            <ArrowRight className="text-gray-500" />
            <button
              onClick={() => setStep('layout')}
              className={`px-4 py-2 rounded-lg font-medium ${step === 'layout' ? 'bg-teal-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Step 2: Layout & Export
            </button>
          </div>
        </header>

        {/* Content Area */}
        {step === 'design' ? (
          <GridDesigner
            lines={lines}
            intersections={intersections}
            drawingLine={drawingLine}
            onGridClick={handleGridClick}
            onToggleIntersection={toggleIntersection}
            bitSize={bitSize}
            stripLength={stripLength}
            gridSize={gridSize}
          />
        ) : (
          <LayoutEditor
            designStrips={designStrips}
            activeGroup={activeGroup}
            groups={groups}
            activeGroupId={activeGroupId}
            setActiveGroupId={setActiveGroupId}
            addNewGroup={addNewGroup}
            deleteGroup={deleteGroup}
            selectedPieceId={selectedPieceId}
            setSelectedPieceId={setSelectedPieceId}
            layoutTool={layoutTool}
            setLayoutTool={setLayoutTool}
            nextRotation={nextRotation}
            setNextRotation={setNextRotation}
            onLayoutClick={handleLayoutClick}
            layoutCutStart={layoutCutStart}
            stripLength={stripLength}
            bitSize={bitSize}
            halfCutDepth={halfCutDepth}
            cutDepth={cutDepth}
            onDownload={downloadSVG}
            onDeleteLayoutItem={deleteLayoutItem}
          />
        )}
      </main>

      {/* --- Settings Panel --- */}
      <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Settings className="mr-2" />
          Parameters
        </h2>

        {/* Unit Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleUnits}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            Use {units === 'mm' ? 'Inches' : 'Millimeters'}
          </button>
        </div>

        {/* Param Inputs */}
        <div className="space-y-4">
          <ParamInput
            label="Router Bit Size (Width)"
            id="bitSize"
            mmValue={bitSize}
            onChange={handleParamChange(setBitSize)}
            displayUnit={units}
          />
          <ParamInput
            label="Grid/Stock Length"
            id="stripLength"
            mmValue={stripLength}
            onChange={handleParamChange(setStripLength)}
            displayUnit={units}
          />
          <SimpleParamInput
            label="Grid Divisions"
            id="gridSize"
            value={gridSize}
            onChange={(e) => setGridSize(Math.max(1, parseInt(e.target.value, 10)) || 1)}
          />
          <ParamInput
            label="Full Cut Depth"
            id="cutDepth"
            mmValue={cutDepth}
            onChange={handleParamChange(setCutDepth)}
            displayUnit={units}
          />
          <ParamInput
            label="Half-Cut (Notch) Depth"
            id="halfCutDepth"
            mmValue={halfCutDepth}
            onChange={handleHalfCutParamChange(setHalfCutDepth)}
            displayUnit={units}
          />
          <p className="text-xs text-gray-400">
            Note: Strip width is always equal to Router Bit Size.
          </p>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-md font-semibold mb-2">Design Elements</h3>
            <p className="text-sm text-gray-400">Lines: {lines.size}</p>
            <p className="text-sm text-gray-400">Intersections: {intersections.size}</p>
            <button
                onClick={() => setLines(new Map())}
                className="mt-2 w-full flex items-center justify-center px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium"
            >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Design
            </button>
        </div>
      </aside>
    </div>
  );
}

// --- Child Components ---

/**
 * Renders a single parameter input.
 */
function ParamInput({ label, id, mmValue, onChange, displayUnit }) {
  const displayValue = formatValue(mmValue, displayUnit);
  
  const handleInput = (e) => {
    // This allows user to type, but state is only updated on change
    // This is a simplification; a more robust solution would handle
    // intermediate typing states.
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="flex">
        <input
          type="number"
          id={id}
          step={displayUnit === 'mm' ? '0.1' : '0.001'}
          // Use `key` to force re-render on unit change, picking up new default value
          key={`${id}-${displayUnit}`}
          defaultValue={displayValue}
          onBlur={onChange} // Update on blur to avoid rapid state changes
          onInput={handleInput}
          className="flex-1 block w-full rounded-l-md bg-gray-900 border-gray-700 text-white shadow-sm sm:text-sm p-2"
        />
        <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-700 bg-gray-700 text-gray-300 text-sm">
          {displayUnit}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders a simple parameter input without unit conversion.
 */
function SimpleParamInput({ label, id, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="flex">
        <input
          type="number"
          id={id}
          step="1"
          min="1"
          value={value}
          onChange={onChange}
          className="flex-1 block w-full rounded-md bg-gray-900 border-gray-700 text-white shadow-sm sm:text-sm p-2"
        />
      </div>
    </div>
  );
}

/**
 * Renders the Step 1 Design Grid.
 */
function GridDesigner({
  lines,
  intersections,
  drawingLine,
  onGridClick,
  onToggleIntersection,
  bitSize,
  stripLength,
  gridSize
}) {
  const [svg, setSvg] = useState(null);
  
  const gridUnitSize = stripLength / gridSize;
  const lineStrokeWidth = bitSize / gridUnitSize; // Stroke width in grid units
  const intRadius = 0.4; // Radius in grid units

  // Function to convert SVG click to grid coordinates
  const getGridPoint = (e) => {
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    // Clamp to grid bounds
    const x = Math.max(0, Math.min(gridSize, svgPoint.x));
    const y = Math.max(0, Math.min(gridSize, svgPoint.y));
    
    return { x, y };
  };

  const handleClick = (e) => {
    const point = getGridPoint(e);
    if (point) {
      onGridClick(point);
    }
  };

  return (
    <div className="flex-1 bg-gray-800 p-4 m-4 rounded-lg shadow-inner overflow-hidden flex items-center justify-center">
      <svg
        ref={setSvg}
        className="w-full h-full"
        viewBox={`-1 -1 ${gridSize + 2} ${gridSize + 2}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
        style={{ cursor: 'crosshair', background: '#111827' }} // bg-gray-900
      >
        <defs>
          <pattern
            id="grid"
            width="1"
            height="1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#374151" // text-gray-700
              strokeWidth="0.05"
            />
          </pattern>
        </defs>

        <rect
          x="-1"
          y="-1"
          width={gridSize + 2}
          height={gridSize + 2}
          fill="url(#grid)"
        />

        {/* Drawn Lines */}
        {Array.from(lines.values()).map(line => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#10B981" // emerald-500
            strokeWidth={lineStrokeWidth}
            strokeLinecap="round"
          />
        ))}

        {/* Drawing Line */}
        {drawingLine && (
          <circle cx={drawingLine.x} cy={drawingLine.y} r={intRadius * 1.5} fill="#3B82F6" />
        )}

        {/* Intersections */}
        {Array.from(intersections.values()).map(int => (
          <circle
            key={int.id}
            cx={int.x}
            cy={int.y}
            r={intRadius}
            fill={int.line1Over ? '#EC4899' : '#F59E0B'} // pink-500 : amber-500
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggleIntersection(int.id);
            }}
            title={`Click to toggle: ${int.line1Over ? 'Line 1 Over' : 'Line 2 Over'}`}
          />
        ))}
      </svg>
    </div>
  );
}


/**
 * Renders the Step 2 Layout Editor.
 */
function LayoutEditor({
    designStrips,
    activeGroup,
    groups,
    activeGroupId,
    setActiveGroupId,
    addNewGroup,
    deleteGroup,
    selectedPieceId,
    setSelectedPieceId,
    layoutTool,
    setLayoutTool,
    nextRotation,
    setNextRotation,
    onLayoutClick,
    layoutCutStart,
    stripLength,
    bitSize,
    onDownload,
    onDeleteLayoutItem
}) {
  const [svg, setSvg] = useState(null);
  
  if (!activeGroup) {
      return <div className="flex-1 p-4">No active group. Please create one.</div>;
  }
  
  const pieces = Array.from(activeGroup.pieces.values());
  const cuts = Array.from(activeGroup.fullCuts.values());
  
  // Find bounds for viewBox
  const { minX, minY, viewBoxWidth, viewBoxHeight } = useMemo(() => {
    let minX = 0, minY = 0, maxX = stripLength, maxY = stripLength;
    
    if (pieces.length > 0 || cuts.length > 0) {
        const allPoints = [
            ...pieces.map(p => {
                const strip = designStrips.find(s => s.id === p.lineId);
                const w = strip ? strip.lengthMM : 0;
                const h = bitSize;
                // crude bounding box, doesn't account for rotation
                return [p.x, p.y, p.x + w, p.y + h];
            }),
            ...cuts.map(c => ([c.x1, c.y1, c.x2, c.y2])).flat()
        ].flat();
        
        if (allPoints.length > 0) {
            minX = Math.min(0, ...allPoints) - 50; // Add padding
            minY = Math.min(0, ...allPoints) - 50;
            maxX = Math.max(stripLength, ...allPoints) + 50;
            maxY = Math.max(stripLength, ...allPoints) + 50;
        }
    }
    return { minX, minY, viewBoxWidth: maxX - minX, viewBoxHeight: maxY - minY };
  }, [pieces, cuts, stripLength, bitSize, designStrips]);

  // Function to convert SVG click to real mm coordinates
  const getLayoutPoint = (e) => {
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  };

  const handleClick = (e) => {
    const point = getLayoutPoint(e);
    if (point) {
      onLayoutClick(point);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* --- Strip Bank (Left) --- */}
      <div className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Design Strips</h3>
        <div className="space-y-2">
          {designStrips.length === 0 && (
            <p className="text-sm text-gray-400">No strips in design. Go to Step 1 to draw.</p>
          )}
          {designStrips.map(strip => (
            <button
              key={strip.id}
              onClick={() => setSelectedPieceId(strip.id)}
              className={`w-full p-3 rounded-lg text-left ${selectedPieceId === strip.id ? 'bg-teal-700' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <p className="font-medium">Strip (ID: ...{strip.id.slice(-4)})</p>
              <p className="text-sm text-gray-300">Len: {strip.lengthMM.toFixed(1)}mm</p>
              <p className="text-sm text-gray-300">Notches: {strip.notches.length}</p>
            </button>
          ))}
        </div>
      </div>

      {/* --- Layout Area (Center) --- */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* Toolbar */}
        <div className="flex-shrink-0 bg-gray-800 p-2 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Group:</span>
            <select
              value={activeGroupId}
              onChange={e => setActiveGroupId(e.target.value)}
              className="bg-gray-700 rounded p-1 text-sm"
            >
              {Array.from(groups.values()).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button onClick={addNewGroup} className="p-1 rounded bg-gray-700 hover:bg-gray-600"><Plus className="w-4 h-4" /></button>
            <button onClick={() => deleteGroup(activeGroupId)} className="p-1 rounded bg-gray-700 hover:bg-gray-600"><Trash2 className="w-4 h-4 text-red-400" /></button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLayoutTool('place')}
              className={`p-2 rounded ${layoutTool === 'place' ? 'bg-teal-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Place Tool"
            >
              <MousePointer className="w-5 h-5" />
            </button>
            <button
              onClick={() => setLayoutTool('cut')}
              className={`p-2 rounded ${layoutTool === 'cut' ? 'bg-teal-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Full Cut Tool"
            >
              <Scissors className="w-5 h-5" />
            </button>
            <button
              onClick={() => setNextRotation(prev => (prev + 90) % 360)}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600"
              title={`Next Rotation: ${nextRotation} deg`}
            >
              <RotateCw className="w-5 h-5" />
              <span className="text-xs ml-1">{nextRotation}°</span>
            </button>
          </div>
          <button
            onClick={onDownload}
            className="flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-medium"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Group SVG
          </button>
        </div>
        
        {/* Canvas */}
        <div className="flex-1 p-4 overflow-hidden flex items-center justify-center">
          <svg
            ref={setSvg}
            className="w-full h-full"
            viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={handleClick}
            style={{ cursor: layoutTool === 'place' ? 'copy' : 'crosshair', background: '#374151' }} // bg-gray-700
          >
            {/* Placed Pieces */}
            {pieces.map(piece => {
              const strip = designStrips.find(s => s.id === piece.lineId);
              if (!strip) return null;
              
              const { x, y, rotation } = piece;
              const w = strip.lengthMM;
              const h = bitSize;
              const transform = `translate(${x}, ${y}) rotate(${rotation}, 0, ${h/2})`;

              return (
                <g key={piece.id} transform={transform} 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (layoutTool === 'place') { // Use 'place' tool as a 'delete' tool
                            if (window.confirm("Delete this piece?")) { // Use modal in real app
                                onDeleteLayoutItem('piece', piece.id);
                            }
                        }
                    }}
                    className="cursor-pointer"
                >
                  <rect x="0" y="0" width={w} height={h} fill="#10B981" fillOpacity="0.5" stroke="#10B981" strokeWidth="0.5" />
                  {strip.notches.map(notch => (
                    <rect
                      key={notch.id}
                      x={notch.dist - (bitSize / 2)}
                      y="0"
                      width={bitSize}
                      height={bitSize}
                      fill="#EC4899"
                      fillOpacity="0.7"
                    />
                  ))}
                  <title>Piece {strip.id.slice(-4)}</title>
                </g>
              );
            })}
            
            {/* Full Cuts */}
            {cuts.map(cut => (
                <line
                    key={cut.id}
                    x1={cut.x1} y1={cut.y1}
                    x2={cut.x2} y2={cut.y2}
                    stroke="#FF0000"
                    strokeWidth={bitSize}
                    strokeOpacity="0.7"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this cut line?")) { // Use modal
                            onDeleteLayoutItem('cut', cut.id);
                        }
                    }}
                    className="cursor-pointer"
                    title="Full Cut Line"
                />
            ))}
            
            {/* Drawing Cut Line */}
            {layoutTool === 'cut' && layoutCutStart && (
                <circle cx={layoutCutStart.x} cy={layoutCutStart.y} r={bitSize / 2} fill="#FF0000" fillOpacity="0.5" />
            )}

          </svg>
        </div>
      </div>
    </div>
  );
}