# ISC Governance Framework

> **Governance of embedding model selection and the semantic coordinate system**

**Version:** 1.0  
**Status:** Draft — Ratify before public community launch  
**Owner:** ISC Maintainer Multisig

---

## Why Governance Matters Here

Most protocol parameters are technical and value-neutral. The embedding model is different. It
defines the geometry of thought-space — which concepts cluster together, which are distant, and
which cannot coexist in any meaningful region. Every ISC user navigates the same shared semantic
map. The choice of model is not a implementation detail; it is an epistemic and political decision.

Whose theory of meaning organizes global thought-routing infrastructure? This question must have a
documented, accountable answer before ISC has a community capable of contesting it.

---

## The Semantic Monoculture Problem

Global interoperability requires shared coordinates. Shared coordinates require a shared embedding
model. A shared model embeds the cultural assumptions of its training data — predominantly
English-language, Western editorial sources.

**Consequences:**

- Concepts from non-Western traditions are sparsely represented or poorly positioned
- Polysemous English terms ("model", "field", "network") receive disproportionate neighborhood
  density
- Multilingual users with smaller models get degraded matching quality
- Domain-specific communities (law, medicine, philosophy) share geometry optimized for general text

**Partial mitigations already implemented:**

- Multilingual embedding support (`multilingual.ts`)
- Configurable embedding model selection (user setting)
- Domain-specific model shards via LSH namespace prefixes (Phase G5)
- Honest documentation of the problem

**This document does not claim to solve the monoculture problem.** It provides a governance process
so the community can address it collectively rather than having decisions imposed by maintainers.

---

## Security Tier Context

Each security tier has different governance implications:

| Tier                     | Model Governance           | Rationale                                         |
| ------------------------ | -------------------------- | ------------------------------------------------- |
| **Tier 0** (Trusted LAN) | Local choice — any model   | No shared DHT; no global coordinate system        |
| **Tier 1** (Federated)   | Community vote per network | Inter-community; needs LSH namespace coordination |
| **Tier 2** (Public)      | Global maintainer multisig | Shared global DHT; highest stakes for monoculture |

All model governance operates on **Tier 2** (public Internet) by default. Tier 0 and 1 deployments
are sovereign.

---

## Model Registry

The model registry at DHT key `/isc/model_registry` is the authoritative list of approved embedding
models for Tier 2 networks.

```typescript
interface ModelRegistryEntry {
  modelId: string; // e.g., "all-MiniLM-L6-v2"
  modelHash: string; // SHA-256 of model output for a fixed test corpus
  lshNamespace: string; // LSH prefix for this model's DHT shard space
  approvedAt: number; // Unix timestamp
  approvedBy: string[]; // Array of maintainer public keys (BIP-39 seed phrase derived)
  rationale: string; // Human-readable justification
  performanceBenchmark: {
    // Pre-tested on a standard corpus
    cosineAccuracy: number; // e.g., 0.94
    multilingualScore: number; // e.g., 0.72
    latencyMs: number; // e.g., 45 (p95 on reference hardware)
  };
  migrationPlan?: {
    gracePeriodDays: number; // Old model announces still accepted
    dualAnnounceRequired: boolean;
  };
}
```

**Merkle root:** The registry is a Merkle tree of `ModelRegistryEntry` objects. The Merkle root is
signed by the maintainer multisig and published at `/isc/model_registry/root`. Peers verify registry
entries against this root before accepting announcements.

---

## RFC Process for Model Changes

### Trigger Conditions

A model change RFC is required when:

1. The current approved model is deprecated (security issue, EOL by provider)
2. A demonstrably better model becomes available (must exceed current benchmark on ≥2 dimensions)
3. A multilingual model is proposed for Tier 2 (requires multilingual benchmark > current)
4. A domain-specific model is proposed for shared Tier 2 namespace

### RFC Stages

**Stage 1 — Proposal (Day 0–7)**

