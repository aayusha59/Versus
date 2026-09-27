use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint as SplMint, Token, TokenAccount as SplTokenAccount};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use super::MarketSigner;
use crate::errors::DuelError;
use crate::events::Redeemed;
use crate::state::*;

#[derive(Accounts)]
pub struct Redeem<'info> {
    pub user: Signer<'info>,

    #[account(mut, has_one = collateral_mint, has_one = collateral_vault)]
    pub market: Box<Account<'info, Market>>,

    /// The winning outcome mint (`yes_mint` if the winner is `Yes`, `no_mint` if `No`).
    #[account(mut)]
    pub outcome_mint: Box<Account<'info, SplMint>>,
    #[account(mut, constraint = user_outcome.mint == outcome_mint.key() @ DuelError::WrongSide)]
    pub user_outcome: Box<Account<'info, SplTokenAccount>>,

    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = user_collateral.mint == collateral_mint.key() @ DuelError::WrongSide)]
    pub user_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<Redeem>, amount: u64) -> Result<()> {
    require!(amount > 0, DuelError::InvalidAmount);
    let winner = ctx.accounts.market.winner().ok_or(DuelError::NotResolved)?;
    require_keys_eq!(
        ctx.accounts.outcome_mint.key(),
        ctx.accounts.market.outcome_mint_for(winner),
        DuelError::WrongSide
    );

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.outcome_mint.to_account_info(),
                from: ctx.accounts.user_outcome.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let signer = MarketSigner::new(&ctx.accounts.market);
    let seeds = signer.seeds();
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.collateral_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.collateral_vault.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.user_collateral.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            &[&seeds],
        ),
        amount,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let market = &mut ctx.accounts.market;
    market.total_redeemed = market
        .total_redeemed
        .checked_add(amount)
        .ok_or(DuelError::MathOverflow)?;

    emit!(Redeemed {
        market: market.key(),
        user: ctx.accounts.user.key(),
        side: winner,
        amount,
    });
    Ok(())
}
