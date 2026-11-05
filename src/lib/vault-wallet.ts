import { createPublicClient, createWalletClient, custom, erc20Abi, erc4626Abi, getAddress, parseUnits, type Address, type EIP1193Provider } from "viem";
import { supportsStandardDeposit, type Vault } from "./vaults";

export function injectedProvider(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}
export async function connectWallet() {
  const provider = injectedProvider();
  if (!provider) throw new Error("Open this page in MetaMask’s browser or install a compatible wallet.");
  const wallet = createWalletClient({ transport: custom(provider) });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("No wallet account selected.");
  return account;
}
export async function inspectDeposit(vault: Vault, account: Address) {
  if (!supportsStandardDeposit(vault)) throw new Error("This protocol requires its own deposit flow; direct deposits are unavailable.");
  const provider = injectedProvider();
  if (!provider) throw new Error("Connect a wallet first.");
  const wallet = createWalletClient({ transport: custom(provider) });
  if (await wallet.getChainId() !== vault.chainId) await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${vault.chainId.toString(16)}` }] });
  const client = createPublicClient({ transport: custom(provider) });
  const address = getAddress(vault.address);
  const asset = await client.readContract({ address, abi: erc4626Abi, functionName: "asset" });
  if (getAddress(asset) !== getAddress(vault.asset)) throw new Error("Vault asset does not match Pigi’s data. Deposit blocked.");
  const [decimals, symbol, balance, maximum] = await Promise.all([
    client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    client.readContract({ address, abi: erc4626Abi, functionName: "maxDeposit", args: [account] }),
  ]);
  return { asset, decimals, symbol, balance, maximum };
}
export async function depositVault(vault: Vault, account: Address, amount: string, onState: (state: string) => void) {
  const details = await inspectDeposit(vault, account);
  const quantity = parseUnits(amount, details.decimals);
  if (quantity <= 0n || quantity > details.balance || quantity > details.maximum) throw new Error("Amount must be positive and within your balance and the vault’s deposit limit.");
  const provider = injectedProvider();
  if (!provider) throw new Error("Wallet disconnected.");
  const wallet = createWalletClient({ transport: custom(provider) });
  const client = createPublicClient({ transport: custom(provider) });
  const [current] = await wallet.getAddresses();
  if (current?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account changed. Reconnect before depositing.");
  const address = getAddress(vault.address);
  const shares = await client.readContract({ address, abi: erc4626Abi, functionName: "previewDeposit", args: [quantity] });
  if (shares <= 0n) throw new Error("Vault would return no shares. Deposit blocked.");
  const allowance = await client.readContract({ address: details.asset, abi: erc20Abi, functionName: "allowance", args: [account, address] });
  if (allowance < quantity) {
    onState("Approve the exact token amount in your wallet");
    const approval = await client.simulateContract({ account, address: details.asset, abi: erc20Abi, functionName: "approve", args: [address, quantity] });
    const hash = await wallet.writeContract({ ...approval.request, chain: null });
    onState("Waiting for approval confirmation");
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120000 });
    if (receipt.status !== "success") throw new Error("Token approval failed.");
  }
  if (await wallet.getChainId() !== vault.chainId || (await wallet.getAddresses())[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet changed. Deposit cancelled.");
  const checked = await client.simulateContract({ account, address, abi: erc4626Abi, functionName: "deposit", args: [quantity, account] });
  onState("Confirm the deposit in your wallet");
  const hash = await wallet.writeContract({ ...checked.request, chain: null });
  onState(`Deposit submitted: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120000 });
  if (receipt.status !== "success") throw new Error("Deposit transaction failed.");
  return hash;
}