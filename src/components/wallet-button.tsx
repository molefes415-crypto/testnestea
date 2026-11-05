import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WalletButton() {
  return <ConnectButton.Custom>{({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => <Button disabled={!mounted} variant={account ? "outline" : "default"} onClick={!account ? openConnectModal : chain?.unsupported ? openChainModal : openAccountModal}><Wallet/>{!account ? "Connect Wallet" : chain?.unsupported ? "Switch network" : account.displayName}</Button>}</ConnectButton.Custom>;
}