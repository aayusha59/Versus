//! Fixed-point resolution math. Pyth prices are `price * 10^exponent`; exponents
//! differ per feed (equities are usually -5 or -8), so everything is normalized in u128.

use anchor_lang::prelude::*;

use crate::errors::DuelError;
use crate::state::Side;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OraclePrice {
    pub price: i64,
    pub exponent: i32,
}

impl OraclePrice {
    fn magnitude(&self) -> Result<u128> {
        require!(self.price > 0, DuelError::InvalidOraclePrice);
        Ok(self.price as u128)
    }
}

pub fn pow10(n: u32) -> Result<u128> {
    10u128
        .checked_pow(n)
        .ok_or_else(|| DuelError::MathOverflow.into())
}

fn exp_diff(a: i32, b: i32) -> Result<u32> {
    let d = a.checked_sub(b).ok_or(DuelError::MathOverflow)?;
    u32::try_from(d).map_err(|_| DuelError::MathOverflow.into())
}

/// Scale `a` and `b` (each with its own exponent) to a common exponent so they compare directly.
fn normalize(a: u128, ea: i32, b: u128, eb: i32) -> Result<(u128, u128)> {
    if ea >= eb {
        let a = a
            .checked_mul(pow10(exp_diff(ea, eb)?)?)
            .ok_or(DuelError::MathOverflow)?;
        Ok((a, b))
    } else {
        let b = b
            .checked_mul(pow10(exp_diff(eb, ea)?)?)
            .ok_or(DuelError::MathOverflow)?;
        Ok((a, b))
    }
}

/// YES if `price_a * shares_a > price_b * shares_b`.
pub fn cap_compare(a: OraclePrice, shares_a: u64, b: OraclePrice, shares_b: u64) -> Result<Side> {
    let cap_a = a
        .magnitude()?
        .checked_mul(shares_a as u128)
        .ok_or(DuelError::MathOverflow)?;
    let cap_b = b
        .magnitude()?
        .checked_mul(shares_b as u128)
        .ok_or(DuelError::MathOverflow)?;
    let (cap_a, cap_b) = normalize(cap_a, a.exponent, cap_b, b.exponent)?;
    Ok(if cap_a > cap_b { Side::Yes } else { Side::No })
}

/// `(price_a / price_b) * 1e9`, rounded down.
pub fn ratio_e9(a: OraclePrice, b: OraclePrice) -> Result<u128> {
    let num = a
        .magnitude()?
        .checked_mul(1_000_000_000)
        .ok_or(DuelError::MathOverflow)?;
    let (num, den) = normalize(num, a.exponent, b.magnitude()?, b.exponent)?;
    require!(den > 0, DuelError::InvalidOraclePrice);
    Ok(num / den)
}

/// YES if the current ratio is strictly above the starting ratio.
pub fn ratio_outperform(a: OraclePrice, b: OraclePrice, start_ratio_e9: u64) -> Result<Side> {
    Ok(if ratio_e9(a, b)? > start_ratio_e9 as u128 {
        Side::Yes
    } else {
        Side::No
    })
}

/// Price in USD scaled by 1e6 (rounded down).
pub fn to_e6(p: OraclePrice) -> Result<i64> {
    let mag = p.magnitude()?;
    let shift = p.exponent.checked_add(6).ok_or(DuelError::MathOverflow)?;
    let scaled = if shift >= 0 {
        mag.checked_mul(pow10(shift as u32)?)
            .ok_or(DuelError::MathOverflow)?
    } else {
        mag / pow10((-shift) as u32)?
    };
    i64::try_from(scaled).map_err(|_| DuelError::MathOverflow.into())
}

/// YES if `price > threshold_e6` (both in USD scaled by 1e6).
pub fn price_above(p: OraclePrice, threshold_e6: u64) -> Result<Side> {
    let e6 = to_e6(p)? as u128;
    Ok(if e6 > threshold_e6 as u128 {
        Side::Yes
    } else {
        Side::No
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(price: i64, exponent: i32) -> OraclePrice {
        OraclePrice { price, exponent }
    }

    #[test]
    fn cap_compare_handles_mixed_exponents() {
        // AAPL $250.12345 (e-5) * 15e9 shares = 3.75e12; NVDA $180.5 (e-8) * 24.4e9 = 4.40e12
        let aapl = p(25_012_345, -5);
        let nvda = p(18_050_000_000, -8);
        assert_eq!(
            cap_compare(aapl, 15_000_000_000, nvda, 24_400_000_000).unwrap(),
            Side::No
        );
        assert_eq!(
            cap_compare(aapl, 30_000_000_000, nvda, 10_000_000_000).unwrap(),
            Side::Yes
        );
        // Same exponents, tie goes to NO.
        assert_eq!(cap_compare(p(100, -2), 5, p(50, -2), 10).unwrap(), Side::No);
        assert_eq!(
            cap_compare(p(101, -2), 5, p(50, -2), 10).unwrap(),
            Side::Yes
        );
        // Exponent on the other side.
        assert_eq!(cap_compare(p(1_000, -8), 1, p(1, -5), 1).unwrap(), Side::No);
        assert_eq!(
            cap_compare(p(1_001, -8), 1, p(1, -5), 1).unwrap(),
            Side::Yes
        );
    }

    #[test]
    fn cap_compare_rejects_non_positive_prices() {
        assert!(cap_compare(p(0, -5), 1, p(1, -5), 1).is_err());
        assert!(cap_compare(p(1, -5), 1, p(-1, -5), 1).is_err());
    }

    #[test]
    fn ratio_math() {
        let aapl = p(25_012_345, -5);
        let nvda = p(18_050_000_000, -8);
        // 250.12345 / 180.5 = 1.385725484..., 180.5 / 250.12345 = 0.721643652...
        assert_eq!(ratio_e9(aapl, nvda).unwrap(), 1_385_725_484);
        assert_eq!(ratio_e9(nvda, aapl).unwrap(), 721_643_652);
        assert_eq!(ratio_e9(p(2, 0), p(1, 0)).unwrap(), 2_000_000_000);
        assert_eq!(
            ratio_outperform(aapl, nvda, 1_300_000_000).unwrap(),
            Side::Yes
        );
        assert_eq!(
            ratio_outperform(aapl, nvda, 1_500_000_000).unwrap(),
            Side::No
        );
        assert_eq!(
            ratio_outperform(aapl, nvda, 1_385_725_484).unwrap(),
            Side::No
        );
    }

    #[test]
    fn e6_scaling_and_price_above() {
        assert_eq!(to_e6(p(25_012_345, -5)).unwrap(), 250_123_450);
        assert_eq!(to_e6(p(18_050_000_000, -8)).unwrap(), 180_500_000);
        assert_eq!(to_e6(p(3, 2)).unwrap(), 300_000_000);
        assert_eq!(to_e6(p(123_456_789, -9)).unwrap(), 123_456);
        assert_eq!(
            price_above(p(25_012_345, -5), 250_000_000).unwrap(),
            Side::Yes
        );
        assert_eq!(
            price_above(p(25_012_345, -5), 250_123_450).unwrap(),
            Side::No
        );
        assert!(to_e6(p(i64::MAX, 30)).is_err());
    }
}
