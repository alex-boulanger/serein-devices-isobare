# Contributing

## Development

Requires Bun 1.3+, Node.js 24+, an Extensions-enabled Ableton Live beta, and the
Ableton Extensions SDK obtained directly from Ableton. Keep the SDK uncommitted
at this path:

```text
extensions-sdk-1.0.0-beta.1/
├── ableton-extensions-cli-1.0.0-beta.1.tgz
└── ableton-extensions-sdk-1.0.0-beta.1.tgz
```

```sh
bun install
bun test
bun run start
```

`bun run start` requires Developer Mode in Live. Developer Mode stops Live's
built-in Extension Host, so turn it off and restart Live when testing an
installed `.ablx`.

Run `bun run check`, `bun test`, and `bun run build` before submitting changes.

## Package and release

```sh
bun run package
bun run release X.Y.Z --dry-run
bun run release X.Y.Z
```

Packaging creates `Isobare-<version>.ablx`. Releases are built locally because
the separately licensed SDK archives are not published; see
[ADR 0011](docs/adr/0011-separate-device-repositories-from-the-brand-site.md).

Before releasing, add a non-empty version entry to [CHANGELOG.md](CHANGELOG.md).
The release command requires a clean `main`, runs checks and tests, updates
`package.json` and `manifest.json`, commits and tags the version, pushes it, and
publishes both `Isobare-<version>.ablx` and the stable `Isobare.ablx` alias.

Set `SEREIN_SITE_REPO=owner/name` to request a website rebuild after publishing.
