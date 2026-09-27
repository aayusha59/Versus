use anchor_lang::prelude::*;

use crate::errors::DuelError;
use crate::events::PoolsSet;
use crate::state::Market;

#[derive(Accounts)]
pub struct SetPools<'info> {
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator @ DuelError::Unauthorized)]
    pub market: Account<'info, Market>,
}

pub(crate) fn handler(ctx: Context<SetPools>, pool_a: Pubkey, pool_b: Pubkey) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(
        market.pool_a == Pubkey::default() && market.pool_b == Pubkey::default(),
        DuelError::PoolsAlreadySet
    );
    require!(
        pool_a != Pubkey::default() && pool_b != Pubkey::default() && pool_a != pool_b,
        DuelError::InvalidParams
    );
    market.pool_a = pool_a;
    market.pool_b = pool_b;
    emit!(PoolsSet {
        market: market.key(),
        pool_a,
        pool_b,
    });
    Ok(())
}
