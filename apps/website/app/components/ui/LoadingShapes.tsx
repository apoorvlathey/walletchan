"use client";

import { HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Box } from "@chakra-ui/react";

const MotionBox = motion(Box);

export function LoadingShapes() {
  return (
    <HStack spacing={1}>
      {/* Circle - Red */}
      <MotionBox
        w="6px"
        h="6px"
        borderRadius="full"
        bg="bauhaus.red"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      {/* Diamond - Blue */}
      <MotionBox
        w="6px"
        h="6px"
        bg="bauhaus.blue"
        transform="rotate(45deg)"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      {/* Triangle - Yellow */}
      <MotionBox
        w={0}
        h={0}
        borderLeft="4px solid transparent"
        borderRight="4px solid transparent"
        borderBottom="7px solid"
        borderBottomColor="bauhaus.yellow"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </HStack>
  );
}
