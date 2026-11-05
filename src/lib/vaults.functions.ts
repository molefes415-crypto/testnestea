import { createServerFn } from "@tanstack/react-start";
import { normalizeVaults } from "./vaults";

export const getVaults = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env["PIGI_API_KEY"];
  if (!apiKey) return { vaults: [], error: "Pigi Finance is not configured." };
  const { fetchPigiVaults, PigiError } = await import("./pigi.server");
  try {
    // Publish only the selected public analytics, never raw auth/provider data.
    return { vaults: normalizeVaults(await fetchPigiVaults(apiKey)), error: null };
  } catch (error) {
    return { vaults: [], error: error instanceof PigiError ? error.message : "Vaults are temporarily unavailable. Please try again." };
  }
});