use anchor_lang::prelude::*;

/// Maximum byte length of `Market::question`.
pub const MAX_QUESTION_LEN: usize = 160;
/// Maximum byte length of each side label.
pub const MAX_LABEL_LEN: usize = 24;
/// Maximum recipients per `distribute` call.
pub const MAX_RECIPIENTS: usize = 12;
/// YES / NO outcome tokens are 6-decimal SPL tokens, 1:1 with collateral base units.
pub const OUTCOME_DECIMALS: u8 = 6;
/// `resolve` accepts Pyth prices published at most this many seconds ago.
/// Equity feeds only tick during market hours, so the window covers the last close.
pub const ORACLE_MAX_AGE_SECS: u64 = 6 * 60 * 60;

pub const MARKET_SEED: &[u8] = b"market";
pub const YES_SEED: &[u8] = b"yes";
pub const NO_SEED: &[u8] = b"no";

/// Which side of the duel. `Yes` is side A (the YES mint, `pair_a_mint`,
/// `reward_vault_a`); `No` is side B (the NO mint, `pair_b_mint`, `reward_vault_b`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Side {
    Yes,
    No,
}

/// How the market resolves. Feed ids are 32-byte Pyth price feed ids.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ResolutionTemplate {
    /// YES if `price_a * shares_a > price_b * shares_b` (market-cap comparison).
    CapCompare {
        feed_a: [u8; 32],
        feed_b: [u8; 32],
        shares_a: u64,
        shares_b: u64,
    },
    /// YES if `(price_a / price_b) * 1e9 > start_ratio_e9` at resolution.
    RatioOutperform {
        feed_a: [u8; 32],
        feed_b: [u8; 32],
        start_ratio_e9: u64,
    },
    /// YES if `price * 1e6 > threshold_e6`.
    PriceAbove { feed: [u8; 32], threshold_e6: u64 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum MarketStatus {
    Open,
    /// `price_a` / `price_b` are USD prices scaled by 1e6 (0 when unused).
    Resolved {
        winner: Side,
        price_a: i64,
        price_b: i64,
        resolved_ts: i64,
    },
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Market {
    pub creator: Pubkey,
    pub nonce: u64,
    pub bump: u8,
    #[max_len(160)]
    pub question: String,
    #[max_len(24)]
    pub side_a_label: String,
    #[max_len(24)]
    pub side_b_label: String,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub pair_a_mint: Pubkey,
    pub pair_b_mint: Pubkey,
    pub reward_vault_a: Pubkey,
    pub reward_vault_b: Pubkey,
    pub template: ResolutionTemplate,
    pub resolve_ts: i64,
    pub grace_secs: i64,
    pub resolver: Pubkey,
    pub crank: Pubkey,
    pub fee_bps_holders: u16,
    pub fee_bps_creator: u16,
    pub fee_bps_platform: u16,
    pub status: MarketStatus,
    pub pool_a: Pubkey,
    pub pool_b: Pubkey,
    /// Outstanding full sets (minted minus merged). Vault balance == total_minted - total_redeemed.
    pub total_minted: u64,
    /// Winning tokens redeemed for collateral.
    pub total_redeemed: u64,
    pub rewards_paid_a: u64,
    pub rewards_paid_b: u64,
    pub epochs: u32,
    pub reserved: [u8; 64],
}

impl Market {
    pub fn is_open(&self) -> bool {
        matches!(self.status, MarketStatus::Open)
    }

    pub fn winner(&self) -> Option<Side> {
        match self.status {
            MarketStatus::Open => None,
            MarketStatus::Resolved { winner, .. } => Some(winner),
        }
    }

    pub fn outcome_mint_for(&self, side: Side) -> Pubkey {
        match side {
            Side::Yes => self.yes_mint,
            Side::No => self.no_mint,
        }
    }

    pub fn pair_mint_for(&self, side: Side) -> Pubkey {
        match side {
            Side::Yes => self.pair_a_mint,
            Side::No => self.pair_b_mint,
        }
    }

    pub fn reward_vault_for(&self, side: Side) -> Pubkey {
        match side {
            Side::Yes => self.reward_vault_a,
            Side::No => self.reward_vault_b,
        }
    }
}
