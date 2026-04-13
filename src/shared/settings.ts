import { z } from "zod";
import type { ProviderId } from "./providers";

export const windowBoundsSchema = z.object({
  width: z.number().min(320).max(1920),
  height: z.number().min(240).max(1440),
  x: z.number().optional(),
  y: z.number().optional()
});

export const providerTabSettingsSchema = z.object({
  currentInput: z.string().min(1),
  bootstrapCompleted: z.boolean()
});

const providerTabsSchema = z.object({
  x: providerTabSettingsSchema,
  tiktok: providerTabSettingsSchema
});

const providerIdSchema = z.enum(["x", "tiktok"]);

export const appSettingsSchema = z.object({
  version: z.literal(2),
  windowBounds: windowBoundsSchema,
  alwaysOnTop: z.boolean(),
  opacity: z.number().min(0.7).max(1),
  activeProviderId: providerIdSchema,
  providerTabs: providerTabsSchema,
  providerId: providerIdSchema,
  currentInput: z.string().min(1),
  xBootstrapCompleted: z.boolean(),
  shortcut: z.string().min(1),
  restoreLastSession: z.boolean(),
  startHidden: z.boolean(),
  launchAtLogin: z.boolean()
});

const v2StoredSettingsSchema = appSettingsSchema.omit({
  providerId: true,
  currentInput: true,
  xBootstrapCompleted: true
}).extend({
  providerId: providerIdSchema.optional(),
  currentInput: z.string().min(1).optional(),
  xBootstrapCompleted: z.boolean().optional()
});

const legacySettingsSchema = z.object({
  version: z.literal(1).optional(),
  windowBounds: windowBoundsSchema.partial().optional(),
  alwaysOnTop: z.boolean().optional(),
  opacity: z.number().min(0.7).max(1).optional(),
  providerId: z.literal("x").optional(),
  currentInput: z.string().min(1).optional(),
  xBootstrapCompleted: z.boolean().optional(),
  shortcut: z.string().min(1).optional(),
  restoreLastSession: z.boolean().optional(),
  startHidden: z.boolean().optional(),
  launchAtLogin: z.boolean().optional()
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

function createDefaultProviderTabs(): AppSettings["providerTabs"] {
  return {
    x: {
      currentInput: "https://x.com/home",
      bootstrapCompleted: false
    },
    tiktok: {
      currentInput: "https://www.tiktok.com/foryou",
      bootstrapCompleted: false
    }
  };
}

function withCompatAliases(
  settings: Omit<AppSettings, "providerId" | "currentInput" | "xBootstrapCompleted">
): AppSettings {
  const activeTab = settings.providerTabs[settings.activeProviderId];
  return {
    ...settings,
    providerId: settings.activeProviderId,
    currentInput: activeTab.currentInput,
    xBootstrapCompleted: activeTab.bootstrapCompleted
  };
}

function buildDefaultSettings(): AppSettings {
  return withCompatAliases({
    version: 2,
    windowBounds: {
      width: 420,
      height: 680
    },
    alwaysOnTop: true,
    opacity: 0.98,
    activeProviderId: "x",
    providerTabs: createDefaultProviderTabs(),
    shortcut: "CommandOrControl+Shift+Space",
    restoreLastSession: true,
    startHidden: false,
    launchAtLogin: false
  });
}

function normalizeV2Settings(raw: z.infer<typeof v2StoredSettingsSchema>): AppSettings {
  return withCompatAliases({
    version: 2,
    windowBounds: {
      ...defaultSettings.windowBounds,
      ...raw.windowBounds
    },
    alwaysOnTop: raw.alwaysOnTop,
    opacity: raw.opacity,
    activeProviderId: raw.activeProviderId,
    providerTabs: {
      x: {
        ...defaultSettings.providerTabs.x,
        ...raw.providerTabs.x
      },
      tiktok: {
        ...defaultSettings.providerTabs.tiktok,
        ...raw.providerTabs.tiktok
      }
    },
    shortcut: raw.shortcut,
    restoreLastSession: raw.restoreLastSession,
    startHidden: raw.startHidden,
    launchAtLogin: raw.launchAtLogin
  });
}

function normalizeLegacySettings(
  raw: z.infer<typeof legacySettingsSchema>,
  hasPersistedXSessionArtifacts: boolean
): AppSettings {
  const legacyBootstrap =
    typeof raw.xBootstrapCompleted === "boolean"
      ? raw.xBootstrapCompleted
      : hasPersistedXSessionArtifacts;

  return withCompatAliases({
    version: 2,
    windowBounds: {
      ...defaultSettings.windowBounds,
      ...raw.windowBounds
    },
    alwaysOnTop: raw.alwaysOnTop ?? defaultSettings.alwaysOnTop,
    opacity: raw.opacity ?? defaultSettings.opacity,
    activeProviderId: "x",
    providerTabs: {
      x: {
        currentInput: raw.currentInput ?? defaultSettings.providerTabs.x.currentInput,
        bootstrapCompleted: legacyBootstrap
      },
      tiktok: {
        ...defaultSettings.providerTabs.tiktok
      }
    },
    shortcut: raw.shortcut ?? defaultSettings.shortcut,
    restoreLastSession: raw.restoreLastSession ?? defaultSettings.restoreLastSession,
    startHidden: raw.startHidden ?? defaultSettings.startHidden,
    launchAtLogin: raw.launchAtLogin ?? defaultSettings.launchAtLogin
  });
}

export interface NormalizeStoredSettingsOptions {
  hasPersistedXSessionArtifacts?: boolean;
}

export function normalizeStoredSettings(
  raw: unknown,
  options: NormalizeStoredSettingsOptions = {}
): AppSettings {
  const v2Parsed = v2StoredSettingsSchema.safeParse(raw);
  if (v2Parsed.success) {
    return normalizeV2Settings(v2Parsed.data);
  }

  const legacyParsed = legacySettingsSchema.safeParse(raw);
  if (legacyParsed.success) {
    return normalizeLegacySettings(legacyParsed.data, Boolean(options.hasPersistedXSessionArtifacts));
  }

  return defaultSettings;
}

export const defaultSettings = buildDefaultSettings();

export function buildProviderTabsPatch(
  current: AppSettings["providerTabs"],
  providerId: ProviderId,
  next: Partial<AppSettings["providerTabs"][ProviderId]>
): AppSettings["providerTabs"] {
  return {
    ...current,
    [providerId]: {
      ...current[providerId],
      ...next
    }
  };
}
