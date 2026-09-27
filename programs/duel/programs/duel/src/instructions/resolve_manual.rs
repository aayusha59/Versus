use anchor_lang::prelude::*;

use crate::errors::DuelError;
use crate::events::MarketResolved;
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveManual<'info> {
    pub resolver: Signer<'info>,
    #[account(mut, has_one = resolver @ DuelError::Unauthorized)]
    pub market: Account<'info, Market>,
}

pub(crate) fn handler(
    ctx: Context<ResolveManual>,
    winner: Side,
    price_a: i64,
    price_b: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    require!(market.is_open(), DuelError::AlreadyResolved);
    let earliest = market
        .resolve_ts
        .checked_add(market.grace_secs)
        .ok_or(DuelError::MathOverflow)?;
    require!(clock.unix_timestamp >= earliest, DuelError::GraceNotElapsed);

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
        manual: true,
    });
    Ok(())
}
