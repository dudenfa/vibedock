import type { ProviderId } from "../shared/providers";
import type { ProviderAdapter } from "./providers/base";
import { InstagramProvider } from "./providers/instagram";
import { TikTokProvider } from "./providers/tiktok";
import { XProvider } from "./providers/x";

export class ProviderRegistry {
  private readonly providers: Map<ProviderId, ProviderAdapter>;

  constructor() {
    const x = new XProvider();
    const tiktok = new TikTokProvider();
    const instagram = new InstagramProvider();
    this.providers = new Map<ProviderId, ProviderAdapter>([
      [x.definition.id, x],
      [tiktok.definition.id, tiktok],
      [instagram.definition.id, instagram]
    ]);
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
