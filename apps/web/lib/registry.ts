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

export const ASSETS: Asset[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    label: "Apple",
    pairSymbol: "AAPLx",
    kind: "stock",
    feedId: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
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
    feedId: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
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
    feedId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
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
    feedId: "0x8e7fb0c9eb9d2a2c3a1a3f8d7bd6c5a9c1f3e2d4b5a6c7d8e9f0a1b2c3d4e5f6",
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
    feedId: "0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
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
    feedId: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
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
    feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
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
    feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
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
    feedId: "0xbe9b59d178f0d6a97ab4c343bff2aa69caa1eaae3e9048a65788c529b125bb24",
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
    feedId: "0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b",
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
    feedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
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
