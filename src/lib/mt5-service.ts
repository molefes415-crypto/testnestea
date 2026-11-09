import { MT5_SESSION_BLOCKER, validateConnection, type MT5ConnectionInput } from "./mt5-contract";

type GatewayInspection = { connected: false; code: string; endpoint: string; message: string };

// Credentials remain in the current form only. No browser persistence, remote
// URLs, logging, guessed PHP fields, or client-supplied account/session IDs.
export function createMT5Service(inspect: () => Promise<GatewayInspection>) {
  return {
    async connect(input: MT5ConnectionInput) {
      validateConnection(input);
      return inspect();
    },
    async account(): Promise<never> { throw new Error(MT5_SESSION_BLOCKER); },
    async symbols(): Promise<never> { throw new Error(MT5_SESSION_BLOCKER); },
    async trade(): Promise<never> { throw new Error("Trading is unavailable: no verified client-bound session or documented PHP order endpoint."); },
  };
}