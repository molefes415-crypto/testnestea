import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
const Web3Provider = lazy(() => import("./web3-provider"));
export function Web3Boundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <ClientOnly fallback={fallback}><Suspense fallback={fallback}><Web3Provider>{children}</Web3Provider></Suspense></ClientOnly>;
}