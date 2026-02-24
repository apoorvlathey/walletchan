import { extendTheme, ThemeConfig } from "@chakra-ui/react";
import {
  bauhausColors,
  bauhausShadows,
  bauhausFonts,
  bauhausFontWeights,
} from "@bankr-wallet/shared";

/**
 * Bauhaus Design System Theme for WalletChan Website
 * Extends the shared design tokens for use with Chakra UI
 */

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    bauhaus: {
      red: bauhausColors.red,
      blue: bauhausColors.blue,
      yellow: bauhausColors.yellow,
      green: "#208040",
      black: bauhausColors.black,
      white: bauhausColors.white,
      background: bauhausColors.background,
      muted: bauhausColors.muted,
    },
    bg: {
      base: bauhausColors.background,
      subtle: bauhausColors.white,
      muted: bauhausColors.muted,
    },
    text: {
      primary: bauhausColors.foreground,
      secondary: bauhausColors.textSecondary,
      tertiary: bauhausColors.textTertiary,
    },
  },
  fonts: {
    heading: bauhausFonts.heading,
    body: bauhausFonts.body,
    mono: bauhausFonts.mono,
  },
  fontWeights: bauhausFontWeights,
  shadows: {
    bauhaus: bauhausShadows,
  },
  styles: {
    global: {
      body: {
        bg: "bauhaus.background",
        color: "text.primary",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "bold",
        borderRadius: "0",
        textTransform: "uppercase",
        letterSpacing: "wider",
        transition: "all 0.2s ease-out",
      },
      variants: {
        primary: {
          bg: "bauhaus.red",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: bauhausShadows.md,
          _hover: {
            bg: "bauhaus.red",
            opacity: 0.9,
            transform: "translateY(-2px)",
            boxShadow: bauhausShadows.lg,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
          _disabled: {
            bg: "bauhaus.red",
            color: "white",
            opacity: 0.5,
            _hover: {
              bg: "bauhaus.red !important",
              opacity: 0.5,
            },
          },
        },
        secondary: {
          bg: "bauhaus.blue",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: bauhausShadows.md,
          _hover: {
            bg: "bauhaus.blue",
            opacity: 0.9,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        yellow: {
          bg: "bauhaus.yellow",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: bauhausShadows.md,
          _hover: {
            bg: "bauhaus.yellow",
            opacity: 0.9,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        green: {
          bg: "bauhaus.green",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: bauhausShadows.md,
          _hover: {
            bg: "bauhaus.green",
            opacity: 0.9,
            transform: "translateY(-2px)",
            boxShadow: bauhausShadows.lg,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        outline: {
          bg: "white",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: bauhausShadows.md,
          _hover: {
            bg: "gray.100",
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        ghost: {
          border: "none",
          boxShadow: "none",
          _hover: {
            bg: "gray.200",
          },
        },
      },
      sizes: {
        md: { px: 6, py: 3, fontSize: "sm" },
        lg: { px: 8, py: 4, fontSize: "md" },
        xl: { px: 12, py: 6, fontSize: "xl" },
      },
      defaultProps: {
        variant: "primary",
        size: "md",
      },
    },
    Heading: {
      baseStyle: {
        fontWeight: "black",
        textTransform: "uppercase",
        letterSpacing: "tighter",
        lineHeight: "0.9",
      },
    },
    Link: {
      baseStyle: {
        fontWeight: "bold",
        _hover: {
          textDecoration: "none",
          color: "bauhaus.red",
        },
      },
    },
    Container: {
      baseStyle: {
        maxW: "7xl",
      },
    },
  },
});

export default theme;
