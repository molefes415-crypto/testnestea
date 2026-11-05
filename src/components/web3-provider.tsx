import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { mainnet, arbitrum, optimism, base, polygon, avalanche, bsc, celo, linea, scroll, zkSync, metis, fantom } from "wagmi/chains";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

export default function Web3Provider({ children }: { children: ReactNode }) {
  // Created only after hydration; EIP-6963 discovers installed wallet names/icons.
  const [config] = useState(() => createConfig({
    chains: [mainnet, arbitrum, optimism, base, polygon, avalanche, bsc, celo, linea, scroll, zkSync, metis, fantom],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    transports: { [mainnet.id]: http(), [arbitrum.id]: http(), [optimism.id]: http(), [base.id]: http(), [polygon.id]: http(), [avalanche.id]: http(), [bsc.id]: http(), [celo.id]: http(), [linea.id]: http(), [scroll.id]: http(), [zkSync.id]: http(), [metis.id]: http(), [fantom.id]: http() },
  }));
  return <WagmiProvider config={config}><RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider></WagmiProvider>;
}