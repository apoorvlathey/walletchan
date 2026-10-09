/** Compatibility palette contracts for the legacy theme aliases. */
export interface LegacyBauhausPalette {
  red: string;
  blue: string;
  yellow: string;
  green: string;
  black: string;
  white: string;
}

export interface LegacyBgPalette {
  base: string;
  subtle: string;
  muted: string;
  emphasis: string;
}

export interface LegacyTextPalette {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface LegacyBorderPalette {
  subtle: string;
  default: string;
  strong: string;
}

export interface LegacyPrimaryPalette {
  400: string;
  500: string;
  600: string;
  700: string;
}

export interface LegacyStatusPalette {
  bg: string;
  border: string;
  solid: string;
}

export interface LegacyAliases {
  bauhaus: LegacyBauhausPalette;
  bg: LegacyBgPalette;
  text: LegacyTextPalette;
  border: LegacyBorderPalette;
  primary: LegacyPrimaryPalette;
  success: LegacyStatusPalette;
  warning: LegacyStatusPalette;
  error: LegacyStatusPalette;
  info: LegacyStatusPalette;
}
