# Model the matrix while rendering one Role Lane first

**Status:** Superseded by [ADR 0004](./0004-generate-the-role-matrix-as-one-unit.md)

The product domain remains an Ambient Session matrix, but the next delivery milestone renders one selected Role Lane across Foundation, Development, Tension, and Release. We chose this vertical slice to tune evolving voicings and role behavior before adding multi-track orchestration, while retaining a Composition Plan capable of coordinating the future matrix.

## Consequences

The core generator must not collapse into four unrelated clip calls or a role-specific algorithm. It produces the shared plan and four related Scene paths first, then renders the selected role; separately generated tracks are not promised to belong to the same Ambient Session until matrix generation is implemented.
