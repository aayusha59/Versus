use anchor_lang::prelude::*;

#[error_code]
pub enum DuelError {
    #[msg("Market cannot be resolved before resolve_ts")]
    NotYetResolvable,
    #[msg("Market is already resolved")]
    AlreadyResolved,
    #[msg("Market is not resolved yet")]
    NotResolved,
    #[msg("Token, mint or vault does not match the requested side")]
    WrongSide,
    #[msg("Oracle price is stale (older than the 6 hour window)")]
    StaleOracle,
    #[msg("Manual resolution grace period has not elapsed")]
    GraceNotElapsed,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Too many recipients (max 12 per call)")]
    TooManyRecipients,
    #[msg("Reward vault balance is insufficient for the requested amounts")]
    InsufficientRewards,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invalid market parameters (question or label too long, bad fees or template)")]
    InvalidParams,
    #[msg("Pools have already been set for this market")]
    PoolsAlreadySet,
    #[msg("Oracle account is not a Pyth PriceUpdateV2 owned by the Pyth receiver program")]
    InvalidOracleAccount,
    #[msg("Oracle price update does not carry full verification")]
    InsufficientVerification,
    #[msg("Oracle feed id does not match the market template")]
    FeedMismatch,
    #[msg("Oracle price is not positive")]
    InvalidOraclePrice,
    #[msg("A second oracle account is required for this template")]
    MissingOracle,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("amounts length must equal the number of recipient accounts")]
    RecipientCountMismatch,
    #[msg("Recipient is not a writable token account of the pair mint")]
    InvalidRecipient,
    #[msg("Collateral transfer did not credit the full amount (transfer-fee mints unsupported)")]
    CollateralShortfall,
}
