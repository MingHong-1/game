export const UI_COLORS = Object.freeze({
  pageBackground: 0x06171d,
  pageDeep: 0x031016,
  battleBackground: 0x103238,
  battleMist: 0x7bc7c1,
  forestDark: 0x0b282c,
  forestMid: 0x174047,
  road: 0x33464a,
  roadEdge: 0x8a7752,
  roadRune: 0x55c9d4,
  panel: 0x0a2130,
  panelStrong: 0x102f40,
  panelHighlight: 0x17475a,
  panelBorder: 0x9b8756,
  panelBorderSoft: 0x4f7680,
  primary: 0x35c9e4,
  primaryHover: 0x5cdef1,
  primaryPressed: 0x1b8fae,
  energy: 0x67e5f2,
  coreHealthy: 0x66e3b4,
  coreWarning: 0xf1c75b,
  coreDanger: 0xf06b6e,
  star: 0xf1d486,
  danger: 0x9e3e48,
  dangerHover: 0xc7525b,
  locked: 0x657a83,
  disabled: 0x43545c,
  textPrimary: 0xf2fbf7,
  textSecondary: 0xaac5c8,
  textMuted: 0x6f9298,
  textHint: 0xf1d486,
  shadow: 0x02080c,
  white: 0xffffff,
});

export const BATTLE_BACKGROUND_BANDS = Object.freeze([
  0x17474a,
  0x143f43,
  0x11373c,
  0x0e3036,
]);

export const UI_CSS_COLORS = Object.freeze({
  debugBackground: '#031016dd',
});

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export type UiTone = 'normal' | 'accent' | 'success' | 'warning' | 'danger';

export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger';

export interface ActionButtonVisualState {
  readonly enabled: boolean;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly pressed: boolean;
}

export interface ActionButtonVisualStyle {
  readonly fill: number;
  readonly border: number;
  readonly fillAlpha: number;
  readonly borderAlpha: number;
  readonly containerAlpha: number;
}

export function getToneColor(tone: UiTone): number {
  if (tone === 'accent') return UI_COLORS.primary;
  if (tone === 'success') return UI_COLORS.coreHealthy;
  if (tone === 'warning') return UI_COLORS.star;
  if (tone === 'danger') return UI_COLORS.coreDanger;
  return UI_COLORS.panelBorderSoft;
}

export function resolveActionButtonVisualStyle(
  variant: ActionButtonVariant,
  state: ActionButtonVisualState,
): ActionButtonVisualStyle {
  if (!state.enabled) {
    return {
      fill: UI_COLORS.disabled,
      border: UI_COLORS.locked,
      fillAlpha: 0.28,
      borderAlpha: 0.38,
      containerAlpha: 0.46,
    };
  }

  let fill: number = UI_COLORS.panelHighlight;
  let border: number = UI_COLORS.panelBorderSoft;
  if (variant === 'primary') {
    fill = UI_COLORS.primaryPressed;
    border = UI_COLORS.primary;
  } else if (variant === 'danger') {
    fill = UI_COLORS.danger;
    border = UI_COLORS.coreDanger;
  } else if (variant === 'tertiary' || variant === 'ghost') {
    fill = UI_COLORS.panel;
    border = UI_COLORS.panelBorder;
  }
  if (state.selected) {
    fill = UI_COLORS.panelHighlight;
    border = UI_COLORS.star;
  }
  if (state.focused) {
    fill = variant === 'danger' ? UI_COLORS.dangerHover : UI_COLORS.primaryHover;
  }
  if (state.pressed) fill = UI_COLORS.primaryPressed;

  return {
    fill,
    border,
    fillAlpha: 0.94,
    borderAlpha: 1,
    containerAlpha: 1,
  };
}