- Any community member opens a GitHub Issue titled `[RFC] Model: <model-name>`
- Must include: model name, benchmark results on standard corpus, rationale, LSH namespace proposal
- Maintainers label `rfc/model-change`
- 7-day open comment period

**Stage 2 — Review (Day 7–14)**

- Maintainers publish a structured assessment: performance vs. current, multilingual coverage,
  monoculture impact
- Community discussion on the GitHub Issue
- Stakeholder feedback from multilingual and domain-specific user communities required before
  advancing

**Stage 3 — Decision (Day 14)**

- Maintainers vote (multisig — see below)
- Outcome: `approved`, `rejected`, or `deferred` (requires additional data)
- Decision posted as a comment on the RFC issue with full rationale

**Stage 4 — Implementation (Day 14–30)**

- If approved: update model registry, publish migration plan, announce via all channels
- Dual-announce period: old and new models coexist in DHT for `gracePeriodDays`
- Clients auto-migrate on next startup after grace period

### Emergency Override

If a model has a critical security flaw (e.g., embedding extraction attack), the maintainer multisig
can issue an immediate deprecation with no RFC period. This must be communicated within 24 hours
with a written post-mortem.

---

## Maintainer Multisig

### Composition

5 maintainers with equal weight. Any 3-of-5 signatures required to update the model registry.

Initial maintainers: identified by BIP-39 seed phrases. Each maintainer generates their signing key
from their seed offline. Seed phrases are stored in separate geographic locations with independent
custody.

### Operations Requiring Multisig

- Adding a model to the Tier 2 registry
- Removing a model from the Tier 2 registry
- Updating the model registry Merkle root
- Emergency model deprecation
- Adding or removing a maintainer (requires 4-of-5)

### Operations NOT Requiring Multisig

- Updating documentation (including this document)
- Non-registry protocol changes (those follow a separate process)
- Community tooling and client features

### Accountability

- All multisig transactions are published to the DHT at `/isc/multisig/log`
- Each entry: `{ operation, signers[], timestamp, merklePath }`
- Anyone can verify the log against the published Merkle root
- Quarterly public report: model registry activity, new proposals, decisions

---

## LSH Namespace Prefix Assignment

Every model in the registry receives a unique LSH namespace prefix. This ensures that peers using
different models publish to non-overlapping DHT key spaces — they cannot interfere with each other.

**Prefix assignment rules:**

- Prefixes are assigned sequentially: `abc123`, `def456`, ...
- Prefixes are tied to the model hash, not the model name (so a model re-release with the same
  weights keeps the same prefix)
- Unused prefixes older than 18 months are reclaimed
- A peer announcing with a non-registry model prefix is dropped by Tier 2 peers

---

## Breaking Changes to the Protocol

Protocol changes that affect wire format or DHT key schema follow the same RFC process but with a
longer review period (30 days instead of 14) and backward compatibility requirement: **old clients
must be able to participate in the network during the migration window**.

---

## Community Representation

Maintainers commit to:

- Actively soliciting feedback from non-English-speaking communities before model decisions
- Publishing model benchmarks that include multilingual and non-Western corpus coverage
- Providing a public feedback channel (e.g., forum, mailing list) accessible without an ISC account
- Annual review of whether the model registry reflects the community's needs

---

## Dispute Resolution

If a community member believes a model decision was made incorrectly:

1. File an issue on the governance repository
2. If 50 community members agree (thumbs-up in 30 days), the issue escalates to a full RFC
3. The maintainer multisig must respond with a written decision within 14 days

Maintainers cannot veto an escalation. They can only vote on implementation.

---

## Relationship to Other Documents

- [PROTOCOL.md](PROTOCOL.md) — technical protocol specification
- [SECURITY.md](SECURITY.md) — cryptographic guarantees and threat model
- [SEMANTIC.md](SEMANTIC.md) — embedding model technical details
- [PHILOSOPHY.md](docs/PHILOSOPHY.md) — epistemic foundations of semantic routing
