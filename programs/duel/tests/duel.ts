import * as fs from "fs";
import * as path from "path";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, EventParser, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { expect } from "chai";
import type { Duel } from "../target/types/duel";
import {
  AAPL_PRICE_E6,
  FEED_AAPL,
  FEED_NVDA,
  NVDA_PRICE_E6,
  ScenarioName,
  fixtureKeypair,
} from "./fixtures/pyth";

// Defaults so `pnpm test` works from Windows against the WSL validator without env vars.
process.env.ANCHOR_PROVIDER_URL ??= "http://127.0.0.1:8899";
process.env.ANCHOR_WALLET ??= path.join(__dirname, "..", ".keys", "id.json");

const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "duel.json"), "utf8"));

const E6 = 1_000_000n;
const usd = (n: number | bigint) => new BN((BigInt(n) * E6).toString());

type Side = { yes: Record<string, never> } | { no: Record<string, never> };
const YES: Side = { yes: {} };
const NO: Side = { no: {} };

function loadKeypair(file: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

function errorCode(err: any): string | undefined {
  const code = err?.error?.errorCode?.code;
  if (code) return code;
  const logs: string[] = err?.logs ?? err?.transactionLogs ?? [];
  const m = logs.join("\n").match(/Error Code: (\w+)/);
  if (m) return m[1];
  const s = String(err?.message ?? err);
  const m2 = s.match(/Error Code: (\w+)/);
  return m2?.[1];
}

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    const got = errorCode(err);
    expect(got, `expected ${code}, got: ${got ?? err}`).to.equal(code);
    return;
  }
  expect.fail(`expected error ${code} but the transaction succeeded`);
}

