/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/duel.json`.
 */
export type Duel = {
  "address": "AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25",
  "metadata": {
    "name": "duel",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Paired prediction duels: YES/NO outcome tokens fully collateralized by USDC, resolved by Pyth."
  },
  "instructions": [
    {
      "name": "createMarket",
      "docs": [
        "Create a market, its YES/NO mints, the collateral vault and both reward vaults."
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "params.nonce"
              }
            ]
          }
        },
        {
          "name": "collateralMint",
          "docs": [
            "Collateral (USDC or a mock). SPL Token or Token-2022."
          ]
        },
        {
          "name": "pairAMint",
          "docs": [
            "Pair token for side A (e.g. AAPLx). SPL Token or Token-2022."
          ]
        },
        {
          "name": "pairBMint",
          "docs": [
            "Pair token for side B (e.g. NVDAx). SPL Token or Token-2022."
          ]
        },
        {
          "name": "yesMint",
          "docs": [
            "YES outcome mint: classic SPL Token, 6 decimals, authorities = market PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "noMint",
          "docs": [
            "NO outcome mint: classic SPL Token, 6 decimals, authorities = market PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "collateralTokenProgram"
              },
              {
                "kind": "account",
                "path": "collateralMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "rewardVaultA",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "pairATokenProgram"
              },
              {
                "kind": "account",
                "path": "pairAMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "rewardVaultB",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "pairBTokenProgram"
              },
              {
                "kind": "account",
                "path": "pairBMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Classic SPL Token program (for the YES/NO mints)."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "collateralTokenProgram",
          "docs": [
            "Token program owning `collateral_mint`."
          ]
        },
        {
          "name": "pairATokenProgram",
          "docs": [
            "Token program owning `pair_a_mint`."
          ]
        },
        {
          "name": "pairBTokenProgram",
          "docs": [
            "Token program owning `pair_b_mint`."
          ]
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createMarketParams"
            }
          }
        }
      ]
    },
    {
      "name": "depositRewards",
      "docs": [
        "Deposit pair tokens into a side's reward vault (anyone)."
      ],
      "discriminator": [
        52,
        249,
        112,
        72,
        206,
        161,
        196,
        1
      ],
      "accounts": [
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "pairMint"
        },
        {
          "name": "rewardVault",
          "writable": true
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "pairTokenProgram"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "distribute",
      "docs": [
        "Crank-only: pay `amounts[i]` from the side's reward vault to `remaining_accounts[i]`."
      ],
      "discriminator": [
        191,
        44,
        223,
        207,
        164,
        236,
        126,
        61
      ],
      "accounts": [
        {
          "name": "crank",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "pairMint"
        },
        {
          "name": "rewardVault",
          "writable": true
        },
        {
          "name": "pairTokenProgram"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "amounts",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "mergeSet",
      "docs": [
        "Burn `amount` YES and `amount` NO and withdraw `amount` collateral."
      ],
      "discriminator": [
        138,
        227,
        163,
        223,
        237,
        229,
        120,
        58
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "collateralMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "collateralVault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userCollateral",
          "writable": true
        },
        {
          "name": "yesMint",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "noMint",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userYes",
          "writable": true
        },
        {
          "name": "userNo",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "collateralTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintSet",
      "docs": [
        "Deposit `amount` collateral and receive `amount` YES and `amount` NO."
      ],
      "discriminator": [
        91,
        117,
        1,
        75,
        201,
        110,
        110,
        189
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "collateralMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "collateralVault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userCollateral",
          "writable": true
        },
        {
          "name": "yesMint",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "noMint",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userYes",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "yesMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userNo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "noMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "docs": [
        "Burn `amount` winning tokens and withdraw `amount` collateral."
      ],
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "outcomeMint",
          "docs": [
            "The winning outcome mint (`yes_mint` if the winner is `Yes`, `no_mint` if `No`)."
          ],
          "writable": true
        },
        {
          "name": "userOutcome",
          "writable": true
        },
        {
          "name": "collateralMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "collateralVault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userCollateral",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "collateralTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolve",
      "docs": [
        "Permissionless resolution from Pyth `PriceUpdateV2` accounts after `resolve_ts`."
      ],
      "discriminator": [
        246,
        150,
        236,
        206,
        108,
        63,
        58,
        10
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "priceUpdateA",
          "docs": [
            "full verification, feed id, freshness) for feed A (or the single `PriceAbove` feed)."
          ]
        },
        {
          "name": "priceUpdateB",
          "optional": true
        }
      ],
      "args": []
    },
    {
      "name": "resolveManual",
      "docs": [
        "Resolver-only fallback after `resolve_ts + grace_secs`. Prices are USD scaled by 1e6."
      ],
      "discriminator": [
        64,
        38,
        4,
        174,
        253,
        126,
        73,
        213
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "priceA",
          "type": "i64"
        },
        {
          "name": "priceB",
          "type": "i64"
        }
      ]
    },
    {
      "name": "setPools",
      "docs": [
        "Record the Meteora pool addresses. Creator only, once."
      ],
      "discriminator": [
        11,
        177,
        121,
        2,
        1,
        113,
        13,
        199
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "poolA",
          "type": "pubkey"
        },
        {
          "name": "poolB",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    }
  ],
  "events": [
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketResolved",
      "discriminator": [
        89,
        67,
        230,
        95,
        143,
        106,
        199,
        202
      ]
    },
    {
      "name": "poolsSet",
      "discriminator": [
        152,
        132,
        63,
        46,
        21,
        45,
        19,
        48
      ]
    },
    {
      "name": "redeemed",
      "discriminator": [
        14,
        29,
        183,
        71,
        31,
        165,
        107,
        38
      ]
    },
    {
      "name": "rewardsDeposited",
      "discriminator": [
        120,
        19,
        149,
        33,
        111,
        163,
        248,
        156
      ]
    },
    {
      "name": "rewardsPaid",
      "discriminator": [
        131,
        204,
        160,
        15,
        132,
        68,
        29,
        42
      ]
    },
    {
      "name": "setMerged",
      "discriminator": [
        248,
        96,
        180,
        111,
        223,
        109,
        190,
        144
      ]
    },
    {
      "name": "setMinted",
      "discriminator": [
        134,
        220,
        152,
        208,
        56,
        170,
        13,
        171
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notYetResolvable",
      "msg": "Market cannot be resolved before resolve_ts"
    },
    {
      "code": 6001,
      "name": "alreadyResolved",
      "msg": "Market is already resolved"
    },
    {
      "code": 6002,
      "name": "notResolved",
      "msg": "Market is not resolved yet"
    },
    {
      "code": 6003,
      "name": "wrongSide",
      "msg": "Token, mint or vault does not match the requested side"
    },
    {
      "code": 6004,
      "name": "staleOracle",
      "msg": "Oracle price is stale (older than the 6 hour window)"
    },
    {
      "code": 6005,
      "name": "graceNotElapsed",
      "msg": "Manual resolution grace period has not elapsed"
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "Signer is not authorized for this action"
    },
    {
      "code": 6007,
      "name": "tooManyRecipients",
      "msg": "Too many recipients (max 12 per call)"
    },
    {
      "code": 6008,
      "name": "insufficientRewards",
      "msg": "Reward vault balance is insufficient for the requested amounts"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "invalidParams",
      "msg": "Invalid market parameters (question or label too long, bad fees or template)"
    },
    {
      "code": 6011,
      "name": "poolsAlreadySet",
      "msg": "Pools have already been set for this market"
    },
    {
      "code": 6012,
      "name": "invalidOracleAccount",
      "msg": "Oracle account is not a Pyth PriceUpdateV2 owned by the Pyth receiver program"
    },
    {
      "code": 6013,
      "name": "insufficientVerification",
      "msg": "Oracle price update does not carry full verification"
    },
    {
      "code": 6014,
      "name": "feedMismatch",
      "msg": "Oracle feed id does not match the market template"
    },
    {
      "code": 6015,
      "name": "invalidOraclePrice",
      "msg": "Oracle price is not positive"
    },
    {
      "code": 6016,
      "name": "missingOracle",
      "msg": "A second oracle account is required for this template"
    },
    {
      "code": 6017,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6018,
      "name": "recipientCountMismatch",
      "msg": "amounts length must equal the number of recipient accounts"
    },
    {
      "code": 6019,
      "name": "invalidRecipient",
      "msg": "Recipient is not a writable token account of the pair mint"
    },
    {
      "code": 6020,
      "name": "collateralShortfall",
      "msg": "Collateral transfer did not credit the full amount (transfer-fee mints unsupported)"
    }
  ],
  "types": [
    {
      "name": "createMarketParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "sideALabel",
            "type": "string"
          },
          {
            "name": "sideBLabel",
            "type": "string"
          },
          {
            "name": "template",
            "type": {
              "defined": {
                "name": "resolutionTemplate"
              }
            }
          },
          {
            "name": "resolveTs",
            "type": "i64"
          },
          {
            "name": "graceSecs",
            "type": "i64"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "crank",
            "type": "pubkey"
          },
          {
            "name": "feeBpsHolders",
            "type": "u16"
          },
          {
            "name": "feeBpsCreator",
            "type": "u16"
          },
          {
            "name": "feeBpsPlatform",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "sideALabel",
            "type": "string"
          },
          {
            "name": "sideBLabel",
            "type": "string"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralVault",
            "type": "pubkey"
          },
          {
            "name": "yesMint",
            "type": "pubkey"
          },
          {
            "name": "noMint",
            "type": "pubkey"
          },
          {
            "name": "pairAMint",
            "type": "pubkey"
          },
          {
            "name": "pairBMint",
            "type": "pubkey"
          },
          {
            "name": "rewardVaultA",
            "type": "pubkey"
          },
          {
            "name": "rewardVaultB",
            "type": "pubkey"
          },
          {
            "name": "template",
            "type": {
              "defined": {
                "name": "resolutionTemplate"
              }
            }
          },
          {
            "name": "resolveTs",
            "type": "i64"
          },
          {
            "name": "graceSecs",
            "type": "i64"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "crank",
            "type": "pubkey"
          },
          {
            "name": "feeBpsHolders",
            "type": "u16"
          },
          {
            "name": "feeBpsCreator",
            "type": "u16"
          },
          {
            "name": "feeBpsPlatform",
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketStatus"
              }
            }
          },
          {
            "name": "poolA",
            "type": "pubkey"
          },
          {
            "name": "poolB",
            "type": "pubkey"
          },
          {
            "name": "totalMinted",
            "docs": [
              "Outstanding full sets (minted minus merged). Vault balance == total_minted - total_redeemed."
            ],
            "type": "u64"
          },
          {
            "name": "totalRedeemed",
            "docs": [
              "Winning tokens redeemed for collateral."
            ],
            "type": "u64"
          },
          {
            "name": "rewardsPaidA",
            "type": "u64"
          },
          {
            "name": "rewardsPaidB",
            "type": "u64"
          },
          {
            "name": "epochs",
            "type": "u32"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "marketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "yesMint",
            "type": "pubkey"
          },
          {
            "name": "noMint",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "pairAMint",
            "type": "pubkey"
          },
          {
            "name": "pairBMint",
            "type": "pubkey"
          },
          {
            "name": "resolveTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "priceA",
            "docs": [
              "USD scaled by 1e6."
            ],
            "type": "i64"
          },
          {
            "name": "priceB",
            "docs": [
              "USD scaled by 1e6 (0 for PriceAbove)."
            ],
            "type": "i64"
          },
          {
            "name": "resolvedTs",
            "type": "i64"
          },
          {
            "name": "manual",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "marketStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "resolved",
            "fields": [
              {
                "name": "winner",
                "type": {
                  "defined": {
                    "name": "side"
                  }
                }
              },
              {
                "name": "priceA",
                "type": "i64"
              },
              {
                "name": "priceB",
                "type": "i64"
              },
              {
                "name": "resolvedTs",
                "type": "i64"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "poolsSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "poolA",
            "type": "pubkey"
          },
          {
            "name": "poolB",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "redeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "resolutionTemplate",
      "docs": [
        "How the market resolves. Feed ids are 32-byte Pyth price feed ids."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "capCompare",
            "fields": [
              {
                "name": "feedA",
                "type": {
                  "array": [
                    "u8",
                    32
                  ]
                }
              },
              {
                "name": "feedB",
                "type": {
                  "array": [
                    "u8",
                    32
                  ]
                }
              },
              {
                "name": "sharesA",
                "type": "u64"
              },
              {
                "name": "sharesB",
                "type": "u64"
              }
            ]
          },
          {
            "name": "ratioOutperform",
            "fields": [
              {
                "name": "feedA",
                "type": {
                  "array": [
                    "u8",
                    32
                  ]
                }
              },
              {
                "name": "feedB",
                "type": {
                  "array": [
                    "u8",
                    32
                  ]
                }
              },
              {
                "name": "startRatioE9",
                "type": "u64"
              }
            ]
          },
          {
            "name": "priceAbove",
            "fields": [
              {
                "name": "feed",
                "type": {
                  "array": [
                    "u8",
                    32
                  ]
                }
              },
              {
                "name": "thresholdE6",
                "type": "u64"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "rewardsDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rewardsPaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "epoch",
            "type": "u32"
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "count",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "setMerged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "setMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "side",
      "docs": [
        "Which side of the duel. `Yes` is side A (the YES mint, `pair_a_mint`,",
        "`reward_vault_a`); `No` is side B (the NO mint, `pair_b_mint`, `reward_vault_b`)."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    }
  ]
};
