use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint as SplMint, Token, TokenAccount as SplTokenAccount};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use super::MarketSigner;
use crate::errors::DuelError;
use crate::events::SetMerged;
use crate::state::*;

#[derive(Accounts)]
pub struct MergeSet<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = collateral_mint,
        has_one = collateral_vault,
        has_one = yes_mint,
        has_one = no_mint,
    )]
    pub market: Box<Account<'info, Market>>,

    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = user_collateral.mint == collateral_mint.key() @ DuelError::WrongSide)]
    pub user_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub yes_mint: Box<Account<'info, SplMint>>,
    #[account(mut)]
    pub no_mint: Box<Account<'info, SplMint>>,
    #[account(mut, constraint = user_yes.mint == yes_mint.key() @ DuelError::WrongSide)]
    pub user_yes: Box<Account<'info, SplTokenAccount>>,
    #[account(mut, constraint = user_no.mint == no_mint.key() @ DuelError::WrongSide)]
    pub user_no: Box<Account<'info, SplTokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<MergeSet>, amount: u64) -> Result<()> {
    require!(amount > 0, DuelError::InvalidAmount);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.yes_mint.to_account_info(),
                from: ctx.accounts.user_yes.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.no_mint.to_account_info(),
                from: ctx.accounts.user_no.to_account_info(),
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
    market.total_minted = market
        .total_minted
        .checked_sub(amount)
        .ok_or(DuelError::MathOverflow)?;

    emit!(SetMerged {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount,
    });
    Ok(())
}
