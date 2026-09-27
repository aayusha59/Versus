use anchor_lang::prelude::*;

use crate::state::Side;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub nonce: u64,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub pair_a_mint: Pubkey,
    pub pair_b_mint: Pubkey,
    pub resolve_ts: i64,
}

#[event]
pub struct PoolsSet {
    pub market: Pubkey,
    pub pool_a: Pubkey,
    pub pool_b: Pubkey,
}

#[event]
pub struct SetMinted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SetMerged {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winner: Side,
    /// USD scaled by 1e6.
    pub price_a: i64,
    /// USD scaled by 1e6 (0 for PriceAbove).
    pub price_b: i64,
    pub resolved_ts: i64,
    pub manual: bool,
}

#[event]
pub struct Redeemed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: Side,
    pub amount: u64,
}

#[event]
pub struct RewardsDeposited {
    pub market: Pubkey,
    pub side: Side,
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RewardsPaid {
    pub market: Pubkey,
    pub side: Side,
    pub epoch: u32,
    pub total: u64,
    pub count: u32,
}
