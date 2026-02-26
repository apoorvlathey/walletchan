"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { formatUnits } from "viem";

const COLORS = {
  blue: "#1040C0",
  red: "#D02020",
  black: "#121212",
  yellow: "#F0C020",
};

interface ClaimEvent {
  source: "clanker" | "hook";
  token: "WETH" | "BNKRW";
  amount: string;
  timestamp: number;
  transactionHash: string;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01 && value > 0) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

interface CumulativeChartProps {
  events: ClaimEvent[];
  ethPrice: number | null;
  bnkrwPrice: number | null;
}

const CHART_H = 200;
const CHART_PADDING = { top: 10, right: 16, bottom: 30, left: 60 };

export default function CumulativeChart({ events, ethPrice, bnkrwPrice }: CumulativeChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dataPoints = useMemo(() => {
    if (!events.length) return [];

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    let cumulative = 0;
    return sorted.map((evt) => {
      const amtFloat = parseFloat(formatUnits(BigInt(evt.amount), 18));
      const price = evt.token === "WETH" ? ethPrice : bnkrwPrice;
      const usd = price ? amtFloat * price : 0;
      cumulative += usd;
      return {
        timestamp: evt.timestamp,
        usd,
        cumulative,
        token: evt.token,
        source: evt.source,
      };
    });
  }, [events, ethPrice, bnkrwPrice]);

  if (dataPoints.length < 2) return null;

  const minTime = dataPoints[0].timestamp;
  const maxTime = dataPoints[dataPoints.length - 1].timestamp;
  const maxCum = dataPoints[dataPoints.length - 1].cumulative;
  const timeRange = maxTime - minTime || 1;
  const valueRange = maxCum || 1;

  const plotW = 600 - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;

  const toX = useCallback(
    (t: number) => CHART_PADDING.left + ((t - minTime) / timeRange) * plotW,
    [minTime, timeRange, plotW]
  );
  const toY = (v: number) =>
    CHART_PADDING.top + plotH - (v / valueRange) * plotH;

  // Build step path: horizontal then vertical
  let pathD = `M ${toX(dataPoints[0].timestamp)} ${toY(0)}`;
  for (const pt of dataPoints) {
    const x = toX(pt.timestamp);
    // Horizontal to this time at previous cumulative
    pathD += ` L ${x} ${toY(pt.cumulative - pt.usd)}`;
    // Vertical up to new cumulative
    pathD += ` L ${x} ${toY(pt.cumulative)}`;
  }
  // Extend to right edge
  const lastX = toX(dataPoints[dataPoints.length - 1].timestamp);
  pathD += ` L ${CHART_PADDING.left + plotW} ${toY(maxCum)}`;

  // Fill area path
  const fillD =
    pathD +
    ` L ${CHART_PADDING.left + plotW} ${toY(0)} L ${CHART_PADDING.left} ${toY(0)} Z`;

  // Y-axis ticks (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxCum / 4) * i);

  // X-axis date labels (up to 5)
  const xLabelCount = Math.min(5, dataPoints.length);
  const xLabels: { timestamp: number; x: number }[] = [];
  for (let i = 0; i < xLabelCount; i++) {
    const t =
      minTime + (timeRange / (xLabelCount - 1)) * i;
    xLabels.push({ timestamp: t, x: toX(t) });
  }

  // Find nearest data point by SVG x coordinate
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const svg = svgRef.current;
      if (!svg || !dataPoints.length) return;
      const rect = svg.getBoundingClientRect();
      // Convert screen x to SVG viewBox x
      const svgX = ((e.clientX - rect.left) / rect.width) * 600;

      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < dataPoints.length; i++) {
        const dist = Math.abs(toX(dataPoints[i].timestamp) - svgX);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      setHoverIdx(nearest);
    },
    [dataPoints, toX]
  );

  const hoverPoint = hoverIdx !== null ? dataPoints[hoverIdx] : null;

  return (
    <Box position="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 600 ${CHART_H}`}
        width="100%"
        style={{ display: "block", cursor: "crosshair" }}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={CHART_PADDING.left}
            x2={CHART_PADDING.left + plotW}
            y1={toY(v)}
            y2={toY(v)}
            stroke={COLORS.black}
            strokeOpacity={0.06}
            strokeWidth={1}
          />
        ))}

        {/* Fill area */}
        <path d={fillD} fill={COLORS.blue} fillOpacity={0.1} />

        {/* Step line */}
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.blue}
          strokeWidth={2.5}
          strokeLinejoin="miter"
        />

        {/* Data points */}
        {dataPoints.map((pt, i) => (
          <circle
            key={i}
            cx={toX(pt.timestamp)}
            cy={toY(pt.cumulative)}
            r={hoverIdx === i ? 5 : 3}
            fill={pt.token === "WETH" ? COLORS.blue : COLORS.red}
            stroke="white"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={CHART_PADDING.left - 6}
            y={toY(v) + 4}
            textAnchor="end"
            fontSize={10}
            fontWeight={600}
            fill="#999"
            fontFamily="'Outfit', sans-serif"
          >
            {formatUsd(v)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => {
          const d = new Date(l.timestamp * 1000);
          return (
            <text
              key={i}
              x={l.x}
              y={CHART_H - 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="#999"
              fontFamily="'Outfit', sans-serif"
            >
              {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          );
        })}

        {/* Hover vertical line */}
        {hoverPoint && (
          <line
            x1={toX(hoverPoint.timestamp)}
            x2={toX(hoverPoint.timestamp)}
            y1={CHART_PADDING.top}
            y2={CHART_PADDING.top + plotH}
            stroke={COLORS.black}
            strokeOpacity={0.15}
            strokeWidth={1}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        )}

        {/* Invisible overlay for mouse tracking */}
        <rect
          x={CHART_PADDING.left}
          y={CHART_PADDING.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>

      {/* Hover tooltip */}
      {hoverPoint && (
        <Box
          position="absolute"
          top="8px"
          right="16px"
          bg="white"
          border="2px solid"
          borderColor={COLORS.black}
          px={3}
          py={2}
          boxShadow={`3px 3px 0px 0px ${COLORS.black}`}
          pointerEvents="none"
          zIndex={10}
        >
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            {new Date(hoverPoint.timestamp * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <Text fontSize="md" fontWeight="black" lineHeight="1.2">
            {formatUsd(hoverPoint.cumulative)}
          </Text>
          <HStack spacing={1} mt={0.5}>
            <Box
              w={1.5}
              h={1.5}
              borderRadius="full"
              bg={hoverPoint.token === "WETH" ? COLORS.blue : COLORS.red}
            />
            <Text fontSize="xs" color="gray.500" fontWeight="bold">
              +{formatUsd(hoverPoint.usd)} ({hoverPoint.source})
            </Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
