export type WindowSizePreset = "small" | "medium" | "big";

export const WINDOW_SIZE_PRESETS: Record<
  WindowSizePreset,
  {
    width: number;
    height: number;
    label: string;
  }
> = {
  small: {
    width: 392,
    height: 720,
    label: "Small"
  },
  medium: {
    width: 448,
    height: 840,
    label: "Medium"
  },
  big: {
    width: 504,
    height: 960,
    label: "Big"
  }
};

export const DEFAULT_WINDOW_SIZE_PRESET: WindowSizePreset = "medium";
