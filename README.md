# Serein Devices - Isobare

Ambient MIDI Harmonizer for Ableton Live Extension SDK

Licensed under the [Apache License 2.0](LICENSE). Forks are welcome; the Serein
Devices and Isobare names are not licensed with the code. See [NOTICE](NOTICE)
for how the Ableton Extensions SDK is licensed separately.

## Develop

Requires Bun 1.3+, Node.js 24+, and an Extensions-enabled Ableton Live beta
with Developer Mode enabled.

The SDK release is intentionally gitignored. Put it at this exact path before
installing:

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

`bun run start` requires **Developer Mode** in Live's Extensions settings. To
test an installed `.ablx` instead, stop the development command, turn Developer
Mode **off**, and restart Live. While Developer Mode is enabled, Live leaves its
built-in Extension Host stopped and installed extensions are not activated.

In Live's Session View, right-click an **empty MIDI clip slot** (not an existing
clip) and choose **Generate…**. The slot is the upper-left corner of the result.
Choose which consecutive MIDI tracks to include, assign a Musical Role and
available Style to each, then generate four related eight-bar Scene rows. Each
dialog starts with a fresh seed, which can also be randomized manually. The first
non-MIDI track ends the block. Occupied cells require explicit overwrite consent;
the complete matrix is one undo step.

Set Live's Global Quantization to **8 Bars** before performing. Every generated
clip is exactly 8 bars, so Scene launches land on cycle boundaries and the matrix
stays in sync. Live exposes no API for this, so it has to be set by hand.

## Build the extension

```sh
bun run package
```

The packager names the artifact from the manifest's display name, so this creates
`Serein-Devices---Isobare-<version>.ablx` in the project root. Releases publish it
under the cleaner name `Isobare-<version>.ablx`.

## Cut a release

```sh
bun run release 0.1.0            # or --dry-run to rehearse it
```

Releases are built locally by design: per [ADR 0011](docs/adr/0011-separate-device-repositories-from-the-brand-site.md)
the SDK archives are gitignored and never published, so CI cannot produce the
`.ablx`.

Add the version's entry to [CHANGELOG.md](CHANGELOG.md) first — the script
refuses to release without one. From there everything is derived:

1. Verifies a clean tree on `main`, an unused tag, and passing checks and tests
2. Writes the version into `package.json` and `manifest.json`
3. Packages the `.ablx` and renames it to `Isobare-<version>.ablx`
4. Commits, tags `v<version>`, and pushes
5. Creates the GitHub Release with the changelog entry as its body, attaching
   both the versioned asset and a constant-named `Isobare.ablx`
6. Asks the site repo to rebuild, if `SEREIN_SITE_REPO=owner/name` is set

The changelog entry is written once and is never copied by hand: it becomes the
release body, and the site reads that body straight from the Releases API.

### Consuming a release from the site

The repository is public, so the Releases API needs no token:

```ts
const release = await fetch(
  "https://api.github.com/repos/alex-boulanger/serein-devices-isobare/releases/latest",
  { headers: { Accept: "application/vnd.github+json" } },
).then((response) => response.json());

release.tag_name; // "v0.1.0"
release.body; // the changelog entry, as markdown
release.published_at; // ISO date
release.assets[0].browser_download_url; // the .ablx
```

Fetch it at build time and render `body` as markdown. A rebuild is triggered on
publish, so the page stays current. If a rebuild is ever missed, this permalink
always resolves to the newest build:

```text
https://github.com/alex-boulanger/serein-devices-isobare/releases/latest/download/Isobare.ablx
```
