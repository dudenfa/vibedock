import { z } from "zod";
import type { ProviderId, ProviderMode } from "./providers";

export const windowBoundsSchema = z.object({
  width: z.number().min(320).max(1920),
  height: z.number().min(240).max(1440),
  x: z.number().optional(),
  y: z.number().optional()
});

export const appSettingsSchema = z.object({
  version: z.literal(1),
  windowBounds: windowBoundsSchema,
  alwaysOnTop: z.boolean(),
  opacity: z.number().min(0.7).max(1),
  theme: z.enum(["system", "light", "dark"]),
  providerId: z.custom<ProviderId>((value) => value === "x"),
  mode: z.custom<ProviderMode>((value) => value === "browser" || value === "embed"),
  currentInput: z.string().min(1),
  xMobileEmulation: z.boolean(),
  shortcut: z.string().min(1),
  restoreLastSession: z.boolean(),
  startHidden: z.boolean(),
  launchAtLogin: z.boolean()
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = {
  version: 1,
  windowBounds: {
    width: 420,
    height: 680
  },
  alwaysOnTop: true,
  opacity: 0.98,
  theme: "system",
  providerId: "x",
  mode: "browser",
  currentInput: "https://x.com/home",
  xMobileEmulation: false,
  shortcut: "CommandOrControl+Shift+Space",
  restoreLastSession: true,
  startHidden: false,
  launchAtLogin: false
};
