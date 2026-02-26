"use client";

import { useMemo, useState } from "react";
import { Box, Text, HStack, Flex } from "@chakra-ui/react";
import { formatUnits } from "viem";

const COLORS = {
  blue: "#1040C0",
  black: "#121212",
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

interface ClaimHeatmapProps {
  events: ClaimEvent[];
  ethPrice: number | null;
  bnkrwPrice: number | null;
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEKS_TO_SHOW = 20;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export default function ClaimHeatmap({ events, ethPrice, bnkrwPrice }: ClaimHeatmapProps) {
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  // Aggregate USD by day
  const { dailyMap, maxDailyUsd, weeks } = useMemo(() => {
    const map = new Map<string, { usd: number; count: number }>();

    for (const evt of events) {
      const amtFloat = parseFloat(formatUnits(BigInt(evt.amount), 18));
      const price = evt.token === "WETH" ? ethPrice : bnkrwPrice;
      const usd = price ? amtFloat * price : 0;
      const dateKey = new Date(evt.timestamp * 1000).toISOString().slice(0, 10);
      const existing = map.get(dateKey);
      if (existing) {
        existing.usd += usd;
        existing.count += 1;
      } else {
        map.set(dateKey, { usd, count: 1 });
      }
    }

    let maxUsd = 0;
    for (const v of map.values()) {
      if (v.usd > maxUsd) maxUsd = v.usd;
    }

    // Build weeks grid (ending at current week)
    const now = new Date();
    // Find start of current week (Sunday)
    const todayDay = now.getDay(); // 0=Sun
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - todayDay - (WEEKS_TO_SHOW - 1) * 7);

    const weeksArr: { dateKey: string; date: Date }[][] = [];
    const cursor = new Date(startDate);

    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const week: { dateKey: string; date: Date }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateKey = cursor.toISOString().slice(0, 10);
        week.push({ dateKey, date: new Date(cursor) });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksArr.push(week);
    }

    return { dailyMap: map, maxDailyUsd: maxUsd, weeks: weeksArr };
  }, [events, ethPrice, bnkrwPrice]);

  const getOpacity = (usd: number): number => {
    if (maxDailyUsd === 0 || usd === 0) return 0;
    // Use sqrt scale for better distribution
    return 0.15 + 0.85 * Math.sqrt(usd / maxDailyUsd);
  };

  const hoveredData = hoverDay ? dailyMap.get(hoverDay) : null;

  // Month labels along top
  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const month = weeks[w][0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: weeks[w][0].date.toLocaleDateString(undefined, { month: "short" }),
          weekIdx: w,
        });
        lastMonth = month;
      }
    }
    return labels;
  }, [weeks]);

  const totalW = WEEKS_TO_SHOW * (CELL_SIZE + CELL_GAP);

  return (
    <Box>
      <Box overflowX="auto" pb={2}>
        <Box position="relative" minW={`${totalW + 36}px`}>
          {/* Month labels */}
          <Flex ml="36px" mb={1}>
            {monthLabels.map((ml, i) => (
              <Text
                key={i}
                position="absolute"
                left={`${36 + ml.weekIdx * (CELL_SIZE + CELL_GAP)}px`}
                fontSize="10px"
                fontWeight="bold"
                color="gray.400"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {ml.label}
              </Text>
            ))}
          </Flex>

          <Flex mt={5}>
            {/* Day labels */}
            <Box w="36px" flexShrink={0}>
              {DAY_LABELS.map((label, i) => (
                <Box
                  key={i}
                  h={`${CELL_SIZE + CELL_GAP}px`}
                  display="flex"
                  alignItems="center"
                >
                  <Text fontSize="10px" fontWeight="bold" color="gray.400">
                    {label}
                  </Text>
                </Box>
              ))}
            </Box>

            {/* Grid */}
            <Flex gap={`${CELL_GAP}px`}>
              {weeks.map((week, w) => (
                <Flex key={w} direction="column" gap={`${CELL_GAP}px`}>
                  {week.map((day) => {
                    const data = dailyMap.get(day.dateKey);
                    const usd = data?.usd ?? 0;
                    const isFuture = day.date > new Date();
                    return (
                      <Box
                        key={day.dateKey}
                        w={`${CELL_SIZE}px`}
                        h={`${CELL_SIZE}px`}
                        bg={
                          isFuture
                            ? "transparent"
                            : usd > 0
                              ? COLORS.blue
                              : "gray.100"
                        }
                        opacity={isFuture ? 0 : usd > 0 ? getOpacity(usd) : 1}
                        border={
                          hoverDay === day.dateKey
                            ? `2px solid ${COLORS.black}`
                            : "1px solid"
                        }
                        borderColor={
                          hoverDay === day.dateKey
                            ? COLORS.black
                            : isFuture
                              ? "transparent"
                              : "gray.200"
                        }
                        cursor={isFuture ? "default" : "pointer"}
                        onMouseEnter={() => !isFuture && setHoverDay(day.dateKey)}
                        onMouseLeave={() => setHoverDay(null)}
                        title={day.dateKey}
                        transition="border 0.1s"
                      />
                    );
                  })}
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Box>
      </Box>

      {/* Hover info + legend */}
      <Flex justify="space-between" align="center" mt={2}>
        <Box h="20px">
          {hoverDay && (
            <Text fontSize="xs" fontWeight="bold" color="gray.600">
              {new Date(hoverDay + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {hoveredData
                ? ` — ${formatUsd(hoveredData.usd)} (${hoveredData.count} claim${hoveredData.count > 1 ? "s" : ""})`
                : " — No claims"}
            </Text>
          )}
        </Box>
        <HStack spacing={1}>
          <Text fontSize="10px" color="gray.400" fontWeight="bold">
            Less
          </Text>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <Box
              key={intensity}
              w="12px"
              h="12px"
              bg={intensity === 0 ? "gray.100" : COLORS.blue}
              opacity={intensity === 0 ? 1 : 0.15 + 0.85 * intensity}
              border="1px solid"
              borderColor="gray.200"
            />
          ))}
          <Text fontSize="10px" color="gray.400" fontWeight="bold">
            More
          </Text>
        </HStack>
      </Flex>
    </Box>
  );
}
