//! Paired prediction duels.
//!
//! A market is a head-to-head question with two fully collateralized outcome
//! tokens, YES and NO. Anyone mints a full set (1 YES + 1 NO) for 1 unit of
//! collateral and merges it back at any time. After `resolve_ts` the market is
//! resolved permissionlessly from Pyth prices (or by the resolver after a grace
//! period) and the winning token redeems 1:1 for collateral. Trading-fee rewards
//! in the paired stock tokens are deposited into per-side vaults and paid out
//! pro-rata by a crank.

#![allow(clippy::result_large_err)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod pyth;
pub mod state;

use instructions::*;
use state::*;

declare_id!("AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25");

#[program]
pub mod duel {
    use super::*;

    /// Create a market, its YES/NO mints, the collateral vault and both reward vaults.
    pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
        instructions::create_market::handler(ctx, params)
    }

    /// Record the Meteora pool addresses. Creator only, once.
    pub fn set_pools(ctx: Context<SetPools>, pool_a: Pubkey, pool_b: Pubkey) -> Result<()> {
        instructions::set_pools::handler(ctx, pool_a, pool_b)
    }

    /// Deposit `amount` collateral and receive `amount` YES and `amount` NO.
    pub fn mint_set(ctx: Context<MintSet>, amount: u64) -> Result<()> {
        instructions::mint_set::handler(ctx, amount)
    }

    /// Burn `amount` YES and `amount` NO and withdraw `amount` collateral.
    pub fn merge_set(ctx: Context<MergeSet>, amount: u64) -> Result<()> {
        instructions::merge_set::handler(ctx, amount)
    }

    /// Permissionless resolution from Pyth `PriceUpdateV2` accounts after `resolve_ts`.
    pub fn resolve(ctx: Context<Resolve>) -> Result<()> {
        instructions::resolve::handler(ctx)
    }

    /// Resolver-only fallback after `resolve_ts + grace_secs`. Prices are USD scaled by 1e6.
    pub fn resolve_manual(
        ctx: Context<ResolveManual>,
        winner: Side,
        price_a: i64,
        price_b: i64,
    ) -> Result<()> {
        instructions::resolve_manual::handler(ctx, winner, price_a, price_b)
    }

    /// Burn `amount` winning tokens and withdraw `amount` collateral.
    pub fn redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
        instructions::redeem::handler(ctx, amount)
    }

    /// Deposit pair tokens into a side's reward vault (anyone).
    pub fn deposit_rewards(ctx: Context<DepositRewards>, side: Side, amount: u64) -> Result<()> {
        instructions::deposit_rewards::handler(ctx, side, amount)
    }

    /// Crank-only: pay `amounts[i]` from the side's reward vault to `remaining_accounts[i]`.
    pub fn distribute<'info>(
        ctx: Context<'_, '_, 'info, 'info, Distribute<'info>>,
        side: Side,
        amounts: Vec<u64>,
    ) -> Result<()> {
        instructions::distribute::handler(ctx, side, amounts)
    }
}
