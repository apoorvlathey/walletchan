import { extendTheme, ThemeConfig } from "@chakra-ui/react";

// Design tokens from STYLING.md
const colors = {
  // Background colors
  bg: {
    base: "#0A0A0B", // Main page background
    subtle: "#111113", // Card backgrounds, elevated surfaces
    muted: "#18181B", // Secondary backgrounds
    emphasis: "#27272A", // Hover states, active states
  },
  // Text colors
  text: {
    primary: "#FAFAFA", // Primary text, headings
    secondary: "#A1A1AA", // Secondary text, labels
    tertiary: "#71717A", // Placeholder, disabled text
  },
  // Border colors
  border: {
    subtle: "rgba(255,255,255,0.06)", // Subtle divisions
    default: "rgba(255,255,255,0.10)", // Standard borders
    strong: "rgba(255,255,255,0.16)", // Emphasized borders
  },
  // Primary brand colors
  primary: {
    400: "#60A5FA", // Light blue - links, highlights
    500: "#3B82F6", // Main brand color
    600: "#2563EB", // Hover states
    700: "#1D4ED8", // Active states
  },
  // Status colors
  success: {
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.30)",
    solid: "#4ADE80",
  },
  warning: {
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.30)",
    solid: "#FBBF24",
  },
  error: {
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.30)",
    solid: "#F87171",
  },
  info: {
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.30)",
    solid: "#60A5FA",
  },
};

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors,
  fonts: {
    heading:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    body: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  },
  styles: {
    global: {
      body: {
        bg: "bg.base",
        color: "text.primary",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "500",
        borderRadius: "lg",
      },
      variants: {
        primary: {
          bg: "primary.500",
          color: "white",
          _hover: {
            bg: "primary.600",
            _disabled: {
              bg: "primary.500",
            },
          },
          _active: {
            bg: "primary.700",
          },
        },
        secondary: {
          bg: "bg.muted",
          color: "text.primary",
          borderWidth: "1px",
          borderColor: "border.default",
          _hover: {
            bg: "bg.emphasis",
            borderColor: "border.strong",
          },
        },
        ghost: {
          color: "text.secondary",
          _hover: {
            bg: "bg.emphasis",
            color: "text.primary",
          },
        },
        outline: {
          borderColor: "border.default",
          color: "text.primary",
          _hover: {
            bg: "bg.emphasis",
            borderColor: "border.strong",
          },
        },
      },
      defaultProps: {
        variant: "secondary",
      },
    },
    Input: {
      variants: {
        filled: {
          field: {
            bg: "bg.subtle",
            borderWidth: "1px",
            borderColor: "border.default",
            color: "text.primary",
            _placeholder: {
              color: "text.tertiary",
            },
            _hover: {
              bg: "bg.subtle",
              borderColor: "border.strong",
            },
            _focus: {
              bg: "bg.subtle",
              borderColor: "primary.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
            },
            _invalid: {
              borderColor: "error.solid",
              boxShadow: "0 0 0 1px var(--chakra-colors-error-solid)",
            },
          },
        },
        outline: {
          field: {
            bg: "bg.subtle",
            borderColor: "border.default",
            color: "text.primary",
            _placeholder: {
              color: "text.tertiary",
            },
            _hover: {
              borderColor: "border.strong",
            },
            _focus: {
              borderColor: "primary.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
            },
            _invalid: {
              borderColor: "error.solid",
              boxShadow: "0 0 0 1px var(--chakra-colors-error-solid)",
            },
          },
        },
      },
      defaultProps: {
        variant: "outline",
      },
    },
    Select: {
      variants: {
        filled: {
          field: {
            bg: "bg.subtle",
            borderWidth: "1px",
            borderColor: "border.default",
            color: "text.primary",
            _hover: {
              bg: "bg.subtle",
              borderColor: "border.strong",
            },
            _focus: {
              bg: "bg.subtle",
              borderColor: "primary.500",
            },
            "> option, > optgroup": {
              bg: "bg.subtle",
              color: "text.primary",
            },
          },
          icon: {
            color: "text.secondary",
          },
        },
      },
      defaultProps: {
        variant: "filled",
      },
    },
    Badge: {
      variants: {
        success: {
          bg: "success.bg",
          color: "success.solid",
          borderWidth: "1px",
          borderColor: "success.border",
        },
        warning: {
          bg: "warning.bg",
          color: "warning.solid",
          borderWidth: "1px",
          borderColor: "warning.border",
        },
        error: {
          bg: "error.bg",
          color: "error.solid",
          borderWidth: "1px",
          borderColor: "error.border",
        },
        info: {
          bg: "info.bg",
          color: "info.solid",
          borderWidth: "1px",
          borderColor: "info.border",
        },
      },
    },
    Alert: {
      variants: {
        subtle: (props: { status: string }) => {
          const status = props.status || "info";
          return {
            container: {
              bg: `${status}.bg`,
              borderWidth: "1px",
              borderColor: `${status}.border`,
            },
            icon: {
              color: `${status}.solid`,
            },
            title: {
              color: "text.primary",
            },
            description: {
              color: "text.secondary",
            },
          };
        },
      },
      defaultProps: {
        variant: "subtle",
      },
    },
    Divider: {
      baseStyle: {
        borderColor: "border.default",
      },
    },
    Code: {
      baseStyle: {
        bg: "bg.muted",
        color: "text.primary",
        fontFamily: "mono",
        borderRadius: "md",
      },
    },
    Heading: {
      baseStyle: {
        color: "text.primary",
        fontWeight: "600",
      },
    },
    FormLabel: {
      baseStyle: {
        color: "text.secondary",
        fontSize: "sm",
        fontWeight: "500",
      },
    },
    Switch: {
      baseStyle: {
        track: {
          bg: "bg.emphasis",
          _checked: {
            bg: "primary.500",
          },
        },
      },
    },
    Spinner: {
      baseStyle: {
        color: "primary.500",
      },
    },
  },
});

export default theme;
