"use client";

import { Box, BoxProps, forwardRef } from "@chakra-ui/react";
import { GeometricShape } from "./GeometricShape";

interface CardProps extends BoxProps {
  decoratorColor?: "red" | "blue" | "yellow";
  decoratorShape?: "circle" | "square" | "triangle";
  hoverLift?: boolean;
}

export const Card = forwardRef<CardProps, "div">(
  (
    {
      children,
      decoratorColor,
      decoratorShape,
      hoverLift = true,
      ...props
    },
    ref
  ) => {
    return (
      <Box
        ref={ref}
        bg="white"
        border="4px solid"
        borderColor="bauhaus.black"
        boxShadow="8px 8px 0px 0px #121212"
        position="relative"
        p={6}
        transition="transform 0.2s ease-out, box-shadow 0.2s ease-out"
        _hover={
          hoverLift
            ? {
                transform: "translateY(-8px)",
                boxShadow: "12px 12px 0px 0px #121212",
              }
            : undefined
        }
        {...props}
      >
        {decoratorColor && decoratorShape && (
          <Box position="absolute" top={2} right={2}>
            <GeometricShape
              shape={decoratorShape}
              color={decoratorColor}
              size="12px"
            />
          </Box>
        )}
        {children}
      </Box>
    );
  }
);

Card.displayName = "Card";
