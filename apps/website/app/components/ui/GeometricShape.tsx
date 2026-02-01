"use client";

import { Box, BoxProps } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

type ShapeType = "circle" | "square" | "triangle";
type ShapeColor = "red" | "blue" | "yellow";

interface GeometricShapeProps extends BoxProps {
  shape: ShapeType;
  color: ShapeColor;
  size?: string | number;
  animate?: boolean;
  filled?: boolean;
}

const colorMap: Record<ShapeColor, string> = {
  red: "bauhaus.red",
  blue: "bauhaus.blue",
  yellow: "bauhaus.yellow",
};

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const spinSquare = keyframes`
  from { transform: rotate(45deg); }
  to { transform: rotate(405deg); }
`;

export function GeometricShape({
  shape,
  color,
  size = "24px",
  animate = false,
  filled = true,
  ...props
}: GeometricShapeProps) {
  const colorValue = colorMap[color];

  if (shape === "circle") {
    return (
      <Box
        w={size}
        h={size}
        borderRadius="full"
        bg={filled ? colorValue : "transparent"}
        border={filled ? "none" : "3px solid"}
        borderColor={filled ? "transparent" : colorValue}
        animation={animate ? `${spin} 20s linear infinite` : undefined}
        {...props}
      />
    );
  }

  if (shape === "square") {
    return (
      <Box
        w={size}
        h={size}
        transform="rotate(45deg)"
        bg={filled ? colorValue : "transparent"}
        border={filled ? "none" : "3px solid"}
        borderColor={filled ? "transparent" : colorValue}
        animation={animate ? `${spinSquare} 20s linear infinite` : undefined}
        {...props}
      />
    );
  }

  // Triangle
  const sizeNum = typeof size === "string" ? parseInt(size) : size;
  return (
    <Box
      w={0}
      h={0}
      borderLeft={`${sizeNum / 2}px solid transparent`}
      borderRight={`${sizeNum / 2}px solid transparent`}
      borderBottom={`${sizeNum * 0.866}px solid`}
      borderBottomColor={colorValue}
      {...props}
    />
  );
}

export function LogoShapes({ size = "12px" }: { size?: string }) {
  return (
    <>
      <GeometricShape shape="circle" color="red" size={size} />
      <GeometricShape shape="square" color="blue" size={size} />
      <GeometricShape shape="triangle" color="yellow" size={size} />
    </>
  );
}
