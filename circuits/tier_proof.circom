pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/eddsaposeidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// ─── TierProof ────────────────────────────────────────────────────────────────
// Proves that a trusted oracle signed a KYC credential for a specific wallet
// without revealing the wallet's personal data.
//
// The oracle signs:  M = Poseidon(walletAddr, tier, creditScore, expiry, nonce)
// This circuit proves the prover knows the full preimage of M and that the
// oracle's EdDSA (Baby Jubjub + Poseidon) signature on M is valid.
//
// It also proves the tier is consistent with creditScore bands:
//   score  0-34  => tier 1
//   score 35-59  => tier 2
//   score 60-79  => tier 3
//   score 80-100 => tier 4
//
// Public signals (in order): nullifier, tierPub, expiryPub, walletAddrPub, Ax, Ay
// ─────────────────────────────────────────────────────────────────────────────
template TierProof() {

    // ── Private signals (never leave the user's device) ──────────────────────
    signal input walletAddr;    // wallet address as field element (160-bit)
    signal input tier;          // KYC tier: 1 (2x), 2 (5x), 3 (8x), 4 (10x)
    signal input creditScore;   // wallet credit score: integer 0..100
    signal input expiry;        // unix timestamp (credential expiry)
    signal input nonce;         // random 253-bit salt

    signal input sigR8x;        // EdDSA signature R8.x (Baby Jubjub point)
    signal input sigR8y;        // EdDSA signature R8.y
    signal input sigS;          // EdDSA signature scalar S

    // ── Public signals (committed on-chain with the proof) ───────────────────
    signal input nullifier;      // anti-replay: Poseidon(nonce, walletAddr)
    signal input tierPub;        // committed tier — must equal private tier
    signal input expiryPub;      // committed expiry — must equal private expiry
    signal input walletAddrPub;  // committed address — must equal private addr
    signal input Ax;             // oracle Baby Jubjub public key X
    signal input Ay;             // oracle Baby Jubjub public key Y

    // ── 1. Pin public commitments to private values ───────────────────────────
    walletAddrPub === walletAddr;
    tierPub       === tier;
    expiryPub     === expiry;

    // ── 1b. Prove tier is derived from credit score bands ───────────────────
    // Range check: 0 <= creditScore <= 100
    component scoreLt101 = LessThan(8);
    scoreLt101.in[0] <== creditScore;
    scoreLt101.in[1] <== 101;
    scoreLt101.out === 1;

    // Booleans for score thresholds
    component lt35 = LessThan(8);
    lt35.in[0] <== creditScore;
    lt35.in[1] <== 35;

    component lt60 = LessThan(8);
    lt60.in[0] <== creditScore;
    lt60.in[1] <== 60;

    component lt80 = LessThan(8);
    lt80.in[0] <== creditScore;
    lt80.in[1] <== 80;

    signal isTier1;
    signal isTier2;
    signal isTier3;
    signal isTier4;

    signal ge35;
    signal ge60;
    signal ge80;

    ge35 <== 1 - lt35.out;
    ge60 <== 1 - lt60.out;
    ge80 <== 1 - lt80.out;

    // score < 35
    isTier1 <== lt35.out;
    // 35 <= score < 60
    isTier2 <== ge35 * lt60.out;
    // 60 <= score < 80
    isTier3 <== ge60 * lt80.out;
    // 80 <= score <= 100
    isTier4 <== ge80;

    // Exactly one band must be selected
    isTier1 + isTier2 + isTier3 + isTier4 === 1;

    // Tier must match computed score band
    tier === isTier1 + 2 * isTier2 + 3 * isTier3 + 4 * isTier4;

    // ── 2. Nullifier = Poseidon(nonce, walletAddr) ────────────────────────────
    component nullHash = Poseidon(2);
    nullHash.inputs[0] <== nonce;
    nullHash.inputs[1] <== walletAddr;
    nullifier === nullHash.out;

    // ── 3. Message = Poseidon(walletAddr, tier, creditScore, expiry, nonce) ──
    //    This is what the oracle signed with its Baby Jubjub private key.
    component msgHash = Poseidon(5);
    msgHash.inputs[0] <== walletAddr;
    msgHash.inputs[1] <== tier;
    msgHash.inputs[2] <== creditScore;
    msgHash.inputs[3] <== expiry;
    msgHash.inputs[4] <== nonce;

    // ── 4. EdDSA Poseidon signature verification ──────────────────────────────
    //    Verifies oracle's Baby Jubjub signature on the message hash.
    component sigVerify = EdDSAPoseidonVerifier();
    sigVerify.enabled <== 1;
    sigVerify.Ax      <== Ax;
    sigVerify.Ay      <== Ay;
    sigVerify.R8x     <== sigR8x;
    sigVerify.R8y     <== sigR8y;
    sigVerify.S       <== sigS;
    sigVerify.M       <== msgHash.out;
}

component main { public [nullifier, tierPub, expiryPub, walletAddrPub, Ax, Ay] } = TierProof();
