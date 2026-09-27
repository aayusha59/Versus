use anchor_lang::prelude::*;

use crate::errors::DuelError;
use crate::events::MarketResolved;
use crate::math::{self, OraclePrice};
use crate::pyth::PriceUpdateV2;
use crate::state::*;

#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: validated in the handler as a Pyth `PriceUpdateV2` (owner, discriminator,
    /// full verification, feed id, freshness) for feed A (or the single `PriceAbove` feed).
    pub price_update_a: UncheckedAccount<'info>,

    /// CHECK: same validation, for feed B. Not needed (pass null) for `PriceAbove`.
    pub price_update_b: Option<UncheckedAccount<'info>>,
}

fn read_price(account: &AccountInfo, clock: &Clock, feed_id: &[u8; 32]) -> Result<OraclePrice> {
    let update = PriceUpdateV2::load(account)?;
    let price = update.get_price_no_older_than(clock, ORACLE_MAX_AGE_SECS, feed_id)?;
    Ok(OraclePrice {
        price: price.price,
        exponent: price.exponent,
    })
}

pub(crate) fn handler(ctx: Context<Resolve>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    require!(market.is_open(), DuelError::AlreadyResolved);
    require!(
        clock.unix_timestamp >= market.resolve_ts,
        DuelError::NotYetResolvable
    );

    let oracle_a = ctx.accounts.price_update_a.to_account_info();
    let oracle_b = ctx
        .accounts
        .price_update_b
        .as_ref()
        .map(|a| a.to_account_info());

    let (winner, price_a, price_b) = match market.template {
        ResolutionTemplate::CapCompare {
            feed_a,
            feed_b,
            shares_a,
            shares_b,
        } => {
            let oracle_b = oracle_b.ok_or(DuelError::MissingOracle)?;
            let a = read_price(&oracle_a, &clock, &feed_a)?;
            let b = read_price(&oracle_b, &clock, &feed_b)?;
            let winner = math::cap_compare(a, shares_a, b, shares_b)?;
            (winner, math::to_e6(a)?, math::to_e6(b)?)
        }
        ResolutionTemplate::RatioOutperform {
            feed_a,
            feed_b,
            start_ratio_e9,
        } => {
            let oracle_b = oracle_b.ok_or(DuelError::MissingOracle)?;
            let a = read_price(&oracle_a, &clock, &feed_a)?;
            let b = read_price(&oracle_b, &clock, &feed_b)?;
            let winner = math::ratio_outperform(a, b, start_ratio_e9)?;
            (winner, math::to_e6(a)?, math::to_e6(b)?)
        }
        ResolutionTemplate::PriceAbove { feed, threshold_e6 } => {
            let a = read_price(&oracle_a, &clock, &feed)?;
            let winner = math::price_above(a, threshold_e6)?;
            (winner, math::to_e6(a)?, 0)
        }
    };

    market.status = MarketStatus::Resolved {
        winner,
        price_a,
        price_b,
        resolved_ts: clock.unix_timestamp,
    };

    emit!(MarketResolved {
        market: market.key(),
        winner,
        price_a,
        price_b,
        resolved_ts: clock.unix_timestamp,
        manual: false,
    });
    Ok(())
}
