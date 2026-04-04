# SuiShadow : Stealth Address Protocol for Sui

> Non-interactive, private transactions on the Sui blockchain using EIP-5564 adapted for Move.

---

## Table of Contents

1. [What This Project Does](#what-this-project-does)
2. [Why Stealth Addresses](#why-stealth-addresses)
3. [System Architecture](#system-architecture)
4. [Component Breakdown](#component-breakdown)
5. [Protocol Flow](#protocol-flow)
6. [Cryptographic Design](#cryptographic-design)
7. [Smart Contract Design (Sui Move)](#smart-contract-design-sui-move)
8. [Off-Chain SDK Design (Rust)](#off-chain-sdk-design-rust)
9. [Indexer Service Design](#indexer-service-design)
10. [API Design](#api-design)
11. [Frontend dApp Design](#frontend-dapp-design)
12. [Data Models](#data-models)
13. [Gas and Fee Strategy (TBD)](#gas-and-fee-strategy-tbd)
14. [Privacy Model and Threat Analysis](#privacy-model-and-threat-analysis)
15. [Development Roadmap](#development-roadmap)
16. [Technology Stack](#technology-stack)
17. [References](#references)

---

## What This Project Does

SuiShadow enables any Sui user to receive funds at one time addresses that cannot be linked to their public identity. A sender can pay a receiver without anyone else on the blockchain being able to determine who the receiver is - including the indexer service, block explorers, or other observers.

The protocol is non-interactive: the receiver publishes a stealth meta address once, and any sender can independently generate a fresh stealth address for them without any communication or coordination with the receiver.

---

## Why Stealth Addresses

On Sui today, every transaction is publicly visible. If Alice sends 100 SUI to Bob, anyone can see that Alice's address sent to Bob's address. This creates problems for:

- **Salary payments** - Everyone can see what employees earn
- **Donations** - Donors' identities and amounts are public
- **Business transactions** - Competitors can track payments and supplier relationships
- **Personal privacy** - Financial history is permanently public

Stealth addresses solve this by making each incoming payment arrive at a brand-new address that only the receiver can identify as theirs. From the blockchain's perspective, funds go to a previously unseen address with no connection to any known identity.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend dApp                            │
│  (React/Next.js + Rust SDK compiled to WASM)                    │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │  Wallet   │  │  Register  │  │   Send    │  │   Receive    │ │
│  │  Connect  │  │   Flow     │  │   Flow    │  │   Flow       │ │
│  └──────────┘  └────────────┘  └───────────┘  └──────────────┘ │
└─────────────────────────┬────────────────────────────────────────┘
                          │
            ┌─────────────┼──────────────┐
            ▼             ▼              ▼
┌───────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Rust SDK     │ │  Sui Chain   │ │  Indexer Service  │
│  (WASM)       │ │              │ │                   │
│               │ │ ┌──────────┐ │ │  ┌─────────────┐ │
│ • Key derive  │ │ │ Registry │ │ │  │ Event        │ │
│ • ECDH        │ │ │ Contract │ │ │  │ Listener     │ │
│ • Stealth gen │ │ └──────────┘ │ │  └──────┬──────┘ │
│ • Scan/check  │ │ ┌──────────┐ │ │         ▼        │
│ • Key recover │ │ │Announcer │ │ │  ┌─────────────┐ │
│               │ │ │ Contract │ │ │  │ PostgreSQL   │ │
│               │ │ └──────────┘ │ │  │ Database     │ │
│               │ │              │ │  └──────┬──────┘ │
│               │ │              │ │         ▼        │
│               │ │              │ │  ┌─────────────┐ │
│               │ │              │ │  │  REST API    │ │
│               │ │              │ │  └─────────────┘ │
└───────────────┘ └──────────────┘ └──────────────────┘
```

### Design Principle: Crypto Off-Chain, Coordination On-Chain

Sui Move does not support secp256k1 elliptic curve point arithmetic (point addition or scalar multiplication) on-chain. The available `sui::ecdsa_k1` module only provides signature verification and public key recovery. The `sui::group_ops` module has generic EC operations but they are `public(package)` (internal to the Sui framework) and only exposed for Ristretto255 and BLS12-381 - not secp256k1.

Therefore all cryptographic heavy lifting (ECDH, stealth address computation, key derivation) happens off-chain in the Rust SDK. The on-chain contracts serve as a trustless coordination layer - storing public registrations and broadcasting announcements as events.

---

## Component Breakdown

### Component 1: Rust Off-Chain SDK

**Purpose:** All elliptic curve cryptography - key derivation, ECDH shared secrets, stealth address generation, announcement scanning, and stealth private key recovery.

**Deployment targets:**

- Native Rust binary (for indexer, CLI tools, backend services)
- WASM module (for browser-based frontend dApp)
- Mobile FFI (future: iOS/Android via C bindings)

**Crate dependencies:**
| Crate | Version | Purpose |
|-------|---------|---------|
| `k256` | 0.13 | secp256k1 curve: ECDH, point addition, scalar multiplication |
| `sha3` | 0.10 | Keccak-256 hashing (EIP-5564 specified) |
| `blake2` | 0.10 | Blake2b-256 for Sui address derivation |
| `rand` | 0.8 | Cryptographically secure random number generation |
| `hex` | 0.4 | Hex encoding/decoding for display and serialization |
| `serde` | 1.0 | Struct serialization for JSON API communication |
| `thiserror` | 2.0 | Ergonomic error type definitions |

### Component 2: Sui Move Smart Contracts

**Purpose:** On-chain coordination - meta-address registration and announcement broadcasting.

Two contracts:

**StealthRegistry** - Stores the mapping from regular Sui addresses to stealth meta-addresses. Any user can register their meta-address. Any user can look up anyone else's meta-address.

**StealthAnnouncer** - Called by senders after computing a stealth address. Emits an `Announcement` event containing the stealth address, ephemeral public key, and view tag. This event is the only link between the sender's transaction and the stealth address, and it reveals nothing about who the receiver is.

### Component 3: Indexer Service

**Purpose:** Captures all `Announcement` events from the blockchain, stores them in a database, and serves them via a REST API for efficient client-side scanning.

**Why needed:** Without an indexer, each receiver would need to query and process the entire history of announcement events directly from a Sui full node. This works at small scale but becomes impractical when there are millions of announcements.

**Privacy property:** The indexer stores only public blockchain data. It cannot determine which receiver owns which announcement - that requires the receiver's view private key, which never leaves their device.

### Component 4: Frontend dApp

**Purpose:** User-facing interface for all stealth address operations - registration, sending, receiving, and claiming.

**Key property:** All cryptographic operations run client-side in the browser via the WASM-compiled Rust SDK. Private keys never leave the user's device. The frontend communicates with the Sui chain (via wallet) and the indexer API (for announcement scanning), but the indexer never receives any secret material.

---

## Protocol Flow

### Phase 1: Receiver Setup (one-time)

```
Receiver's Sui Wallet
        │
        │ signs deterministic message
        ▼
   Signature (64 bytes: r || s)
        │
        ├── r (32 bytes) ──▶ keccak256 ──▶ mod n ──▶ View Private Key ──▶ View Public Key
        │
        └── s (32 bytes) ──▶ keccak256 ──▶ mod n ──▶ Spend Private Key ──▶ Spend Public Key
                                                                               │
                                                         View Pub + Spend Pub = Stealth Meta-Address
                                                                               │
                                                                               ▼
                                                                    Registry::register() on-chain
```

The receiver connects their wallet, signs a specific message, and the SDK derives their view and spend keypairs from the signature. The meta-address (two public keys) is published to the on-chain Registry. This happens once - like setting up a PGP key.

Private keys (view + spend) are stored encrypted on the receiver's device. They never go on-chain or to any server.

### Phase 2: Sender Generates Stealth Address

```
Sender looks up receiver's meta-address from Registry
        │
        ▼
   Meta-Address { view_pub, spend_pub }
        │
        ├── Generate random ephemeral keypair (ephemeral_priv, ephemeral_pub)
        │
        ├── ECDH: shared_secret = ephemeral_priv × view_pub
        │
        ├── hashed = keccak256(shared_secret)
        │
        ├── view_tag = hashed[0]    (first byte - for fast scanning)
        │
        ├── S_H = hash_to_scalar(hashed) × G    (EC scalar multiplication)
        │
        ├── P_stealth = spend_pub + S_H           (EC point addition)
        │
        └── stealth_address = sui_address(P_stealth)
```

The sender does this entirely locally. No communication with the receiver. Each sender generates a unique ephemeral keypair, so each stealth address is different even for the same receiver.

### Phase 3: Send Funds and Announce

```
Single Sui PTB (Programmable Transaction Block):
   ┌──────────────────────────────────────────────────────┐
   │  1. Transfer SUI (amount + gas_buffer) ──▶ stealth_address  │
   │  2. Announcer::announce(                                     │
   │       scheme_id:     1,                                      │
   │       stealth_addr:  stealth_address,                        │
   │       ephemeral_pub: ephemeral_public_key,                   │
   │       metadata:      [view_tag, ...]                         │
   │     )                                                        │
   └──────────────────────────────────────────────────────┘
                          │
                          ▼
                 Emits Announcement event on-chain
```

Both the fund transfer and the announcement happen atomically in one transaction. The sender pays all gas.

### Phase 4: Receiver Scans for Payments

```
Receiver opens dApp (may have been offline for days)
        │
        ▼
   Fetch announcements from Indexer API since last checkpoint
        │
        ▼
   For each announcement:
        │
        ├── Extract view_tag from metadata
        │
        ├── ECDH: shared_secret = view_priv × ephemeral_pub
        │
        ├── computed_tag = keccak256(shared_secret)[0]
        │
        ├── Does computed_tag == announcement.view_tag?
        │         │
        │    NO ──┘  Skip (255/256 probability - saves 3 EC operations)
        │
        │   YES
        │    │
        │    ├── Reconstruct: P_stealth = spend_pub + hash_to_scalar(hash) × G
        │    │
        │    ├── reconstructed_address = sui_address(P_stealth)
        │    │
        │    └── Does reconstructed_address == announcement.stealth_address?
        │              │
        │         NO ──┘  View tag false positive (1/256 chance)
        │
        │        YES ──▶  This payment is for us!
        │                 Store { stealth_address, hashed_shared_secret, amount }
        │
        ▼
   Update last_checkpoint cursor
```

### Phase 5: Receiver Spends from Stealth Address

```
Receiver selects a stealth payment to claim
        │
        ▼
   stealth_private_key = spend_priv + hash_to_scalar(hashed_shared_secret)   (mod n)
        │
        ▼
   Sign spend transaction with stealth_private_key
        │
        ▼
   Transfer SUI from stealth_address to destination
   (gas paid from stealth_address balance or via sponsor)
```

---

## Cryptographic Design

### Curve: secp256k1

The protocol uses the secp256k1 elliptic curve, the same curve used by Bitcoin and Ethereum. This was chosen for EIP-5564 compatibility, broad library support, and alignment with Sui's native `secp256k1` signature scheme.

Curve parameters:

- **Order (n):** `0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141`
- **Generator (G):** Standard secp256k1 base point
- **Key size:** 256 bits (32 bytes private, 33 bytes compressed public)

### Hash Function: Keccak-256

Used for shared secret hashing (as specified by EIP-5564) and for deriving view/spend keys from signature components. Output: 32 bytes.

### Address Derivation: Blake2b-256

Sui addresses are derived as: `Blake2b-256(flag_byte || compressed_public_key)`

Where `flag_byte = 0x01` for secp256k1 keys. Result is a 32-byte address, displayed as `0x` + 64 hex characters.

### View Tag Optimization

The view tag is the first byte of the hashed shared secret. It allows receivers to skip 255/256 (99.6%) of announcements with only a hash comparison, before doing the expensive ECDH and EC point operations. This reduces scanning cost by approximately 6x with a negligible privacy trade-off (security reduced from 128 bits to 124 bits).

### Key Derivation from Signature

The receiver's view and spend keys are derived deterministically from a signed message:

```
signature(message) → 64 bytes → split into r (32 bytes) and s (32 bytes)
keccak256(r) → mod secp256k1.n → view_private_key
keccak256(s) → mod secp256k1.n → spend_private_key
```

This means the keys are fully deterministic - the same wallet signing the same message always produces the same view/spend keys. The receiver only needs their original wallet to recover their stealth keys.

### Mathematical Proof of Correctness

**Sender computes (public key math):**

```
P_stealth = P_spend + hash(ECDH(ephemeral_priv, P_view)) · G
```

**Receiver computes (private key math):**

```
p_stealth = p_spend + hash(ECDH(p_view, P_ephemeral))
```

**Why these match:**

```
ECDH sender:   ephemeral_priv × P_view  = ephemeral_priv × (p_view × G)
ECDH receiver: p_view × P_ephemeral     = p_view × (ephemeral_priv × G)

Both equal: (ephemeral_priv × p_view) × G   (commutativity of scalar multiplication)

Therefore: hash values are identical on both sides

Sender:   P_stealth = P_spend + h·G     (point addition)
Receiver: p_stealth = p_spend + h       (scalar addition)

Verify:   p_stealth × G = (p_spend + h) × G = P_spend + h·G = P_stealth  ✓
```

---

## Smart Contract Design (Sui Move)

### Contract 1: StealthRegistry

**Purpose:** Public directory mapping Sui addresses to stealth meta-addresses.

**Key design decisions:**

- **Shared object:** The Registry is a single shared object that everyone reads from and writes to. This is the simplest approach. For high throughput, it could be sharded by address prefix.
- **No access control on reads:** Anyone can look up anyone's meta-address (it's designed to be public).
- **Sender-only writes:** Only `tx_context::sender()` can register or update their own entry.
- **Key validation:** The contract validates that public keys are 33 bytes (compressed secp256k1 format) but cannot validate that they're actually valid curve points (no on-chain EC math). Invalid keys would simply mean that nobody can send to that user - self-inflicted, not exploitable.

### Contract 2: StealthAnnouncer

**Purpose:** Broadcast announcements as events when funds are sent to stealth addresses.

**Key design decisions:**

- **Events, not stored objects:** Announcements are emitted as events, not stored as objects. Events are cheaper (no storage rent) and are the correct primitive - they're append-only log entries that indexers can subscribe to. This mirrors the Ethereum `ERC5564Announcer` singleton pattern.
- **Two entry points:** `send_to_stealth` bundles the fund transfer and announcement atomically. `announce` is a standalone entry point for cases where the transfer is structured separately in a PTB (useful for splitting coins, sponsored transactions, etc.).
- **No validation on stealth_address:** The contract doesn't verify that the stealth address was correctly derived. It can't - that would require EC point arithmetic. The address is just treated as a destination. If the sender computes it wrong, only the sender loses (funds go to an unspendable address).
- **Metadata format:** Following EIP-5564, the first byte of metadata is the view tag. Additional bytes are optional and can encode transfer details (amount, token type, etc.) for richer indexing.

---

## Off-Chain SDK Design (Rust)

### Module Structure

```
rust-sdk/src/
├── lib.rs          # Module declarations and re-exports
├── types.rs        # Data structures: StealthMetaAddress, Announcement, StealthPayload,
│                   #   ReceiverSecretKeys, StealthKeyPair
├── utils.rs        # keccak256(), to_private_key(), pubkey_to_sui_address(),
│                   #   bytes_to_hex(), hex_to_bytes()
├── keys.rs         # generate_ephemeral_keypair(), derive_keys_from_signature(),
│                   #   derive_stealth_meta_address()
└── stealth.rs      # generate_stealth_address(), check_stealth_address(),
                    #   compute_stealth_private_key(), create_announcement()
```

---

## Indexer Service Design

### Architecture

```
Sui Full Node (WebSocket subscription)
        │
        │  subscribe to Announcement events from StealthAnnouncer package
        ▼
┌───────────────────────┐
│    Event Listener      │  (long-running process)
│    - Connects via WS   │
│    - Filters by event  │
│    - Parses fields     │
│    - Inserts to DB     │
│    - Tracks cursor     │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│    PostgreSQL          │
│                        │
│  announcements table   │
│  sync_state table      │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│    REST API Server     │  (Axum or Actix-web)
│                        │
│  GET /announcements    │
│  GET /health           │
└───────────────────────┘
```

---

## API Design

### Endpoints

#### `GET /api/v1/announcements`

Paginated feed of announcements for client-side scanning.

**Query parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `after_id` | integer | No | Cursor - return announcements with id > this value |
| `limit` | integer | No | Max results per page (default: 100, max: 500) |
| `view_tag` | integer | No | Filter by view tag (0-255) for optimized scanning |
| `since` | integer | No | Unix timestamp (ms) - return announcements after this time |

**Response:**

```json
{
  "announcements": [
    {
      "id": 45024,
      "scheme_id": 1,
      "stealth_address": "0xabc123...",
      "ephemeral_pubkey": "02def456...",
      "view_tag": 127,
      "metadata": "7f",
      "tx_digest": "8Bqr3x...",
      "timestamp": 1712150400000,
      "amount_mist": 2500000000
    }
  ],
  "next_cursor": 45524,
  "has_more": true
}
```

**Privacy note on `view_tag` filter:** When a client filters by view tag, the API server can observe which view tag is being queried. Since a view tag is only 1 byte (256 possible values), many receivers share the same tag, and the same receiver has different tags for different payments. The information leakage is minimal. For maximum privacy, clients should fetch all announcements without the view_tag filter.

#### `GET /api/v1/health`

```json
{
  "status": "ok",
  "last_indexed_timestamp": 1712150400000,
  "total_announcements": 152847,
  "lag_seconds": 2
}
```

### No Authentication

The API requires no authentication, no API keys, and no user accounts. All data served is public blockchain data. Privacy comes from cryptography, not access control.

---

## Frontend dApp Design

### User Flows

#### Flow 1: Setup (Receiver)

```
Connect Wallet → Sign Message → SDK derives keys →
  Store encrypted keys locally → Register meta-address on-chain →
  Show confirmation: "You can now receive stealth payments"
```

#### Flow 2: Send (Sender)

```
Enter recipient Sui address → Fetch meta-address from Registry →
  SDK computes stealth address + ephemeral key + view tag →
  Enter amount → Build PTB (transfer + announce) →
  Wallet signs → Submit to chain →
  Show confirmation: "Sent privately to [address]"
```

#### Flow 3: Receive (Receiver)

```
Open dApp → Fetch announcements since last check →
  SDK scans (view tag filter → ECDH verify) →
  Display matches: "You received X SUI on [date]" →
  User clicks "Claim" → SDK derives stealth private key →
  Enter destination address → Build spend transaction →
  Wallet signs (or gas sponsor) → Submit to chain
```

### Key Security Properties

- View and spend private keys never leave the browser
- No server-side state about users
- The indexer API returns the same data to all callers
- Wallet connection is required only for signing transactions, not for scanning

---

## Data Models

### On-Chain Objects

```
┌─────────────────────────────────────────────────┐
│  Registry (Shared Object)                       │
│                                                  │
│  entries: Table<address, MetaAddress>            │
│    └─ MetaAddress                               │
│         ├─ view_public_key:  vector<u8>  (33B)  │
│         ├─ spend_public_key: vector<u8>  (33B)  │
│         └─ scheme_id:        u64                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Announcement (Event - not stored)              │
│                                                  │
│  ├─ scheme_id:           u64                    │
│  ├─ stealth_address:     address                │
│  ├─ ephemeral_public_key: vector<u8>    (33B)   │
│  └─ metadata:            vector<u8>             │
│       └─ byte[0] = view_tag                     │
└─────────────────────────────────────────────────┘
```

### Off-Chain Data Flow

```
Sender's SDK                    Chain                  Indexer DB              Receiver's SDK

StealthPayload          ──▶    Announcement     ──▶   announcements    ──▶   check_stealth_address()
 ├ stealth_address              Event (log)            table row              ├ ECDH + view tag check
 ├ ephemeral_pubkey                                                           ├ address reconstruction
 └ view_tag                                                                   └ returns Option<hash>
                                                                                       │
                                                                                       ▼
                                                                              compute_stealth_private_key()
                                                                               └ StealthKeyPair
                                                                                  ├ private_key
                                                                                  ├ public_key
                                                                                  └ sui_address
```

---

## Gas and Fee Strategy (TBD)

### Who Pays What

| Operation                     | Who Pays                | Estimated Cost                   |
| ----------------------------- | ----------------------- | -------------------------------- |
| Registry::register()          | Receiver                | ~0.01 SUI (one-time)             |
| Announcer::send_to_stealth()  | Sender                  | ~0.005 SUI gas + transfer amount |
| Scanning (API reads)          | Free                    | No gas (off-chain)               |
| Spending from stealth address | Receiver (from balance) | ~0.005 SUI                       |

### The Stealth Spending Problem

A fresh stealth address only has the SUI that was sent to it. The receiver needs gas to spend from it. Three solutions, in order of recommendation:

**Solution A: Self-funded gas (default)**
The sender sends `amount + gas_buffer` (e.g., 0.01 SUI extra). The receiver's spend transaction uses a PTB to split the coin - part goes to gas, part goes to the destination. Simple, no extra infrastructure.

**Solution B: Sponsored transactions**
Sui natively supports gas sponsorship. A third-party gas station service pays the gas for stealth spend transactions. The receiver signs the transaction content, the sponsor wraps it with gas payment, and both signatures are submitted. The sponsor cannot steal funds - they only pay gas.

**Solution C: Hybrid**
Default to self-funded gas (Solution A). Offer sponsored transactions as a premium feature for better UX (receiver can send 100% of balance).

---

## Privacy Model and Threat Analysis

### What Is Private

- **Receiver identity:** No on-chain observer can determine who received funds at a stealth address. The stealth address has no prior history and no link to the receiver's known addresses.
- **Payment linkability:** Two stealth payments to the same receiver produce different stealth addresses. They cannot be linked to each other without the receiver's view key.
- **Amount privacy:** While the transfer amount is visible on-chain (standard SUI transfer), it cannot be associated with a known receiver.

### What Is NOT Private

- **Sender identity:** The sender's address is visible in the transaction that funds the stealth address. Stealth addresses protect receivers, not senders.
- **Transfer existence:** An observer can see that a transfer occurred and an announcement was emitted. They know "someone sent funds to some stealth address."
- **Timing correlation:** If a sender only interacts with one receiver at a specific time, timing analysis could narrow down the receiver. This is inherent to all stealth address schemes.

---

## Development Roadmap

### Phase 1: Core SDK (Rust)

- [ ] Project setup with dependencies
- [ ] Utility functions (keccak256, to_private_key, Sui address derivation)
- [ ] Key generation and stealth meta-address derivation
- [ ] Stealth address generation (sender side)
- [ ] Announcement scanning and stealth key recovery (receiver side)
- [ ] Integration tests proving sender/receiver address agreement
- [ ] WASM compilation target

### Phase 2: Smart Contracts (Sui Move)

- [ ] StealthRegistry contract
- [ ] StealthAnnouncer contract
- [ ] Unit tests in Move
- [ ] Deploy to Sui testnet
- [ ] Integration test: SDK ↔ contracts

### Phase 3: Indexer Service

- [ ] Event listener (Sui WebSocket subscription)
- [ ] PostgreSQL schema and migrations
- [ ] REST API (announcements endpoint)
- [ ] Cursor-based pagination
- [ ] View tag pre-filtering
- [ ] Deployment

### Phase 4: Frontend dApp

- [ ] Wallet connection (Sui Wallet Kit)
- [ ] Registration flow (setup stealth meta-address)
- [ ] Send flow (lookup + generate + PTB)
- [ ] Receive flow (scan + display + claim)
- [ ] Local encrypted storage for keys and payment history
- [ ] Mobile-responsive design

### Phase 5: Production Hardening

- [ ] Security audit of SDK cryptography
- [ ] Rate limiting and DDoS protection on indexer
- [ ] Monitoring and alerting
- [ ] Documentation and developer guides
- [ ] Mainnet deployment

---

## Technology Stack

| Layer                  | Technology                             | Rationale                                            |
| ---------------------- | -------------------------------------- | ---------------------------------------------------- |
| **Crypto SDK**         | Rust + k256/sha3/blake2                | Memory safety, WASM compilation, fast EC math        |
| **Smart Contracts**    | Sui Move                               | Native Sui contract language, object model, PTBs     |
| **Indexer Runtime**    | Rust (Tokio)                           | Same language as SDK, async event processing         |
| **Indexer API**        | Axum (Rust) or Express (Node.js) (TBD) | Lightweight HTTP server                              |
| **Database**           | PostgreSQL                             | Reliable, indexed queries, BYTEA support for keys    |
| **Frontend**           | React/Next.js + WASM                   | Standard web stack + client-side crypto via WASM     |
| **Wallet Integration** | @mysten/dapp-kit                       | Official Sui wallet adapter                          |
| **Deployment**         | AWS                                    | Containerized indexer + API, static frontend hosting |

## References

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [EIP-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [Sui Move Documentation](https://docs.sui.io/concepts/sui-move-concepts)
- [Sui ecdsa_k1 Module](https://docs.sui.io/references/framework/sui_sui/ecdsa_k1)
- [Sui Cryptography: Hashing](https://docs.sui.io/guides/developer/cryptography/hashing)
- [Sui Signatures and Crypto Agility](https://docs.sui.io/concepts/cryptography/transaction-auth/keys-addresses)
- [k256 Crate (RustCrypto)](https://docs.rs/k256)
- [Vitalik Buterin: An incomplete guide to stealth addresses](https://vitalik.eth.limo/general/2023/01/20/stealth.html)
