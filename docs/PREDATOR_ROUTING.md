# Predator Routing Mitigations

**ISC Phase E5** | This document accompanies the implementation in
`apps/browser/src/social/predatorRouting.ts`

## The Fundamental Tension

Semantic routing enables serendipitous connection — the core value proposition of ISC. It also
enables precision predation. A predator can specify exactly the demographic, psychological, or
situational profile they seek and route directly to it. No other platform makes targeting this
precise.

This is a hard problem. There is no clean solution. The mitigations documented here reduce risk
without eliminating it. We document them honestly.

## Mitigations Implemented

### 1. Minimum Neighborhood TTL (30 minutes)

**Problem**: A predator can create a new identity, route to a target region, and initiate contact
within seconds.

**Mitigation**: Peers must remain in a semantic neighborhood for at least 30 minutes before they can
initiate outbound contact within that region. This does not prevent watching or receiving messages —
only initiating.

**Implementation**: `canContactBeInitiated()` in `predatorRouting.ts`

**Limits**:

- A patient predator will wait
- 30 minutes is arbitrary; evidence should drive this number
- Does not prevent inbound contact (receiving messages from predators)

### 2. Cluster-Level Abuse Quarantine

**Problem**: If a semantic region becomes a hotspot for abuse, the system has no mechanism to reduce
exposure.

**Mitigation**: When ≥5 abuse reports (mute/block events) originate from a single LSH bucket within
24 hours, that bucket is quarantined. New contact initiation to that region is temporarily blocked.

**Implementation**: `quarantineRegion()` and `reportAbuse()` in `predatorRouting.ts`

**Limits**:

- "Unconnected" heuristic is imperfect — peers may have contacted each other outside ISC
- Quarantine is local, not network-wide
- Does not prevent established contacts from continuing
- A sophisticated abuser can spread reports across buckets

### 3. Manipulation Message Classifiers

**Problem**: Predators use consistent psychological manipulation tactics that can be detected
locally without analyzing communication content.

**Mitigation**: Local pattern matching for known manipulation signatures:

- **Urgency escalation**: "act now", "urgent", "don't tell anyone"
- **Isolation tactics**: "don't trust your family", "only I can help you"
- **Financial requests**: wire transfers, gift cards, cryptocurrency
- **Trust exploitation**: impersonating authority figures

**Implementation**: `classifyMessage()` in `predatorRouting.ts`

**Limits**:

- Pattern matching is easily evaded by sophisticated actors
- False positives possible with innocent language ("I urgently need coffee")
- Does not analyze message content — only detects manipulation language
- Flagged messages are not blocked, only flagged to the recipient

## What This Does NOT Solve

1. **Precision targeting**: The routing mechanism itself enables targeting. We cannot hide which
   region a peer has announced to.

2. **Established relationships**: Once contact is established, these mitigations don't apply.

3. **Cross-platform predation**: A predator may use ISC for initial contact, then move to another
   platform.

4. **Sybil attacks**: A predator can create many identities to appear legitimate.

5. **Boredom exploitation**: Preying on loneliness is harder to detect than financial scams.

## Recommendations for Users

1. **Use ephemeral mode** for high-risk interactions (see Phase D1)
2. **Trust your discomfort** — if something feels wrong, it probably is
3. **Report abuse** — helps improve the quarantine system
4. **Use the mute/block controls** — immediate and effective

## Future Research Directions

1. **Network-wide reputation**: Share mute/block signals across peers (privacy vs. safety tradeoff)
2. **Decoy profiles**: System-generated fake profiles that are more attractive to predators
3. **Behavioral analysis**: Beyond message content — timing patterns, response consistency
4. **Institutional partnerships**: Work with platforms that have expertise in abuse detection

## Honest Assessment

These mitigations make ISC less useful for predators while preserving the core discovery experience
for legitimate users. They do not make ISC safe. Any platform that enables stranger-to-stranger
communication carries inherent risk.

The most effective protection against predation is a healthy user community with clear norms, easy
reporting, and rapid response. Build that culture alongside the technical mitigations.
