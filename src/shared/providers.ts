export type ProviderId = "x" | "tiktok" | "instagram";
export type ProviderStatus = "idle" | "loading" | "ready" | "error";
export type ProviderSurface = "mobile" | "bootstrap";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
}

export interface ProviderTarget {
  providerId: ProviderId;
  input: string;
}

export interface ProviderResolvedTarget extends ProviderTarget {
  resolvedUrl: string;
  title: string;
}
