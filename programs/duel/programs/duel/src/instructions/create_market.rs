use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint as SplMint, Token};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::DuelError;
use crate::events::MarketCreated;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateMarketParams {
    pub nonce: u64,
    pub question: String,
    pub side_a_label: String,
    pub side_b_label: String,
    pub template: ResolutionTemplate,
    pub resolve_ts: i64,
    pub grace_secs: i64,
    pub resolver: Pubkey,
    pub crank: Pubkey,
    pub fee_bps_holders: u16,
    pub fee_bps_creator: u16,
    pub fee_bps_platform: u16,
}

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, creator.key().as_ref(), &params.nonce.to_le_bytes()],
        bump,
    )]
    pub market: Box<Account<'info, Market>>,

    /// Collateral (USDC or a mock). SPL Token or Token-2022.
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    /// Pair token for side A (e.g. AAPLx). SPL Token or Token-2022.
    pub pair_a_mint: Box<InterfaceAccount<'info, Mint>>,
    /// Pair token for side B (e.g. NVDAx). SPL Token or Token-2022.
    pub pair_b_mint: Box<InterfaceAccount<'info, Mint>>,

    /// YES outcome mint: classic SPL Token, 6 decimals, authorities = market PDA.
    #[account(
        init,
        payer = creator,
        seeds = [YES_SEED, market.key().as_ref()],
        bump,
        mint::decimals = OUTCOME_DECIMALS,
        mint::authority = market,
        mint::freeze_authority = market,
        mint::token_program = token_program,
    )]
    pub yes_mint: Box<Account<'info, SplMint>>,

    /// NO outcome mint: classic SPL Token, 6 decimals, authorities = market PDA.
    #[account(
        init,
        payer = creator,
        seeds = [NO_SEED, market.key().as_ref()],
        bump,
        mint::decimals = OUTCOME_DECIMALS,
        mint::authority = market,
        mint::freeze_authority = market,
        mint::token_program = token_program,
    )]
    pub no_mint: Box<Account<'info, SplMint>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = collateral_mint,
        associated_token::authority = market,
        associated_token::token_program = collateral_token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = pair_a_mint,
        associated_token::authority = market,
        associated_token::token_program = pair_a_token_program,
    )]
    pub reward_vault_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = pair_b_mint,
        associated_token::authority = market,
        associated_token::token_program = pair_b_token_program,
    )]
    pub reward_vault_b: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Classic SPL Token program (for the YES/NO mints).
    pub token_program: Program<'info, Token>,
    /// Token program owning `collateral_mint`.
    pub collateral_token_program: Interface<'info, TokenInterface>,
    /// Token program owning `pair_a_mint`.
    pub pair_a_token_program: Interface<'info, TokenInterface>,
    /// Token program owning `pair_b_mint`.
    pub pair_b_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

fn validate(params: &CreateMarketParams) -> Result<()> {
    require!(
        params.question.len() <= MAX_QUESTION_LEN && !params.question.is_empty(),
        DuelError::InvalidParams
    );
    require!(
        params.side_a_label.len() <= MAX_LABEL_LEN && params.side_b_label.len() <= MAX_LABEL_LEN,
        DuelError::InvalidParams
    );
    require!(params.resolve_ts > 0, DuelError::InvalidParams);
    require!(params.grace_secs >= 0, DuelError::InvalidParams);
    require!(
        params.resolve_ts.checked_add(params.grace_secs).is_some(),
        DuelError::InvalidParams
    );
    let fees = (params.fee_bps_holders as u32)
        + (params.fee_bps_creator as u32)
        + (params.fee_bps_platform as u32);
    require!(fees <= 10_000, DuelError::InvalidParams);
    match params.template {
        ResolutionTemplate::CapCompare {
            feed_a,
            feed_b,
            shares_a,
            shares_b,
        } => {
            require!(shares_a > 0 && shares_b > 0, DuelError::InvalidParams);
            require!(feed_a != feed_b, DuelError::InvalidParams);
        }
        ResolutionTemplate::RatioOutperform {
            feed_a,
            feed_b,
            start_ratio_e9,
        } => {
            require!(start_ratio_e9 > 0, DuelError::InvalidParams);
            require!(feed_a != feed_b, DuelError::InvalidParams);
        }
        ResolutionTemplate::PriceAbove { .. } => {}
    }
    Ok(())
}

pub(crate) fn handler(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
    validate(&params)?;

    let market = &mut ctx.accounts.market;
    market.creator = ctx.accounts.creator.key();
    market.nonce = params.nonce;
    market.bump = ctx.bumps.market;
    market.question = params.question;
    market.side_a_label = params.side_a_label;
    market.side_b_label = params.side_b_label;
    market.collateral_mint = ctx.accounts.collateral_mint.key();
    market.collateral_vault = ctx.accounts.collateral_vault.key();
    market.yes_mint = ctx.accounts.yes_mint.key();
    market.no_mint = ctx.accounts.no_mint.key();
    market.pair_a_mint = ctx.accounts.pair_a_mint.key();
    market.pair_b_mint = ctx.accounts.pair_b_mint.key();
    market.reward_vault_a = ctx.accounts.reward_vault_a.key();
    market.reward_vault_b = ctx.accounts.reward_vault_b.key();
    market.template = params.template;
    market.resolve_ts = params.resolve_ts;
    market.grace_secs = params.grace_secs;
    market.resolver = params.resolver;
    market.crank = params.crank;
    market.fee_bps_holders = params.fee_bps_holders;
    market.fee_bps_creator = params.fee_bps_creator;
    market.fee_bps_platform = params.fee_bps_platform;
    market.status = MarketStatus::Open;
    market.pool_a = Pubkey::default();
    market.pool_b = Pubkey::default();
    market.total_minted = 0;
    market.total_redeemed = 0;
    market.rewards_paid_a = 0;
    market.rewards_paid_b = 0;
    market.epochs = 0;
    market.reserved = [0u8; 64];

    emit!(MarketCreated {
        market: market.key(),
        creator: market.creator,
        nonce: market.nonce,
        yes_mint: market.yes_mint,
        no_mint: market.no_mint,
        collateral_mint: market.collateral_mint,
        pair_a_mint: market.pair_a_mint,
        pair_b_mint: market.pair_b_mint,
        resolve_ts: market.resolve_ts,
    });
    Ok(())
}
