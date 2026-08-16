# Separate device repositories from the brand site

Serein Devices is a product family and public catalog, not a shared software runtime. Each device will live in its own repository, beginning with **Serein Devices 001 — Isobare**, while `serein-devices.alex-boulanger.dev` will be an independent static Astro site deployed to Cloudflare Workers. We chose separate repositories instead of turning Isobare into a multi-product monorepo because future devices may target unrelated platforms such as Ableton Extensions and Max for Live, need independent release histories, and do not yet share product code.

## Consequences

Each device owns its versioning, documentation, issues, and downloadable artifacts. Isobare is distributed through its GitHub Releases as a packaged `.ablx` application, and the brand site links to the latest stable release rather than building or hosting the extension itself. The gitignored Ableton SDK archives and documentation are never published; releases are built locally until the SDK can be supplied safely to CI.

The Astro site can deploy independently when portfolio content changes, without installing any device toolchain. A monorepo may be reconsidered only after multiple devices demonstrate a real shared library or release-pipeline boundary.
