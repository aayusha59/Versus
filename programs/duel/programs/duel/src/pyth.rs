//! Minimal reader for Pyth `PriceUpdateV2` accounts (Pyth Solana Receiver).
//!
//! `pyth-solana-receiver-sdk` cannot be used with Anchor 0.32 / Agave 3.0 today
//! (0.6.x resolves `anchor-lang >= 0.28` to anchor-lang 1.x and fails to compile,
//! 1.0.0 pins anchor-lang 0.31.1, 2.0.0 requires anchor-lang 1.x), so this module
//! decodes the documented Borsh layout by hand and re-implements
//! `get_price_no_older_than` with the same semantics as the SDK:
//!
//! ```text
//! [0..8)    anchor discriminator  sha256("account:PriceUpdateV2")[..8]
//! [8..40)   write_authority: Pubkey
//! [40..)    verification_level: enum { Partial { num_signatures: u8 } = 0, Full = 1 }
//!           price_message: PriceFeedMessage {
//!               feed_id: [u8; 32], price: i64, conf: u64, exponent: i32,
//!               publish_time: i64, prev_publish_time: i64, ema_price: i64, ema_conf: u64 }
//!           posted_slot: u64
//! ```
//!
//! The account must be owned by one of the Pyth receiver programs.

use anchor_lang::prelude::*;

use crate::errors::DuelError;

/// Pyth Solana Receiver program (same address on mainnet and devnet); the id the
/// `pyth-solana-receiver-sdk` crate declares by default.
pub const PYTH_RECEIVER_PROGRAM_ID: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
/// Pyth Solana Receiver "pro-compatible" deployment (the crate's `pro-compatible` feature).
pub const PYTH_RECEIVER_PRO_PROGRAM_ID: Pubkey =
    pubkey!("rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp");
/// Program ids accepted as the owner of a `PriceUpdateV2` account.
pub const PYTH_RECEIVER_PROGRAM_IDS: [Pubkey; 2] =
    [PYTH_RECEIVER_PROGRAM_ID, PYTH_RECEIVER_PRO_PROGRAM_ID];

