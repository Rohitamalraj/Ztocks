/**
 * Generates a Baby Jubjub EdDSA keypair for the KYC oracle.
 * Run once, then add the private key to frontend/.env.local
 * and pass the public key (Ax, Ay) to ZKVerifier constructor.
 *
 * Usage: npx ts-node scripts/gen-oracle-key.ts
 */
import { derivePublicKey } from "@zk-kit/eddsa-poseidon";
import { randomBytes } from "crypto";

const privKeyBytes = randomBytes(32);
const privKeyHex   = privKeyBytes.toString("hex");

const pubKey = derivePublicKey(privKeyBytes);
const Ax = pubKey[0].toString();
const Ay = pubKey[1].toString();

console.log("\n=== Oracle Baby Jubjub Keypair ===\n");
console.log("Add to frontend/.env.local:");
console.log(`ORACLE_PRIVATE_KEY=${privKeyHex}`);
console.log(`ORACLE_PUBKEY_AX=${Ax}`);
console.log(`ORACLE_PUBKEY_AY=${Ay}`);
console.log("\nAdd to contracts/.env (for deploy.ts):");
console.log(`ORACLE_PUBKEY_AX=${Ax}`);
console.log(`ORACLE_PUBKEY_AY=${Ay}`);
console.log("\nDo NOT commit the private key.\n");
