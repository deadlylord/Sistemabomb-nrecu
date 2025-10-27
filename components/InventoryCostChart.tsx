import React, { useMemo, useState } from 'react';
import { formatCOP } from '../constants';

interface InventoryCostChartProps {
  data: { date: string; value: number }[];
}

// Helper to create a smooth path (Catmull-Rom spline)
const createSplinePath = (points: { x: number, y: number }[]) => {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 > points.length - 1 ? i + 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
};


const InventoryCostChart: React.FC<InventoryCostChartProps> = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number, y: number, value: number, date: string } | null>(null);

  const { points, path, areaPath, yAxisLabels } = useMemo(() => {
    if (!data || data.length < 2) {
      const yAxis = [100000, 75000, 50000, 25000, 0];
      return { points: [], path: '', areaPath: '', yAxisLabels: yAxis };
    }

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    let niceMin, niceMax;
    const range = maxVal - minVal;

    // If range is very small (less than 5% of max value) or zero, give it some room to show fluctuations
    if (range === 0 || range < maxVal * 0.05) {
        const padding = Math.max(50000, maxVal * 0.1); // Add at least 50k or 10%
        niceMin = Math.max(0, Math.floor(minVal - padding));
        niceMax = Math.ceil(maxVal + padding);
    } else {
        const padding = range * 0.1; // 10% padding for bigger ranges
        niceMin = Math.max(0, Math.floor(minVal - padding));
        niceMax = Math.ceil(maxVal + padding);
    }
    
    const chartHeight = 200;
    const chartWidth = 500;
    const yRange = niceMax - niceMin;

    const calculatedPoints = data.map((d, i) => {
      const x = (i / (data.length - 1)) * chartWidth;
      const y = yRange > 0 ? chartHeight - ((d.value - niceMin) / yRange) * chartHeight : chartHeight / 2;
      return { x, y, value: d.value, date: d.date };
    });

    const pathData = createSplinePath(calculatedPoints);
    const areaPathData = `${pathData} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`;
    
    const numLabels = 5;
    const labels = [];
    const step = yRange > 0 ? yRange / (numLabels - 1) : 0;
    for (let i = 0; i < numLabels; i++) {
        labels.push(niceMin + (i * step));
    }

    return {
      points: calculatedPoints,
      path: pathData,
      areaPath: areaPathData,
      yAxisLabels: labels.reverse()
    };
  }, [data]);
  
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || points.length === 0) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    const closestPoint = points.reduce((prev, curr) => 
      Math.abs(curr.x - cursorPoint.x) < Math.abs(prev.x - cursorPoint.x) ? curr : prev
    );
    setHoveredPoint(closestPoint);
  };
  
  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };
  
  const formatYAxisLabel = (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace('.0', '')}M`;
      if (value >= 1000) return `${Math.round(value / 1000)}k`;
      return value.toString();
  };

  return (
    <div className="h-72 w-full">
      <svg width="100%" height="100%" viewBox="0 0 500 220" preserveAspectRatio="none">
        <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity="0"/>
            </linearGradient>
        </defs>

        {/* Y-Axis Labels and Grid Lines */}
        {yAxisLabels.map((label, index) => {
            const y = (index / (yAxisLabels.length - 1)) * 200;
            return (
                <g key={index} className="text-xs text-gray-400 dark:text-gray-600">
                    <line x1="0" y1={y} x2="500" y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3"/>
                    <text x="-5" y={y + 3} textAnchor="end" fill="currentColor" className="text-[10px]">
                        {formatYAxisLabel(label)}
                    </text>
                </g>
            )
        })}
        
         {/* X-Axis Labels */}
        <g className="text-xs text-gray-500 dark:text-text-dark">
            {points.map((point, index) => {
                 if (data.length <= 1 || index % Math.ceil(data.length / 7) !== 0) return null;
                 const formattedDate = new Date(point.date + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                 return (
                     <text key={index} x={point.x} y="215" textAnchor="middle" fill="currentColor" className="text-[10px]">
                         {formattedDate}
                     </text>
                 )
            })}
        </g>

        {/* Chart Data */}
        <g>
            <path d={areaPath} fill="url(#areaGradient)" />
            <path d={path} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2.5" />
        </g>
        
        {/* Interactive elements */}
        {hoveredPoint && (
            <g className="pointer-events-none">
                <line x1={hoveredPoint.x} y1="0" x2={hoveredPoint.x} y2="200" stroke="rgb(var(--color-accent))" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="white" stroke="rgb(var(--color-accent))" strokeWidth="2" />
                <foreignObject x={hoveredPoint.x > 400 ? hoveredPoint.x - 110 : hoveredPoint.x + 10} y={hoveredPoint.y - 30 > 0 ? hoveredPoint.y - 30 : 10} width="100" height="45">
                    <div className="bg-gray-800/80 text-white text-xs rounded-md p-2 text-center shadow-lg backdrop-blur-sm">
                        <p>{new Date(hoveredPoint.date + 'T12:00:00Z').toLocaleDateString()}</p>
                        <p className="font-bold">{formatCOP(hoveredPoint.value)}</p>
                    </div>
                </foreignObject>
            </g>
        )}

        <rect 
            x="0" y="0" width="500" height="200" 
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        />
      </svg>
    </div>
  );
};

export default InventoryCostChart;