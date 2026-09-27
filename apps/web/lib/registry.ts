import { ASSETS as SDK_ASSETS, type AssetSymbol } from "@versus/sdk/browser";
import type { AssetKind } from "./types";

export interface Asset {
  symbol: string;
  name: string;
  /** Short fight-card name used in headlines. */
  label: string;
  pairSymbol: string;
  kind: AssetKind;
  /** Pyth price feed id (hex) and its display name. */
  feedId: string;
  feedName: string;
  /** Shares outstanding for CapCompare templates; null for crypto. */
  shares: number | null;
  /** Reference price used by demo fixtures and the create-duel preview. */
  refPrice: number;
  /** Mainnet mint of the pair token (xStocks / wrapped) and the devnet mock. */
  mint: string;
  mockMint: string | null;
}

const B = 1_000_000_000;

const feed = (symbol: AssetSymbol) => `0x${SDK_ASSETS[symbol].pythFeedId}`;

export const ASSETS: Asset[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    label: "Apple",
    pairSymbol: "AAPLx",
    kind: "stock",
    feedId: feed("AAPL"),
    feedName: "AAPL/USD",
    shares: 14.78 * B,
    refPrice: 291.2,
    mint: "XsbEgz7M2JeCyrGfqDQ2rLjR4Kgsvrqm4Lpg5hjVaGp",
    mockMint: null,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    label: "Nvidia",
    pairSymbol: "NVDAx",
    kind: "stock",
    feedId: feed("NVDA"),
    feedName: "NVDA/USD",
    shares: 24.4 * B,
    refPrice: 171.35,
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    mockMint: null,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    label: "Tesla",
    pairSymbol: "TSLAx",
    kind: "stock",
    feedId: feed("TSLA"),
    feedName: "TSLA/USD",
    shares: 3.22 * B,
    refPrice: 412.6,
    mint: "XsDoVfqeBukxuZHWhdvWHBhgnNVfUXqjBTzGcdRDw4h",
    mockMint: null,
  },
  {
    symbol: "F",
    name: "Ford Motor Co.",
    label: "Ford",
    pairSymbol: "Fx",
    kind: "stock",
    feedId: feed("F"),
    feedName: "F/USD",
    shares: 3.98 * B,
    refPrice: 11.84,
    mint: "XsFx1vGDzq1ZfWBbY1Uhw6mDsxnkVgb9hLPj5Jt2YQ6",
    mockMint: null,
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    label: "S&P 500",
    pairSymbol: "SPYx",
    kind: "etf",
    feedId: feed("SPY"),
    feedName: "SPY/USD",
    shares: 1.0 * B,
    refPrice: 668.4,
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    mockMint: null,
  },
  {
    symbol: "GLD",
    name: "SPDR Gold Shares",
    label: "Gold",
    pairSymbol: "GLDx",
    kind: "commodity",
    feedId: feed("GLD"),
    feedName: "GLD/USD",
    shares: 0.31 * B,
    refPrice: 344.9,
    mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
    mockMint: null,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    label: "Bitcoin",
    pairSymbol: "wBTC",
    kind: "crypto",
    feedId: feed("BTC"),
    feedName: "BTC/USD",
    shares: null,
    refPrice: 109_420,
    mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    mockMint: null,
  },
  {
    symbol: "ETH",
    name: "Ether",
    label: "Ethereum",
    pairSymbol: "wETH",
    kind: "crypto",
    feedId: feed("ETH"),
    feedName: "ETH/USD",
    shares: null,
    refPrice: 3_942,
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    mockMint: null,
  },
  {
    symbol: "ZEC",
    name: "Zcash",
    label: "Zcash",
    pairSymbol: "ZEC",
    kind: "crypto",
    feedId: feed("ZEC"),
    feedName: "ZEC/USD",
    shares: null,
    refPrice: 62.4,
    mint: "ZECcuXQ6D7Yd1yUdWQvYzT4nZ4eE1tqGbVpbVSbhfnf",
    mockMint: null,
  },
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    label: "Hyperliquid",
    pairSymbol: "HYPE",
    kind: "crypto",
    feedId: feed("HYPE"),
    feedName: "HYPE/USD",
    shares: null,
    refPrice: 44.1,
    mint: "HYPEu8rXqK4zX3uQ4Z7dXo4QdN1Mm7f2xvDbP9Yv3zq",
    mockMint: null,
  },
  {
    symbol: "SOL",
    name: "Solana",
    label: "Solana",
    pairSymbol: "SOL",
    kind: "crypto",
    feedId: feed("SOL"),
    feedName: "SOL/USD",
    shares: null,
    refPrice: 214.7,
    mint: "So11111111111111111111111111111111111111112",
    mockMint: null,
  },
];

export const ASSET_BY_SYMBOL: Record<string, Asset> = Object.fromEntries(
  ASSETS.map((a) => [a.symbol, a]),
);

export function getAsset(symbol: string): Asset {
  const a = ASSET_BY_SYMBOL[symbol];
  if (!a) throw new Error(`Unknown asset ${symbol}`);
  return a;
}

export const KIND_LABEL: Record<AssetKind, string> = {
  stock: "Stocks",
  etf: "Index",
  commodity: "Commodities",
  crypto: "Crypto",
};

export const KIND_ORDER: AssetKind[] = ["stock", "etf", "commodity", "crypto"];
