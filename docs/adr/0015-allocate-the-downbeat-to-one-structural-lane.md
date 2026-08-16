# Allocate the downbeat to one structural lane

Every Role Lane used to attack on beat zero. Measured across a full matrix, 90%
of all moments where three or more roles struck together were that single beat;
away from it the lanes were already separated, with nine in ten grid positions
carrying one lane alone. Orchestration now ranks the included lanes — Drone,
Bass, Pad, Arp Source, Lead — and only the most structural of them may sound
on the downbeat. The rest enter behind it after a short deterministic delay that
widens with Space.

We rejected a shared rhythmic frame coordinating the whole Scene Cycle. The
measurements gave it nothing to fix, and a common onset grid would work against
the floating, non-aligned interior the music depends on.

## Consequences

- Ownership is permission, not obligation. ADR 0012 lets Bass and Lead delay,
  bookend, or tail-pick an entrance, so an owner may decline the downbeat. What
  allocation guarantees is only that no other lane takes it.
- Ranking runs over the included lanes, so a Pad-only matrix still opens on its
  Pad rather than waiting for a Drone that is not there.
- The Arp Source sits outside the scheme entirely (ADR 0017). Allocation exists
  to stop several roles striking audibly at once, and an Arp Source's onsets are
  not heard directly, so delaying it only opens a hole at the top of the clip.
- The choice is made once during Orchestration, before any lane renders, so
  lanes still never read one another and ADR 0004 holds.
