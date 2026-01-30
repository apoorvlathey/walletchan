import { extendTheme, ThemeConfig } from "@chakra-ui/react";

// Bauhaus Design System - Bold, Geometric, Constructivist
// Primary colors: Red, Blue, Yellow + Black/White contrast

const colors = {
  // Background colors - Light mode Bauhaus canvas
  bg: {
    base: "#F0F0F0", // Off-white canvas
    subtle: "#FFFFFF", // Pure white for cards
    muted: "#E0E0E0", // Muted gray
    emphasis: "#D0D0D0", // Hover states
  },
  // Text colors - High contrast
  text: {
    primary: "#121212", // Stark black
    secondary: "#3A3A3A", // Dark gray
    tertiary: "#666666", // Medium gray
  },
  // Border colors - Bold black borders
  border: {
    subtle: "#121212",
    default: "#121212",
    strong: "#121212",
  },
  // Bauhaus Primary Colors
  bauhaus: {
    red: "#D02020",
    blue: "#1040C0",
    yellow: "#F0C020",
    black: "#121212",
    white: "#FFFFFF",
  },
  // Primary brand color (use blue as primary)
  primary: {
    400: "#1040C0",
    500: "#1040C0",
    600: "#0D3399",
    700: "#0A2673",
  },
  // Status colors - Bauhaus primaries
  success: {
    bg: "#F0C020",
    border: "#121212",
    solid: "#121212",
  },
  warning: {
    bg: "#F0C020",
    border: "#121212",
    solid: "#121212",
  },
  error: {
    bg: "#D02020",
    border: "#121212",
    solid: "#FFFFFF",
  },
  info: {
    bg: "#1040C0",
    border: "#121212",
    solid: "#FFFFFF",
  },
};

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors,
  fonts: {
    heading: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    body: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
        fontWeight: "700",
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
          boxShadow: "4px 4px 0px 0px #121212",
          _hover: {
            bg: "bauhaus.red",
            opacity: 0.9,
            _disabled: {
              bg: "bauhaus.red",
              opacity: 0.6,
            },
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        secondary: {
          bg: "bauhaus.white",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: "4px 4px 0px 0px #121212",
          _hover: {
            bg: "#F5F5F5",
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        ghost: {
          color: "text.primary",
          border: "none",
          _hover: {
            bg: "bg.muted",
          },
        },
        outline: {
          borderColor: "bauhaus.black",
          borderWidth: "2px",
          color: "text.primary",
          _hover: {
            bg: "bg.muted",
          },
          _active: {
            transform: "translate(1px, 1px)",
          },
        },
        blue: {
          bg: "bauhaus.blue",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: "4px 4px 0px 0px #121212",
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
          boxShadow: "4px 4px 0px 0px #121212",
          _hover: {
            bg: "bauhaus.yellow",
            opacity: 0.9,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          },
        },
        danger: {
          bg: "bauhaus.red",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          boxShadow: "4px 4px 0px 0px #121212",
          _hover: {
            bg: "bauhaus.red",
            opacity: 0.9,
          },
          _active: {
            transform: "translate(2px, 2px)",
            boxShadow: "none",
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
            bg: "bauhaus.white",
            border: "2px solid",
            borderColor: "bauhaus.black",
            borderRadius: "0",
            color: "text.primary",
            _placeholder: {
              color: "text.tertiary",
            },
            _hover: {
              bg: "bauhaus.white",
              borderColor: "bauhaus.black",
            },
            _focus: {
              bg: "bauhaus.white",
              borderColor: "bauhaus.blue",
              boxShadow: "3px 3px 0px 0px #1040C0",
            },
            _invalid: {
              borderColor: "bauhaus.red",
              boxShadow: "3px 3px 0px 0px #D02020",
            },
          },
        },
        outline: {
          field: {
            bg: "bauhaus.white",
            border: "2px solid",
            borderColor: "bauhaus.black",
            borderRadius: "0",
            color: "text.primary",
            _placeholder: {
              color: "text.tertiary",
            },
            _hover: {
              borderColor: "bauhaus.black",
            },
            _focus: {
              borderColor: "bauhaus.blue",
              boxShadow: "3px 3px 0px 0px #1040C0",
            },
            _invalid: {
              borderColor: "bauhaus.red",
              boxShadow: "3px 3px 0px 0px #D02020",
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
            bg: "bauhaus.white",
            border: "2px solid",
            borderColor: "bauhaus.black",
            borderRadius: "0",
            color: "text.primary",
            _hover: {
              bg: "bauhaus.white",
              borderColor: "bauhaus.black",
            },
            _focus: {
              bg: "bauhaus.white",
              borderColor: "bauhaus.blue",
            },
            "> option, > optgroup": {
              bg: "bauhaus.white",
              color: "text.primary",
            },
          },
          icon: {
            color: "text.primary",
          },
        },
      },
      defaultProps: {
        variant: "filled",
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: "0",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "wider",
      },
      variants: {
        success: {
          bg: "bauhaus.yellow",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        warning: {
          bg: "bauhaus.yellow",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        error: {
          bg: "bauhaus.red",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        info: {
          bg: "bauhaus.blue",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        blue: {
          bg: "bauhaus.blue",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        red: {
          bg: "bauhaus.red",
          color: "white",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
        yellow: {
          bg: "bauhaus.yellow",
          color: "bauhaus.black",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
      },
    },
    Alert: {
      variants: {
        subtle: (props: { status: string }) => {
          const status = props.status || "info";
          const statusColors: Record<string, { bg: string; border: string; text: string }> = {
            info: { bg: "bauhaus.blue", border: "bauhaus.black", text: "white" },
            warning: { bg: "bauhaus.yellow", border: "bauhaus.black", text: "bauhaus.black" },
            error: { bg: "bauhaus.red", border: "bauhaus.black", text: "white" },
            success: { bg: "bauhaus.yellow", border: "bauhaus.black", text: "bauhaus.black" },
          };
          const colors = statusColors[status] || statusColors.info;
          return {
            container: {
              bg: colors.bg,
              border: "2px solid",
              borderColor: colors.border,
              borderRadius: "0",
            },
            icon: {
              color: colors.text,
            },
            title: {
              color: colors.text,
              fontWeight: "700",
            },
            description: {
              color: colors.text,
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
        borderColor: "bauhaus.black",
        borderWidth: "2px",
      },
    },
    Code: {
      baseStyle: {
        bg: "bauhaus.white",
        color: "text.primary",
        fontFamily: "mono",
        borderRadius: "0",
        border: "1px solid",
        borderColor: "bauhaus.black",
      },
    },
    Heading: {
      baseStyle: {
        color: "text.primary",
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: "tight",
      },
    },
    FormLabel: {
      baseStyle: {
        color: "text.primary",
        fontSize: "sm",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "wider",
      },
    },
    Switch: {
      baseStyle: {
        track: {
          bg: "bg.muted",
          border: "2px solid",
          borderColor: "bauhaus.black",
          _checked: {
            bg: "bauhaus.blue",
          },
        },
        thumb: {
          bg: "bauhaus.white",
          border: "2px solid",
          borderColor: "bauhaus.black",
        },
      },
    },
    Spinner: {
      baseStyle: {
        color: "bauhaus.blue",
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: "bauhaus.white",
          border: "4px solid",
          borderColor: "bauhaus.black",
          borderRadius: "0",
          boxShadow: "8px 8px 0px 0px #121212",
        },
        header: {
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "wider",
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: "bauhaus.white",
          border: "2px solid",
          borderColor: "bauhaus.black",
          borderRadius: "0",
          boxShadow: "4px 4px 0px 0px #121212",
        },
        item: {
          bg: "bauhaus.white",
          _hover: {
            bg: "bauhaus.yellow",
          },
          _focus: {
            bg: "bauhaus.yellow",
          },
        },
      },
    },
    Tooltip: {
      baseStyle: {
        bg: "bauhaus.black",
        color: "bauhaus.white",
        borderRadius: "0",
        fontWeight: "500",
      },
    },
  },
});

export default theme;