/// `sha256("account:PriceUpdateV2")[..8]`.
pub const PRICE_UPDATE_V2_DISCRIMINATOR: [u8; 8] = [34, 241, 35, 99, 157, 126, 244, 205];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerificationLevel {
    Partial { num_signatures: u8 },
    Full,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PriceFeedMessage {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
    pub ema_price: i64,
    pub ema_conf: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PriceUpdateV2 {
    pub write_authority: Pubkey,
    pub verification_level: VerificationLevel,
    pub price_message: PriceFeedMessage,
    pub posted_slot: u64,
}

/// A price that passed the freshness / feed / verification checks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
}

struct Cursor<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        let end = self
            .pos
            .checked_add(n)
            .ok_or(DuelError::InvalidOracleAccount)?;
        let slice = self
            .data
            .get(self.pos..end)
            .ok_or(DuelError::InvalidOracleAccount)?;
        self.pos = end;
        Ok(slice)
    }
    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn i32(&mut self) -> Result<i32> {
        Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn u64(&mut self) -> Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn i64(&mut self) -> Result<i64> {
        Ok(i64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn bytes32(&mut self) -> Result<[u8; 32]> {
        Ok(self.take(32)?.try_into().unwrap())
    }
}

impl PriceUpdateV2 {
    /// Deserialize from raw account data (including the 8-byte discriminator).
    pub fn try_deserialize(data: &[u8]) -> Result<Self> {
        let mut c = Cursor { data, pos: 0 };
        let disc = c.take(8)?;
        require!(
            disc == PRICE_UPDATE_V2_DISCRIMINATOR,
            DuelError::InvalidOracleAccount
        );
        let write_authority = Pubkey::new_from_array(c.bytes32()?);
        let verification_level = match c.u8()? {
            0 => VerificationLevel::Partial {
                num_signatures: c.u8()?,
            },
            1 => VerificationLevel::Full,
            _ => return err!(DuelError::InvalidOracleAccount),
        };
        let price_message = PriceFeedMessage {
            feed_id: c.bytes32()?,
            price: c.i64()?,
            conf: c.u64()?,
            exponent: c.i32()?,
            publish_time: c.i64()?,
            prev_publish_time: c.i64()?,
            ema_price: c.i64()?,
            ema_conf: c.u64()?,
        };
        let posted_slot = c.u64()?;
        Ok(Self {
            write_authority,
            verification_level,
            price_message,
            posted_slot,
        })
    }

    /// Load from an account, enforcing that it is owned by a Pyth receiver program.
    pub fn load(account: &AccountInfo) -> Result<Self> {
        require!(
            PYTH_RECEIVER_PROGRAM_IDS.contains(account.owner),
            DuelError::InvalidOracleAccount
        );
        let data = account.try_borrow_data()?;
        Self::try_deserialize(&data)
    }

    /// Same contract as `pyth_solana_receiver_sdk::PriceUpdateV2::get_price_no_older_than`:
    /// requires full verification, a matching feed id and `now - publish_time <= max_age`.
    pub fn get_price_no_older_than(
        &self,
        clock: &Clock,
        max_age: u64,
        feed_id: &[u8; 32],
    ) -> Result<Price> {
        require!(
            self.verification_level == VerificationLevel::Full,
            DuelError::InsufficientVerification
        );
        require!(
            self.price_message.feed_id == *feed_id,
            DuelError::FeedMismatch
        );
        let age = clock
            .unix_timestamp
            .saturating_sub(self.price_message.publish_time);
        require!(
            age <= i64::try_from(max_age).unwrap_or(i64::MAX),
            DuelError::StaleOracle
        );
        Ok(Price {
            price: self.price_message.price,
            conf: self.price_message.conf,
            exponent: self.price_message.exponent,
            publish_time: self.price_message.publish_time,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    pub fn encode(
        feed_id: [u8; 32],
        price: i64,
        conf: u64,
        exponent: i32,
        publish_time: i64,
        full: bool,
    ) -> Vec<u8> {
        let mut v = Vec::with_capacity(134);
        v.extend_from_slice(&PRICE_UPDATE_V2_DISCRIMINATOR);
        v.extend_from_slice(&[7u8; 32]); // write authority
        if full {
            v.push(1);
        } else {
            v.push(0);
            v.push(3);
        }
        v.extend_from_slice(&feed_id);
        v.extend_from_slice(&price.to_le_bytes());
        v.extend_from_slice(&conf.to_le_bytes());
        v.extend_from_slice(&exponent.to_le_bytes());
        v.extend_from_slice(&publish_time.to_le_bytes());
        v.extend_from_slice(&(publish_time - 1).to_le_bytes());
        v.extend_from_slice(&(price - 5).to_le_bytes());
        v.extend_from_slice(&(conf + 1).to_le_bytes());
        v.extend_from_slice(&123_456u64.to_le_bytes());
        while v.len() < 134 {
            v.push(0);
        }
        v
    }

    fn clock_at(ts: i64) -> Clock {
        Clock {
            slot: 0,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: ts,
        }
    }

    #[test]
    fn discriminator_matches_anchor_convention() {
        let hash = Sha256::digest(b"account:PriceUpdateV2");
        assert_eq!(&hash[..8], &PRICE_UPDATE_V2_DISCRIMINATOR);
    }

    #[test]
    fn parses_full_verification_layout() {
        let feed = [9u8; 32];
        let data = encode(feed, 25_012_345, 1_000, -5, 1_700_000_000, true);
        assert_eq!(data.len(), 134);
        let p = PriceUpdateV2::try_deserialize(&data).unwrap();
        assert_eq!(p.write_authority, Pubkey::new_from_array([7u8; 32]));
        assert_eq!(p.verification_level, VerificationLevel::Full);
        assert_eq!(p.price_message.feed_id, feed);
        assert_eq!(p.price_message.price, 25_012_345);
        assert_eq!(p.price_message.conf, 1_000);
        assert_eq!(p.price_message.exponent, -5);
        assert_eq!(p.price_message.publish_time, 1_700_000_000);
        assert_eq!(p.price_message.prev_publish_time, 1_699_999_999);
        assert_eq!(p.price_message.ema_price, 25_012_340);
        assert_eq!(p.price_message.ema_conf, 1_001);
        assert_eq!(p.posted_slot, 123_456);
    }

    #[test]
    fn parses_partial_verification_layout() {
        let data = encode([1u8; 32], 5, 1, -8, 10, false);
        let p = PriceUpdateV2::try_deserialize(&data).unwrap();
        assert_eq!(
            p.verification_level,
            VerificationLevel::Partial { num_signatures: 3 }
        );
        assert_eq!(p.price_message.price, 5);
        assert_eq!(p.posted_slot, 123_456);
        let err = p
            .get_price_no_older_than(&clock_at(10), 60, &[1u8; 32])
            .unwrap_err();
        assert_eq!(
            err,
            anchor_lang::error::Error::from(DuelError::InsufficientVerification)
        );
    }

    #[test]
    fn rejects_bad_discriminator_and_short_data() {
        let mut data = encode([1u8; 32], 5, 1, -8, 10, true);
        data[0] ^= 1;
        assert!(PriceUpdateV2::try_deserialize(&data).is_err());
        let data = encode([1u8; 32], 5, 1, -8, 10, true);
        assert!(PriceUpdateV2::try_deserialize(&data[..100]).is_err());
    }

    #[test]
    fn freshness_and_feed_checks() {
        let feed = [4u8; 32];
        let p = PriceUpdateV2::try_deserialize(&encode(feed, 100, 1, -2, 1_000, true)).unwrap();
        assert!(p
            .get_price_no_older_than(&clock_at(1_000 + 60), 60, &feed)
            .is_ok());
        assert!(p.get_price_no_older_than(&clock_at(900), 60, &feed).is_ok()); // future publish ok
        let err = p
            .get_price_no_older_than(&clock_at(1_000 + 61), 60, &feed)
            .unwrap_err();
        assert_eq!(err, anchor_lang::error::Error::from(DuelError::StaleOracle));
        let err = p
            .get_price_no_older_than(&clock_at(1_000), 60, &[5u8; 32])
            .unwrap_err();
        assert_eq!(
            err,
            anchor_lang::error::Error::from(DuelError::FeedMismatch)
        );
    }
}
