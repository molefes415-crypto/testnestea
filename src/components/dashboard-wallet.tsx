import { Web3Boundary } from "./web3-boundary";
import { lazy, Suspense } from "react";
import { Button } from "./ui/button";
const WalletControl = lazy(() => import("./wallet-button").then(module => ({ default: module.WalletButton })));
export function DashboardWallet() {
  const fallback = <Button disabled>Connect Wallet</Button>;
  return <Web3Boundary fallback={fallback}><Suspense fallback={fallback}><WalletControl/></Suspense></Web3Boundary>;
}