import { it } from "node:test";
import assert from "node:assert/strict";
import { normalizeVaults, supportsStandardDeposit } from "./vaults";
const row = { id: 1, chain_id: 1, display_name: "USDC vault", protocol_name: "Aave", pool_address: `0x${"1".repeat(40)}`, asset_address: `0x${"2".repeat(40)}`, apr_30d_ma: 5.638, tvl_30d_ma: 1000000 };
it("keeps live APR in percentage units and projects only public vault fields", () => {
  const [vault] = normalizeVaults({ data: [{ ...row, token: "not-for-browser" }] });
  assert.equal(vault.apr, 5.638);
  assert.equal("token" in vault, false);
});
it("does not enable ERC4626 deposits on Aave pools", () => {
  assert.equal(supportsStandardDeposit(normalizeVaults({ data: [row] })[0]), false);
});
it("requires valid asset and vault addresses for standard deposit candidates", () => {
  const [vault] = normalizeVaults({ data: [{ ...row, protocol_name: "ERC-4626" }] });
  assert.equal(supportsStandardDeposit(vault), true);
  assert.equal(supportsStandardDeposit({ ...vault, asset: "invalid" }), false);
});