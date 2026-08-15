# Generate the matrix from a shared Composition Plan

An Ambient Session is generated from one deterministic Composition Plan, then orchestrated across Scenes and Musical Roles before its individual Role Parts are rendered. We rejected generating clips independently—even with a shared scale or seed—because scale membership does not provide enough shared identity, compatible transitions, or control over register and density when roles are mixed or muted.

## Consequences

The engine must model the shared composition before writing any MIDI, and variations must preserve or deliberately revise that plan. Role renderers may control rhythm and articulation but cannot independently redefine the harmony; matrix generation coordinates all requested lanes before rendering them.
