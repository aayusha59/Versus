use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::DuelError;
use crate::events::RewardsDeposited;
use crate::state::*;

#[derive(Accounts)]
#[instruction(side: Side)]
pub struct DepositRewards<'info> {
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub market: Box<Account<'info, Market>>,

    #[account(constraint = pair_mint.key() == market.pair_mint_for(side) @ DuelError::WrongSide)]
    pub pair_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = reward_vault.key() == market.reward_vault_for(side) @ DuelError::WrongSide)]
    pub reward_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = depositor_token.mint == pair_mint.key() @ DuelError::WrongSide)]
    pub depositor_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub pair_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<DepositRewards>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, DuelError::InvalidAmount);

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.pair_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.depositor_token.to_account_info(),
                mint: ctx.accounts.pair_mint.to_account_info(),
                to: ctx.accounts.reward_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.pair_mint.decimals,
    )?;

    emit!(RewardsDeposited {
        market: ctx.accounts.market.key(),
        side,
        depositor: ctx.accounts.depositor.key(),
        amount,
    });
    Ok(())
}
