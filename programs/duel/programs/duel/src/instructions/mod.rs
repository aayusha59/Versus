pub mod create_market;
pub mod deposit_rewards;
pub mod distribute;
pub mod merge_set;
pub mod mint_set;
pub mod redeem;
pub mod resolve;
pub mod resolve_manual;
pub mod set_pools;

// Glob re-exports: `#[program]` needs the `__client_accounts_*` / `__cpi_client_accounts_*`
// modules that `#[derive(Accounts)]` generates next to each struct. Handlers are always called by
// their full path (`instructions::x::handler`) so the duplicate `handler` names never clash.
pub use create_market::*;
pub use deposit_rewards::*;
pub use distribute::*;
pub use merge_set::*;
pub use mint_set::*;
pub use redeem::*;
pub use resolve::*;
pub use resolve_manual::*;
pub use set_pools::*;

use anchor_lang::prelude::*;

use crate::state::{Market, MARKET_SEED};

/// Owned copy of the market PDA seeds so handlers can sign CPIs while mutating the market.
pub struct MarketSigner {
    creator: Pubkey,
    nonce: [u8; 8],
    bump: [u8; 1],
}

impl MarketSigner {
    pub fn new(market: &Market) -> Self {
        Self {
            creator: market.creator,
            nonce: market.nonce.to_le_bytes(),
            bump: [market.bump],
        }
    }

    pub fn seeds(&self) -> [&[u8]; 4] {
        [MARKET_SEED, self.creator.as_ref(), &self.nonce, &self.bump]
    }
}
