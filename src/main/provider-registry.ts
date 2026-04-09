import type { ProviderId } from "../shared/providers";
import type { ProviderAdapter } from "./providers/base";
import { XProvider } from "./providers/x";

export class ProviderRegistry {
  private readonly providers: Map<ProviderId, ProviderAdapter>;

  constructor() {
    const x = new XProvider();
    this.providers = new Map([[x.definition.id, x]]);
  }

  get(providerId: ProviderId): ProviderAdapter {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    return provider;
  }

  list() {
    return [...this.providers.values()].map((provider) => provider.definition);
  }
}