describe("duel", () => {
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL!, "confirmed");
  const payer = loadKeypair(process.env.ANCHOR_WALLET!);
  const wallet = new anchor.Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program<Duel>(idl, provider);
  const eventParser = new EventParser(program.programId, program.coder);

  // Actors. The payer is the creator, resolver and user; the crank is a separate key.
  const user = payer;
  const crank = Keypair.generate();
  const stranger = Keypair.generate();
  const recipients = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

  // Mints: collateral (SPL), pair A (Token-2022, like xStocks on mainnet), pair B (SPL).
  let usdc: PublicKey;
  let aaplx: PublicKey;
  let nvdax: PublicKey;
  let userUsdc: PublicKey;
  let userAaplx: PublicKey;
  let userNvdax: PublicKey;

  interface MarketCtx {
    nonce: BN;
    market: PublicKey;
    yesMint: PublicKey;
    noMint: PublicKey;
    collateralVault: PublicKey;
    rewardVaultA: PublicKey;
    rewardVaultB: PublicKey;
    userYes: PublicKey;
    userNo: PublicKey;
  }

  let nonceCounter = BigInt(Date.now());

  function derive(nonce: BN): MarketCtx {
    const [market] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), payer.publicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes"), market.toBuffer()], program.programId);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no"), market.toBuffer()], program.programId);
    return {
      nonce,
      market,
      yesMint,
      noMint,
      collateralVault: getAssociatedTokenAddressSync(usdc, market, true, TOKEN_PROGRAM_ID),
      rewardVaultA: getAssociatedTokenAddressSync(aaplx, market, true, TOKEN_2022_PROGRAM_ID),
      rewardVaultB: getAssociatedTokenAddressSync(nvdax, market, true, TOKEN_PROGRAM_ID),
      userYes: getAssociatedTokenAddressSync(yesMint, user.publicKey, false, TOKEN_PROGRAM_ID),
      userNo: getAssociatedTokenAddressSync(noMint, user.publicKey, false, TOKEN_PROGRAM_ID),
    };
  }

  const capCompare = (sharesA: bigint, sharesB: bigint) => ({
    capCompare: { feedA: FEED_AAPL, feedB: FEED_NVDA, sharesA: new BN(sharesA.toString()), sharesB: new BN(sharesB.toString()) },
  });

  async function createMarket(opts: {
    resolveTs: number;
    graceSecs?: number;
    template?: any;
    question?: string;
    labels?: [string, string];
    fees?: [number, number, number];
  }): Promise<MarketCtx & { sig: string }> {
    const nonce = new BN((nonceCounter++).toString());
    const ctx = derive(nonce);
    const params = {
      nonce,
      question: opts.question ?? "Will Apple be worth more than Nvidia at the close?",
      sideALabel: opts.labels?.[0] ?? "Apple",
      sideBLabel: opts.labels?.[1] ?? "Nvidia",
      template: opts.template ?? capCompare(15_000_000_000n, 24_400_000_000n),
      resolveTs: new BN(opts.resolveTs),
      graceSecs: new BN(opts.graceSecs ?? 0),
      resolver: payer.publicKey,
      crank: crank.publicKey,
      feeBpsHolders: opts.fees?.[0] ?? 80,
      feeBpsCreator: opts.fees?.[1] ?? 10,
      feeBpsPlatform: opts.fees?.[2] ?? 10,
    };
    const sig = await program.methods
      .createMarket(params)
      .accountsStrict({
        creator: payer.publicKey,
        market: ctx.market,
        collateralMint: usdc,
        pairAMint: aaplx,
        pairBMint: nvdax,
        yesMint: ctx.yesMint,
        noMint: ctx.noMint,
        collateralVault: ctx.collateralVault,
        rewardVaultA: ctx.rewardVaultA,
        rewardVaultB: ctx.rewardVaultB,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        pairATokenProgram: TOKEN_2022_PROGRAM_ID,
        pairBTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { ...ctx, sig };
  }

  const mintSet = (m: MarketCtx, amount: BN, signer: Keypair = user) =>
    program.methods
      .mintSet(amount)
      .accountsStrict({
        user: signer.publicKey,
        market: m.market,
        collateralMint: usdc,
        collateralVault: m.collateralVault,
        userCollateral: userUsdc,
        yesMint: m.yesMint,
        noMint: m.noMint,
        userYes: m.userYes,
        userNo: m.userNo,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers(signer.publicKey.equals(payer.publicKey) ? [] : [signer])
      .rpc();

  const mergeSet = (m: MarketCtx, amount: BN) =>
    program.methods
      .mergeSet(amount)
      .accountsStrict({
        user: user.publicKey,
        market: m.market,
        collateralMint: usdc,
        collateralVault: m.collateralVault,
        userCollateral: userUsdc,
        yesMint: m.yesMint,
        noMint: m.noMint,
        userYes: m.userYes,
        userNo: m.userNo,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

  const redeem = (m: MarketCtx, side: "yes" | "no", amount: BN) =>
    program.methods
      .redeem(amount)
      .accountsStrict({
        user: user.publicKey,
        market: m.market,
        outcomeMint: side === "yes" ? m.yesMint : m.noMint,
        userOutcome: side === "yes" ? m.userYes : m.userNo,
        collateralMint: usdc,
        collateralVault: m.collateralVault,
        userCollateral: userUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

  const resolveManual = (m: MarketCtx, winner: Side, signer: Keypair = payer, priceA = 0, priceB = 0) =>
    program.methods
      .resolveManual(winner as any, new BN(priceA), new BN(priceB))
      .accountsStrict({ resolver: signer.publicKey, market: m.market })
      .signers(signer.publicKey.equals(payer.publicKey) ? [] : [signer])
      .rpc();

  const resolve = (m: MarketCtx, a: PublicKey, b: PublicKey | null) =>
    program.methods.resolve().accountsStrict({ market: m.market, priceUpdateA: a, priceUpdateB: b }).rpc();

  const depositRewards = (m: MarketCtx, side: Side, amount: BN, opts?: { pairMint?: PublicKey; vault?: PublicKey; from?: PublicKey; tokenProgram?: PublicKey }) =>
    program.methods
      .depositRewards(side as any, amount)
      .accountsStrict({
        depositor: user.publicKey,
        market: m.market,
        pairMint: opts?.pairMint ?? aaplx,
        rewardVault: opts?.vault ?? m.rewardVaultA,
        depositorToken: opts?.from ?? userAaplx,
        pairTokenProgram: opts?.tokenProgram ?? TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

  const distribute = (m: MarketCtx, side: Side, amounts: BN[], accounts: PublicKey[], signer: Keypair = crank) =>
    program.methods
      .distribute(side as any, amounts)
      .accountsStrict({
        crank: signer.publicKey,
        market: m.market,
        pairMint: aaplx,
        rewardVault: m.rewardVaultA,
        pairTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts(accounts.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })))
      .signers([signer])
      .rpc();

  const balance = async (ata: PublicKey, programId = TOKEN_PROGRAM_ID) => (await getAccount(connection, ata, "confirmed", programId)).amount;

  async function eventsOf(sig: string) {
    const tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    return [...eventParser.parseLogs(tx!.meta!.logMessages!)];
  }

  async function fixture(name: ScenarioName): Promise<PublicKey | null> {
    const pk = fixtureKeypair(name).publicKey;
    const info = await connection.getAccountInfo(pk);
    return info ? pk : null;
  }

  let now: number;
  let m1: MarketCtx; // the main flow market (resolve_ts in the past, grace 0)

  before(async function () {
    this.timeout(120_000);
    if ((await connection.getBalance(payer.publicKey)) < 5 * LAMPORTS_PER_SOL) {
      const sig = await connection.requestAirdrop(payer.publicKey, 100 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    }
    // Fund the crank and the stranger for fees.
    const fund = new Transaction();
    for (const k of [crank, stranger]) {
      fund.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: LAMPORTS_PER_SOL }));
    }
    await sendAndConfirmTransaction(connection, fund, [payer]);

    usdc = await createMint(connection, payer, payer.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID);
    aaplx = await createMint(connection, payer, payer.publicKey, null, 6, undefined, undefined, TOKEN_2022_PROGRAM_ID);
    nvdax = await createMint(connection, payer, payer.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID);

    userUsdc = (await getOrCreateAssociatedTokenAccount(connection, payer, usdc, user.publicKey, false, undefined, undefined, TOKEN_PROGRAM_ID)).address;
    userAaplx = (await getOrCreateAssociatedTokenAccount(connection, payer, aaplx, user.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID)).address;
    userNvdax = (await getOrCreateAssociatedTokenAccount(connection, payer, nvdax, user.publicKey, false, undefined, undefined, TOKEN_PROGRAM_ID)).address;
    await mintTo(connection, payer, usdc, userUsdc, payer, 1_000_000n * E6, [], undefined, TOKEN_PROGRAM_ID);
    await mintTo(connection, payer, aaplx, userAaplx, payer, 10_000n * E6, [], undefined, TOKEN_2022_PROGRAM_ID);
    await mintTo(connection, payer, nvdax, userNvdax, payer, 10_000n * E6, [], undefined, TOKEN_PROGRAM_ID);

    now = Math.floor(Date.now() / 1000);
  });

  describe("lifecycle: create -> mint -> merge -> mint -> resolve_manual -> redeem", () => {
    it("create_market creates the market, YES/NO mints and vaults", async () => {
      m1 = await createMarket({ resolveTs: now - 60, graceSecs: 0 });
      const tx = await connection.getTransaction(m1.sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      console.log(`      create_market compute units: ${tx!.meta!.computeUnitsConsumed}`);

      const market = await program.account.market.fetch(m1.market);
      expect(market.creator.equals(payer.publicKey)).to.be.true;
      expect(market.nonce.eq(m1.nonce)).to.be.true;
      expect(market.question).to.equal("Will Apple be worth more than Nvidia at the close?");
      expect(market.sideALabel).to.equal("Apple");
      expect(market.sideBLabel).to.equal("Nvidia");
      expect(market.collateralMint.equals(usdc)).to.be.true;
      expect(market.collateralVault.equals(m1.collateralVault)).to.be.true;
      expect(market.yesMint.equals(m1.yesMint)).to.be.true;
      expect(market.noMint.equals(m1.noMint)).to.be.true;
      expect(market.pairAMint.equals(aaplx)).to.be.true;
      expect(market.pairBMint.equals(nvdax)).to.be.true;
      expect(market.rewardVaultA.equals(m1.rewardVaultA)).to.be.true;
      expect(market.rewardVaultB.equals(m1.rewardVaultB)).to.be.true;
      expect(market.resolver.equals(payer.publicKey)).to.be.true;
      expect(market.crank.equals(crank.publicKey)).to.be.true;
      expect(market.status).to.deep.equal({ open: {} });
      expect(market.template.capCompare).to.not.be.undefined;
      expect(market.template.capCompare!.sharesA.toString()).to.equal("15000000000");
      expect(market.feeBpsHolders).to.equal(80);
      expect(market.totalMinted.toNumber()).to.equal(0);
      expect(market.epochs).to.equal(0);
      expect(market.poolA.equals(PublicKey.default)).to.be.true;

      for (const mintPk of [m1.yesMint, m1.noMint]) {
        const mint = await getMint(connection, mintPk, "confirmed", TOKEN_PROGRAM_ID);
        expect(mint.decimals).to.equal(6);
        expect(mint.mintAuthority!.equals(m1.market)).to.be.true;
        expect(mint.freezeAuthority!.equals(m1.market)).to.be.true;
        expect(mint.supply).to.equal(0n);
      }
      const vault = await getAccount(connection, m1.collateralVault, "confirmed", TOKEN_PROGRAM_ID);
      expect(vault.owner.equals(m1.market)).to.be.true;
      const rvA = await getAccount(connection, m1.rewardVaultA, "confirmed", TOKEN_2022_PROGRAM_ID);
      expect(rvA.owner.equals(m1.market)).to.be.true;
      expect(rvA.mint.equals(aaplx)).to.be.true;
      const rvB = await getAccount(connection, m1.rewardVaultB, "confirmed", TOKEN_PROGRAM_ID);
      expect(rvB.mint.equals(nvdax)).to.be.true;

      const events = await eventsOf(m1.sig);
      expect(events.map((e) => e.name)).to.include("marketCreated");
    });

    it("rejects invalid params (question too long)", async () => {
      await expectError(createMarket({ resolveTs: now, question: "x".repeat(161) }), "InvalidParams");
    });

    it("mint_set: 1,000 USDC in, 1,000 YES + 1,000 NO out", async () => {
      const before = await balance(userUsdc);
      const sig = await mintSet(m1, usd(1_000));
      expect(before - (await balance(userUsdc))).to.equal(1_000n * E6);
      expect(await balance(m1.collateralVault)).to.equal(1_000n * E6);
      expect(await balance(m1.userYes)).to.equal(1_000n * E6);
      expect(await balance(m1.userNo)).to.equal(1_000n * E6);
      const market = await program.account.market.fetch(m1.market);
      expect(market.totalMinted.toString()).to.equal((1_000n * E6).toString());
      const events = await eventsOf(sig);
      expect(events.find((e) => e.name === "setMinted")!.data.amount.toString()).to.equal((1_000n * E6).toString());
    });

    it("merge_set: 400 sets back into 400 USDC", async () => {
      const before = await balance(userUsdc);
      await mergeSet(m1, usd(400));
      expect((await balance(userUsdc)) - before).to.equal(400n * E6);
      expect(await balance(m1.collateralVault)).to.equal(600n * E6);
      expect(await balance(m1.userYes)).to.equal(600n * E6);
      expect(await balance(m1.userNo)).to.equal(600n * E6);
      expect((await program.account.market.fetch(m1.market)).totalMinted.toString()).to.equal((600n * E6).toString());
    });

    it("mint_set again: 400 more", async () => {
      await mintSet(m1, usd(400));
      expect(await balance(m1.collateralVault)).to.equal(1_000n * E6);
      expect(await balance(m1.userYes)).to.equal(1_000n * E6);
      expect(await balance(m1.userNo)).to.equal(1_000n * E6);
    });

    it("mint_set rejects zero amount", async () => {
      await expectError(mintSet(m1, new BN(0)), "InvalidAmount");
    });

    it("redeem before resolution fails with NotResolved", async () => {
      await expectError(redeem(m1, "yes", usd(1)), "NotResolved");
    });

    it("resolve with an account not owned by Pyth fails with InvalidOracleAccount", async () => {
      await expectError(resolve(m1, usdc, nvdax), "InvalidOracleAccount");
    });

    it("resolve_manual by a non-resolver fails with Unauthorized", async () => {
      await expectError(resolveManual(m1, YES, stranger), "Unauthorized");
    });

    it("resolve_manual before the grace period fails with GraceNotElapsed", async () => {
      const m = await createMarket({ resolveTs: now - 60, graceSecs: 86_400 });
      await expectError(resolveManual(m, YES), "GraceNotElapsed");
    });

    it("resolve_manual: the resolver settles YES (Apple)", async () => {
      const sig = await resolveManual(m1, YES, payer, 250_123_450, 180_500_000);
      const market = await program.account.market.fetch(m1.market);
      expect(market.status.resolved).to.not.be.undefined;
      expect(market.status.resolved!.winner).to.deep.equal(YES);
      expect(market.status.resolved!.priceA.toNumber()).to.equal(250_123_450);
      expect(market.status.resolved!.priceB.toNumber()).to.equal(180_500_000);
      expect(market.status.resolved!.resolvedTs.toNumber()).to.be.greaterThan(now - 120);
      const ev = (await eventsOf(sig)).find((e) => e.name === "marketResolved")!;
      expect(ev.data.manual).to.equal(true);
      expect(ev.data.winner).to.deep.equal(YES);
    });

    it("resolve_manual twice fails with AlreadyResolved", async () => {
      await expectError(resolveManual(m1, NO), "AlreadyResolved");
    });

    it("resolve after manual resolution fails with AlreadyResolved", async () => {
      await expectError(resolve(m1, usdc, nvdax), "AlreadyResolved");
    });

    it("mint_set after resolution fails with AlreadyResolved", async () => {
      await expectError(mintSet(m1, usd(1)), "AlreadyResolved");
    });

    it("redeem the losing side fails with WrongSide", async () => {
      await expectError(redeem(m1, "no", usd(1)), "WrongSide");
    });

    it("redeem the winning side: 1,000 YES -> 1,000 USDC", async () => {
      const before = await balance(userUsdc);
      const sig = await redeem(m1, "yes", usd(1_000));
      expect((await balance(userUsdc)) - before).to.equal(1_000n * E6);
      expect(await balance(m1.userYes)).to.equal(0n);
      expect(await balance(m1.collateralVault)).to.equal(0n);
      const market = await program.account.market.fetch(m1.market);
      expect(market.totalRedeemed.toString()).to.equal((1_000n * E6).toString());
      const ev = (await eventsOf(sig)).find((e) => e.name === "redeemed")!;
      expect(ev.data.side).to.deep.equal(YES);
    });

    it("merge_set after resolution still works for full sets (losing tokens are worthless alone)", async () => {
      // user still holds 1,000 NO but 0 YES: a merge must fail at the burn.
      let failed = false;
      try {
        await mergeSet(m1, usd(1));
      } catch {
        failed = true;
      }
      expect(failed).to.be.true;
    });
  });

  describe("set_pools", () => {
    let m: MarketCtx;
    const poolA = Keypair.generate().publicKey;
    const poolB = Keypair.generate().publicKey;

    before(async () => {
      m = await createMarket({ resolveTs: now + 3600 });
    });

    it("non-creator fails with Unauthorized", async () => {
      await expectError(
        program.methods.setPools(poolA, poolB).accountsStrict({ creator: stranger.publicKey, market: m.market }).signers([stranger]).rpc(),
        "Unauthorized"
      );
    });

    it("creator sets the pools once", async () => {
      const sig = await program.methods.setPools(poolA, poolB).accountsStrict({ creator: payer.publicKey, market: m.market }).rpc();
      const market = await program.account.market.fetch(m.market);
      expect(market.poolA.equals(poolA)).to.be.true;
      expect(market.poolB.equals(poolB)).to.be.true;
      expect((await eventsOf(sig)).map((e) => e.name)).to.include("poolsSet");
    });

    it("second call fails with PoolsAlreadySet", async () => {
      await expectError(
        program.methods.setPools(poolB, poolA).accountsStrict({ creator: payer.publicKey, market: m.market }).rpc(),
        "PoolsAlreadySet"
      );
    });
  });

  describe("rewards: deposit_rewards + distribute", () => {
    let m: MarketCtx;
    let recipientAtas: PublicKey[];
    const amounts = [usd(100), usd(120), usd(80)];

    before(async () => {
      m = await createMarket({ resolveTs: now + 3600 });
      recipientAtas = [];
      for (const r of recipients) {
        const ata = await getOrCreateAssociatedTokenAccount(connection, payer, aaplx, r.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID);
        recipientAtas.push(ata.address);
      }
    });

    it("deposit_rewards with a mismatched side fails with WrongSide", async () => {
      await expectError(depositRewards(m, NO, usd(1)), "WrongSide");
    });

    it("deposit_rewards: 300 AAPLx (Token-2022) into reward vault A", async () => {
      const sig = await depositRewards(m, YES, usd(300));
      expect(await balance(m.rewardVaultA, TOKEN_2022_PROGRAM_ID)).to.equal(300n * E6);
      expect((await eventsOf(sig)).map((e) => e.name)).to.include("rewardsDeposited");
    });

    it("deposit_rewards: 50 NVDAx (SPL) into reward vault B", async () => {
      await depositRewards(m, NO, usd(50), { pairMint: nvdax, vault: m.rewardVaultB, from: userNvdax, tokenProgram: TOKEN_PROGRAM_ID });
      expect(await balance(m.rewardVaultB, TOKEN_PROGRAM_ID)).to.equal(50n * E6);
    });

    it("distribute by a non-crank fails with Unauthorized", async () => {
      await expectError(distribute(m, YES, amounts, recipientAtas, stranger), "Unauthorized");
    });

    it("distribute with amounts exceeding the vault fails with InsufficientRewards", async () => {
      await expectError(distribute(m, YES, [usd(200), usd(101)], recipientAtas.slice(0, 2)), "InsufficientRewards");
    });

    it("distribute with mismatched lengths fails with RecipientCountMismatch", async () => {
      await expectError(distribute(m, YES, [usd(1)], recipientAtas.slice(0, 2)), "RecipientCountMismatch");
    });

    it("distribute to 13 recipients fails with TooManyRecipients", async () => {
      const thirteen = Array.from({ length: 13 }, (_, i) => recipientAtas[i % 3]);
      await expectError(
        distribute(m, YES, thirteen.map(() => new BN(1)), thirteen),
        "TooManyRecipients"
      );
    });

    it("distribute to a token account of the wrong mint fails with InvalidRecipient", async () => {
      await expectError(distribute(m, YES, [usd(1)], [userNvdax]), "InvalidRecipient");
    });

    it("distribute pays three recipients from vault A and emits RewardsPaid", async () => {
      const sig = await distribute(m, YES, amounts, recipientAtas);
      expect(await balance(recipientAtas[0], TOKEN_2022_PROGRAM_ID)).to.equal(100n * E6);
      expect(await balance(recipientAtas[1], TOKEN_2022_PROGRAM_ID)).to.equal(120n * E6);
      expect(await balance(recipientAtas[2], TOKEN_2022_PROGRAM_ID)).to.equal(80n * E6);
      expect(await balance(m.rewardVaultA, TOKEN_2022_PROGRAM_ID)).to.equal(0n);
      const market = await program.account.market.fetch(m.market);
      expect(market.epochs).to.equal(1);
      expect(market.rewardsPaidA.toString()).to.equal((300n * E6).toString());
      expect(market.rewardsPaidB.toString()).to.equal("0");
      const ev = (await eventsOf(sig)).find((e) => e.name === "rewardsPaid")!;
      expect(ev.data.side).to.deep.equal(YES);
      expect(ev.data.epoch).to.equal(1);
      expect(ev.data.count).to.equal(3);
      expect(ev.data.total.toString()).to.equal((300n * E6).toString());
      const tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      console.log(`      distribute(3) compute units: ${tx!.meta!.computeUnitsConsumed}`);
    });

    it("distribute from an empty vault fails with InsufficientRewards", async () => {
      await expectError(distribute(m, YES, [usd(1)], [recipientAtas[0]]), "InsufficientRewards");
    });
  });

  describe("resolve (Pyth PriceUpdateV2 fixtures)", () => {
    // These accounts are injected into the local validator by wsl/validator.sh from
    // tests/fixtures/accounts/*.json (`pnpm fixtures`). They are skipped if absent.
    let aapl: PublicKey | null;
    let nvda: PublicKey | null;
    let aaplStale: PublicKey | null;
    let aaplPartial: PublicKey | null;

    before(async function () {
      aapl = await fixture("aapl");
      nvda = await fixture("nvda");
      aaplStale = await fixture("aaplStale");
      aaplPartial = await fixture("aaplPartial");
      if (!aapl || !nvda || !aaplStale || !aaplPartial) {
        console.log("      (Pyth fixtures not loaded on this validator; run `pnpm fixtures` then wsl/validator.sh)");
      }
    });

    function needFixtures(this: Mocha.Context) {
      if (!aapl || !nvda || !aaplStale || !aaplPartial) this.skip();
    }

    it("resolve before resolve_ts fails with NotYetResolvable", async () => {
      const m = await createMarket({ resolveTs: now + 86_400 });
      await expectError(resolve(m, usdc, nvdax), "NotYetResolvable");
    });

    it("CapCompare: NVDA market cap wins -> NO", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60, template: capCompare(15_000_000_000n, 24_400_000_000n) });
      const sig = await resolve(m, aapl!, nvda!);
      const market = await program.account.market.fetch(m.market);
      expect(market.status.resolved!.winner).to.deep.equal(NO);
      expect(market.status.resolved!.priceA.toString()).to.equal(AAPL_PRICE_E6.toString());
      expect(market.status.resolved!.priceB.toString()).to.equal(NVDA_PRICE_E6.toString());
      const ev = (await eventsOf(sig)).find((e) => e.name === "marketResolved")!;
      expect(ev.data.manual).to.equal(false);
    });

    it("CapCompare: AAPL market cap wins -> YES, then YES redeems", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60, template: capCompare(30_000_000_000n, 10_000_000_000n) });
      await mintSet(m, usd(10));
      await resolve(m, aapl!, nvda!);
      const market = await program.account.market.fetch(m.market);
      expect(market.status.resolved!.winner).to.deep.equal(YES);
      const before = await balance(userUsdc);
      await redeem(m, "yes", usd(10));
      expect((await balance(userUsdc)) - before).to.equal(10n * E6);
    });

    it("RatioOutperform: AAPL/NVDA = 1.3857 above 1.3 -> YES, below 1.5 -> NO", async function () {
      needFixtures.call(this);
      const tpl = (start: bigint) => ({ ratioOutperform: { feedA: FEED_AAPL, feedB: FEED_NVDA, startRatioE9: new BN(start.toString()) } });
      const mYes = await createMarket({ resolveTs: now - 60, template: tpl(1_300_000_000n) });
      await resolve(mYes, aapl!, nvda!);
      expect((await program.account.market.fetch(mYes.market)).status.resolved!.winner).to.deep.equal(YES);
      const mNo = await createMarket({ resolveTs: now - 60, template: tpl(1_500_000_000n) });
      await resolve(mNo, aapl!, nvda!);
      expect((await program.account.market.fetch(mNo.market)).status.resolved!.winner).to.deep.equal(NO);
    });

    it("PriceAbove: AAPL $250.12 above $200 -> YES with price_update_b omitted", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60, template: { priceAbove: { feed: FEED_AAPL, thresholdE6: new BN(200_000_000) } } });
      await resolve(m, aapl!, null);
      const market = await program.account.market.fetch(m.market);
      expect(market.status.resolved!.winner).to.deep.equal(YES);
      expect(market.status.resolved!.priceA.toString()).to.equal(AAPL_PRICE_E6.toString());
      expect(market.status.resolved!.priceB.toNumber()).to.equal(0);
    });

    it("CapCompare without price_update_b fails with MissingOracle", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60 });
      await expectError(resolve(m, aapl!, null), "MissingOracle");
    });

    it("stale price (7h old) fails with StaleOracle", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60 });
      await expectError(resolve(m, aaplStale!, nvda!), "StaleOracle");
    });

    it("partially verified price fails with InsufficientVerification", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60 });
      await expectError(resolve(m, aaplPartial!, nvda!), "InsufficientVerification");
    });

    it("swapped feeds fail with FeedMismatch", async function () {
      needFixtures.call(this);
      const m = await createMarket({ resolveTs: now - 60 });
      await expectError(resolve(m, nvda!, aapl!), "FeedMismatch");
    });
  });
});
