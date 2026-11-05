import { it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionResult, erc20Abi, erc4626Abi, type EIP1193Provider } from "viem";
import { depositVault, inspectDeposit } from "./vault-wallet";
import { type Vault } from "./vaults";
const vault: Vault = { id: 1, name: "Test vault", protocol: "ERC-4626", chainId: 1, address: `0x${"1".repeat(40)}`, asset: `0x${"2".repeat(40)}`, apr: 5, tvl: 1, risk: "B", strategy: "Lending" };
const account = `0x${"3".repeat(40)}` as const;
it("blocks unsupported pools before asking a wallet to transact", async () => {
  let calls = 0;
  const provider = { request: async () => { calls++; return null; } } as EIP1193Provider;
  await assert.rejects(inspectDeposit({ ...vault, protocol: "Aave" }, account, provider), /requires its own deposit flow/);
  assert.equal(calls, 0);
});
it("uses the selected provider and blocks deposits exceeding the token balance", async () => {
  const calls: string[] = [];
  const provider = { request: async ({ method, params }: { method: string; params?: unknown }) => {
    calls.push(method);
    if (method === "eth_chainId") return "0x1";
    const data = (params as [{ data: string }])[0].data;
    if (data.startsWith("0x38d52e0f")) return encodeFunctionResult({ abi: erc4626Abi, functionName: "asset", result: vault.asset as `0x${string}` });
    if (data.startsWith("0x313ce567")) return encodeFunctionResult({ abi: erc20Abi, functionName: "decimals", result: 6 });
    if (data.startsWith("0x95d89b41")) return encodeFunctionResult({ abi: erc20Abi, functionName: "symbol", result: "USDC" });
    if (data.startsWith("0x70a08231")) return encodeFunctionResult({ abi: erc20Abi, functionName: "balanceOf", result: 1000000n });
    if (data.startsWith("0x402d267d")) return encodeFunctionResult({ abi: erc4626Abi, functionName: "maxDeposit", result: 100000000n });
    throw new Error("Unexpected wallet call");
  } } as EIP1193Provider;
  await assert.rejects(depositVault(vault, account, "2", () => {}, provider), /within your balance/);
  assert.ok(calls.includes("eth_call"));
  assert.equal(calls.includes("eth_sendTransaction"), false);
});