/**
 * Kept for imports that still say "devnet": the SDK-backed adapter lives in `chain.ts` and
 * serves both the localnet and the devnet deployment.
 */
export { createChainData, createChainData as createDevnetData } from "./chain";
