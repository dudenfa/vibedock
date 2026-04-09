export type ProviderId = "x";
export type ProviderMode = "browser" | "embed";
export type ProviderStatus = "idle" | "loading" | "ready" | "error";

export interface ProviderCapabilities {
  browser: boolean;
  embed: boolean;
  browserExperimental?: boolean;
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderTarget {
  providerId: ProviderId;
  mode: ProviderMode;
  input: string;
}

export interface ProviderResolvedTarget extends ProviderTarget {
  resolvedUrl: string;
  title: string;
}

