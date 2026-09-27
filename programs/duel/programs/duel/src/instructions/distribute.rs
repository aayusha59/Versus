use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use super::MarketSigner;
use crate::errors::DuelError;
use crate::events::RewardsPaid;
use crate::state::*;

#[derive(Accounts)]
#[instruction(side: Side)]
pub struct Distribute<'info> {
    pub crank: Signer<'info>,

    #[account(mut, has_one = crank @ DuelError::Unauthorized)]
    pub market: Box<Account<'info, Market>>,

    #[account(constraint = pair_mint.key() == market.pair_mint_for(side) @ DuelError::WrongSide)]
    pub pair_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = reward_vault.key() == market.reward_vault_for(side) @ DuelError::WrongSide)]
    pub reward_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub pair_token_program: Interface<'info, TokenInterface>,
    // remaining_accounts: recipient token accounts of `pair_mint`, one per entry in `amounts`.
}

pub(crate) fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, Distribute<'info>>,
    side: Side,
    amounts: Vec<u64>,
) -> Result<()> {
    let recipients = ctx.remaining_accounts;
    require!(
        amounts.len() == recipients.len(),
        DuelError::RecipientCountMismatch
    );
    require!(!amounts.is_empty(), DuelError::InvalidAmount);
    require!(
        amounts.len() <= MAX_RECIPIENTS,
        DuelError::TooManyRecipients
    );

    let total = amounts
        .iter()
        .try_fold(0u64, |acc, x| acc.checked_add(*x))
        .ok_or(DuelError::MathOverflow)?;
    require!(total > 0, DuelError::InvalidAmount);
    require!(
        total <= ctx.accounts.reward_vault.amount,
        DuelError::InsufficientRewards
    );

    let pair_mint = ctx.accounts.pair_mint.key();
    let token_program = ctx.accounts.pair_token_program.key();
    let signer = MarketSigner::new(&ctx.accounts.market);
    let seeds = signer.seeds();

    for (recipient, amount) in recipients.iter().zip(amounts.iter()) {
        if *amount == 0 {
            continue;
        }
        require!(recipient.is_writable, DuelError::InvalidRecipient);
        require_keys_eq!(*recipient.owner, token_program, DuelError::InvalidRecipient);
        let token_account = InterfaceAccount::<TokenAccount>::try_from(recipient)
            .map_err(|_| DuelError::InvalidRecipient)?;
        require_keys_eq!(token_account.mint, pair_mint, DuelError::InvalidRecipient);

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.pair_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    mint: ctx.accounts.pair_mint.to_account_info(),
                    to: recipient.clone(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[&seeds],
            ),
            *amount,
            ctx.accounts.pair_mint.decimals,
        )?;
    }

    let market = &mut ctx.accounts.market;
    market.epochs = market
        .epochs
        .checked_add(1)
        .ok_or(DuelError::MathOverflow)?;
    match side {
        Side::Yes => {
            market.rewards_paid_a = market
                .rewards_paid_a
                .checked_add(total)
                .ok_or(DuelError::MathOverflow)?
        }
        Side::No => {
            market.rewards_paid_b = market
                .rewards_paid_b
                .checked_add(total)
                .ok_or(DuelError::MathOverflow)?
        }
    }

    emit!(RewardsPaid {
        market: market.key(),
        side,
        epoch: market.epochs,
        total,
        count: recipients.len() as u32,
    });
    Ok(())
}
