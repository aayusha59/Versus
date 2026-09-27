use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint as SplMint, MintTo, Token, TokenAccount as SplTokenAccount};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use super::MarketSigner;
use crate::errors::DuelError;
use crate::events::SetMinted;
use crate::state::*;

#[derive(Accounts)]
pub struct MintSet<'info> {
    #[account(mut)]
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

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = yes_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_yes: Box<Account<'info, SplTokenAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = no_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_no: Box<Account<'info, SplTokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<MintSet>, amount: u64) -> Result<()> {
    require!(amount > 0, DuelError::InvalidAmount);
    require!(ctx.accounts.market.is_open(), DuelError::AlreadyResolved);

    let vault_before = ctx.accounts.collateral_vault.amount;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.collateral_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_collateral.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.collateral_mint.decimals,
    )?;
    ctx.accounts.collateral_vault.reload()?;
    require!(
        ctx.accounts
            .collateral_vault
            .amount
            .saturating_sub(vault_before)
            == amount,
        DuelError::CollateralShortfall
    );

    let signer = MarketSigner::new(&ctx.accounts.market);
    let seeds = signer.seeds();
    let signer_seeds: &[&[&[u8]]] = &[&seeds];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.yes_mint.to_account_info(),
                to: ctx.accounts.user_yes.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.no_mint.to_account_info(),
                to: ctx.accounts.user_no.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let market = &mut ctx.accounts.market;
    market.total_minted = market
        .total_minted
        .checked_add(amount)
        .ok_or(DuelError::MathOverflow)?;

    emit!(SetMinted {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount,
    });
    Ok(())
}
