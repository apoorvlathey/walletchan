import { Box, HStack } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
`;

interface ShapesLoaderProps {
  size?: string;
}

export function ShapesLoader({ size = "10px" }: ShapesLoaderProps) {
  const sizeNum = parseInt(size);

  return (
    <HStack spacing={3} justify="center">
      {/* Circle - Red */}
      <Box
        animation={`${bounce} 0.6s ease-in-out infinite`}
        sx={{ animationDelay: "0ms" }}
      >
        <Box
          w={size}
          h={size}
          borderRadius="full"
          bg="bauhaus.red"
        />
      </Box>
      {/* Square - Blue */}
      <Box
        animation={`${bounce} 0.6s ease-in-out infinite`}
        sx={{ animationDelay: "150ms" }}
      >
        <Box
          w={size}
          h={size}
          bg="bauhaus.blue"
          transform="rotate(45deg)"
        />
      </Box>
      {/* Triangle - Yellow */}
      <Box
        animation={`${bounce} 0.6s ease-in-out infinite`}
        sx={{ animationDelay: "300ms" }}
      >
        <Box
          w={0}
          h={0}
          borderLeft={`${sizeNum / 2}px solid transparent`}
          borderRight={`${sizeNum / 2}px solid transparent`}
          borderBottom={`${Math.round(sizeNum * 0.866)}px solid`}
          borderBottomColor="bauhaus.green"
        />
      </Box>
    </HStack>
  );
}

export default ShapesLoader;
