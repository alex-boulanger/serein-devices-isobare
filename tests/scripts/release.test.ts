import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { builtAssetName, changelogEntry, writeVersion } from "../../scripts/release";

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-01

### Added

- A second thing.

## [0.1.0] - 2026-08-16

### Added

- The first thing.

[0.1.0]: https://example.invalid
`;

describe("changelogEntry", () => {
  it("returns one version's section without its heading", () => {
    expect(changelogEntry(CHANGELOG, "0.2.0")).toBe("### Added\n\n- A second thing.");
  });

  it("stops at the next version rather than swallowing the rest", () => {
    expect(changelogEntry(CHANGELOG, "0.1.0")).not.toContain("A second thing");
  });

  it("keeps the link definitions out of the release body", () => {
    expect(changelogEntry(CHANGELOG, "0.1.0")).toBe("### Added\n\n- The first thing.");
  });

  it("refuses a version with no entry, so a release cannot ship blank notes", () => {
    expect(() => changelogEntry(CHANGELOG, "9.9.9")).toThrow('no "## [9.9.9]" section');
  });

  it("refuses an entry that exists but is empty", () => {
    expect(() => changelogEntry("## [0.3.0]\n\n## [0.2.0]\n\n- real\n", "0.3.0"))
      .toThrow("is empty");
  });
});

describe("builtAssetName", () => {
  it("mirrors how the packager mangles the manifest display name", () => {
    // "Serein Devices - Isobare" collapses " - " into three hyphens, which is
    // why releases republish the artifact under a clean name.
    expect(builtAssetName("Serein Devices - Isobare", "0.1.0"))
      .toBe("Serein-Devices---Isobare-0.1.0.ablx");
  });
});

describe("writeVersion", () => {
  const withTempFile = (contents: string, run: (path: string) => void): void => {
    const directory = mkdtempSync(join(tmpdir(), "isobare-release-"));
    const path = join(directory, "package.json");
    writeFileSync(path, contents, "utf8");
    try {
      run(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it("writes the new version", () => {
    withTempFile(`{\n  "name": "x",\n  "version": "0.0.1"\n}\n`, (path) => {
      writeVersion(path, "0.1.0");
      expect(JSON.parse(readFileSync(path, "utf8")).version).toBe("0.1.0");
    });
  });

  it("restores the file byte for byte, so a dry run leaves no trace", () => {
    // Deliberately unusual formatting: the undo must not reformat it.
    const original = `{\n    "name": "x",\n    "version": "0.0.1",\n    "keep": [1,2]\n}\n`;
    withTempFile(original, (path) => {
      const restore = writeVersion(path, "9.9.9");
      expect(readFileSync(path, "utf8")).not.toBe(original);

      restore();
      expect(readFileSync(path, "utf8")).toBe(original);
    });
  });

  it("refuses a file with no version field", () => {
    withTempFile(`{"name":"x"}`, (path) => {
      expect(() => writeVersion(path, "0.1.0")).toThrow('no "version" field');
    });
  });
});

describe("the repository's own changelog", () => {
  it("yields a release body with no document plumbing in it", () => {
    const body = changelogEntry(readFileSync("CHANGELOG.md", "utf8"), "0.1.0");

    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain("[Unreleased]:");
    expect(body).not.toMatch(/^\[[^\]]+\]:\s*\S+$/m);
  });

  it("keeps package.json and manifest.json on the same version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { version: string };

    expect(pkg.version).toBe(manifest.version);
  });
});
