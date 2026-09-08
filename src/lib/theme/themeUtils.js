// src/lib/theme/themeUtils.js

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseHex = (hex) => {
  if (!HEX_COLOR_REGEX.test(hex)) return null;
  const normalized = hex.slice(1, 7);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
};

const toHex = (value) => value.toString(16).padStart(2, '0');

const toHexColor = ({ r, g, b }) => `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(clamp(Math.round(g), 0, 255))}${toHex(clamp(Math.round(b), 0, 255))}`;

export const isHexColor = (value) => typeof value === 'string' && HEX_COLOR_REGEX.test(value);

export const withAlpha = (hex, alpha = 0.2) => {
  const rgb = parseHex(hex);
  if (!rgb) return '#00000033';
  const channel = toHex(clamp(Math.round(alpha * 255), 0, 255));
  return `${toHexColor(rgb)}${channel}`;
};

export const mixColors = (hexA, hexB, ratio = 0.5) => {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return '#000000';
  const t = clamp(ratio, 0, 1);
  return toHexColor({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
};

const channelToLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
};

export const luminance = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
};

export const bestTextColor = (backgroundHex) => {
  const l = luminance(backgroundHex);
  return l > 0.5 ? '#000000' : '#FFFFFF';
};

export const resolveThemeMode = (theme, lightTheme, darkTheme) => {
  const normalizedName = theme?.name?.toLowerCase?.() || '';
  if (normalizedName.includes('light')) return 'light';
  if (normalizedName.includes('dark')) return 'dark';

  if (isHexColor(theme?.background)) {
    return luminance(theme.background) > 0.5 ? 'light' : 'dark';
  }
  if (theme?.background === lightTheme?.background) return 'light';
  return 'dark';
};

export const normalizeTheme = (theme, lightTheme, darkTheme) => {
  const mode = resolveThemeMode(theme, lightTheme, darkTheme);
  const preset = mode === 'light' ? lightTheme : darkTheme;
  const merged = { ...preset, ...(theme || {}) };

  const primary = merged.primary;
  const surface = merged.surface;
  const background = merged.background;
  const border = merged.border;
  const success = merged.success;
  const warning = merged.warning;
  const error = merged.error;
  const info = merged.info;

  const normalized = {
    ...merged,
    name: mode === 'light' ? 'Light Mode' : 'Dark Mode',
    primaryMuted: merged.primaryMuted || withAlpha(primary, mode === 'light' ? 0.16 : 0.2),
    surfaceAlt: merged.surfaceAlt || mixColors(surface, background, mode === 'light' ? 0.4 : 0.3),
    surfaceMuted: merged.surfaceMuted || mixColors(surface, background, mode === 'light' ? 0.55 : 0.45),
    card: merged.card || surface,
    cardHover: merged.cardHover || merged.surfaceHover,
    cardAlt: merged.cardAlt || merged.surfaceAlt || surface,
    borderLight: merged.borderLight || mixColors(border, background, mode === 'light' ? 0.5 : 0.35),
    borderHover: merged.borderHover || withAlpha(primary, mode === 'light' ? 0.55 : 0.35),
    textMuted: merged.textMuted || mixColors(merged.textSecondary, background, mode === 'light' ? 0.35 : 0.3),
    textOnPrimary: merged.textOnPrimary || bestTextColor(primary),
    successMuted: merged.successMuted || withAlpha(success, mode === 'light' ? 0.14 : 0.2),
    warningMuted: merged.warningMuted || withAlpha(warning, mode === 'light' ? 0.14 : 0.2),
    errorMuted: merged.errorMuted || withAlpha(error, mode === 'light' ? 0.14 : 0.2),
    infoMuted: merged.infoMuted || withAlpha(info, mode === 'light' ? 0.14 : 0.2),
    accent1: merged.accent1 || preset.accent1,
    accent2: merged.accent2 || preset.accent2,
    accent3: merged.accent3 || preset.accent3,
    bannerBg: merged.bannerBg || preset.bannerBg,
    bannerText: merged.bannerText || preset.bannerText,
    bannerBorder: merged.bannerBorder || mixColors(merged.bannerBg || preset.bannerBg, merged.bannerText || preset.bannerText, mode === 'light' ? 0.2 : 0.35),
    popupBg: merged.popupBg || (mode === 'light' ? '#FFFFFF' : '#FFFFFF'),
    popupBorder: merged.popupBorder || (mode === 'light' ? '#D0D4D3' : '#D0D4D3'),
    popupText: merged.popupText || '#001E2B',
    popupTextSecondary: merged.popupTextSecondary || '#5C6C75',
    popupHover: merged.popupHover || '#F5F6F7'
  };

  return normalized;
};
