import type { AssetKind, Deployment } from "./types.js";

export type AssetSymbol =
  | "AAPL"
  | "NVDA"
  | "TSLA"
  | "F"
  | "SPY"
  | "GLD"
  | "BTC"
  | "ETH"
  | "ZEC"
  | "HYPE"
  | "SOL";

export interface Asset {
  symbol: AssetSymbol;
  name: string;
  kind: AssetKind;
  /** Mainnet mint, or null when no verified on-chain representation exists. */
  mint: string | null;
  /** Decimals of the mainnet mint (mock mints on devnet are always 6). */
  decimals: number;
  /** Token program of the mainnet mint. xStocks are Token-2022 (scaled-UI-amount extension). */
  tokenProgram: "spl-token" | "token-2022";
  /** Mock mint on devnet/localnet; filled in from the deployment file by `assetsForDeployment`. */
  mockMint: string | null;
  /** Pyth price feed id (32-byte hex, no 0x). */
  pythFeedId: string;
  /** Pyth symbol, e.g. "Equity.US.AAPL/USD". */
  pythSymbol: string;
  /** Display ticker of the mainnet token, e.g. "AAPLx". */
  ticker: string;
  note?: string;
}

/**
 * Asset registry.
 *
 * Pyth feed ids were verified live against Hermes `v2/price_feeds?query=<sym>` on 2026-09-26.
 * xStocks mainnet mints were verified against Jupiter's token API (`lite-api.jup.ag/tokens/v2/search`)
 * on the same date: all five are Jupiter-verified, Token-2022, 8 decimals, tagged "xstocks".
 * Crypto mints are the Jupiter-verified canonical wrapped assets; alternatives are noted.
 */
export const ASSETS: Record<AssetSymbol, Asset> = {
  AAPL: {
    symbol: "AAPL",
    name: "Apple",
    kind: "stock",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    pythSymbol: "Equity.US.AAPL/USD",
    ticker: "AAPLx",
  },
  NVDA: {
    symbol: "NVDA",
    name: "Nvidia",
    kind: "stock",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
    pythSymbol: "Equity.US.NVDA/USD",
    ticker: "NVDAx",
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla",
    kind: "stock",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    pythSymbol: "Equity.US.TSLA/USD",
    ticker: "TSLAx",
  },
  F: {
    symbol: "F",
    name: "Ford",
    kind: "stock",
    // No xStock for Ford exists as of 2026-09-26 (Jupiter search returns none). Mock only.
    mint: null,
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "6c267962d46cec4a5baf6105de67ef08e1306f75973ce6eb8db8527f06e28f33",
    pythSymbol: "Equity.US.F/USD",
    ticker: "Fx",
    note: "No mainnet xStock; devnet mock only.",
  },
  SPY: {
    symbol: "SPY",
    name: "S&P 500",
    kind: "stock",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
    pythSymbol: "Equity.US.SPY/USD",
    ticker: "SPYx",
  },
  GLD: {
    symbol: "GLD",
    name: "Gold",
    kind: "stock",
    mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
    decimals: 8,
    tokenProgram: "token-2022",
    mockMint: null,
    pythFeedId: "e190f467043db04548200354889dfe0d9d314c08b8d4e62fabf4d5a3140fecca",
    pythSymbol: "Equity.US.GLD/USD",
    ticker: "GLDx",
  },
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    // Coinbase Wrapped BTC (cbBTC). Alternative: Wormhole WBTC 3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh.
    mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    decimals: 8,
    tokenProgram: "spl-token",
    mockMint: null,
    pythFeedId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    pythSymbol: "Crypto.BTC/USD",
    ticker: "cbBTC",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    kind: "crypto",
    // Ether (Portal / Wormhole).
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    decimals: 8,
    tokenProgram: "spl-token",
    mockMint: null,
    pythFeedId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    pythSymbol: "Crypto.ETH/USD",
    ticker: "wETH",
  },
  ZEC: {
    symbol: "ZEC",
    name: "Zcash",
    kind: "crypto",
    mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    decimals: 8,
    tokenProgram: "spl-token",
    mockMint: null,
    pythFeedId: "be9b59d178f0d6a97ab4c343bff2aa69caa1eaae3e9048a65788c529b125bb24",
    pythSymbol: "Crypto.ZEC/USD",
    ticker: "ZEC",
  },
  HYPE: {
    symbol: "HYPE",
    name: "Hyperliquid",
    kind: "crypto",
    // Jupiter-verified "HYPE" (53k holders). Bridge issuer not independently verified; treat as best effort.
    mint: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    decimals: 9,
    tokenProgram: "spl-token",
    mockMint: null,
    pythFeedId: "4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b",
    pythSymbol: "Crypto.HYPE/USD",
    ticker: "HYPE",
    note: "Bridged HYPE; issuer not independently verified.",
  },
  SOL: {
    symbol: "SOL",
    name: "Solana",
    kind: "crypto",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    tokenProgram: "spl-token",
    mockMint: null,
    pythFeedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    pythSymbol: "Crypto.SOL/USD",
    ticker: "SOL",
  },
};

export const ASSET_SYMBOLS = Object.keys(ASSETS) as AssetSymbol[];

export function getAsset(symbol: string): Asset {
  const a = ASSETS[symbol as AssetSymbol];
  if (!a) throw new Error(`Unknown asset symbol: ${symbol}`);
  return a;
}

export function isAssetSymbol(s: string): s is AssetSymbol {
  return s in ASSETS;
}

/** Look up an asset by Pyth feed id (with or without 0x). */
export function assetByFeedId(feedId: string): Asset | undefined {
  const id = feedId.replace(/^0x/i, "").toLowerCase();
  return Object.values(ASSETS).find((a) => a.pythFeedId === id);
}

/** Registry with `mockMint` populated from a deployment file. */
export function assetsForDeployment(deployment: Deployment): Record<AssetSymbol, Asset> {
  const out = {} as Record<AssetSymbol, Asset>;
  for (const sym of ASSET_SYMBOLS) {
    const mock = deployment.mints[sym];
    out[sym] = { ...ASSETS[sym], mockMint: mock ? mock.mint : null };
  }
  return out;
}

/** The mint to trade on a given cluster: mock on devnet/localnet, real on mainnet. */
export function mintForCluster(asset: Asset, deployment: Deployment): string {
  if (deployment.cluster === "mainnet") {
    if (!asset.mint) throw new Error(`${asset.symbol} has no mainnet mint`);
    return asset.mint;
  }
  const mock = deployment.mints[asset.symbol];
  if (!mock) throw new Error(`${asset.symbol} has no mock mint in the ${deployment.cluster} deployment`);
  return mock.mint;
}
