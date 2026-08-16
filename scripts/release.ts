#!/usr/bin/env bun
/**
 * Cuts a release of Isobare.
 *
 * Runs locally on purpose: per ADR 0011 the Ableton SDK archives are gitignored
 * and never published, so CI cannot build the `.ablx`. This script is the only
 * place a version number is written, and the CHANGELOG entry it extracts becomes
 * the GitHub Release body — which the Serein Devices site then reads straight
 * from the Releases API. Write the notes once, publish them everywhere.
 *
 *   bun run release 0.1.0
 *   bun run release 0.1.0 --dry-run
 *
 * Set SEREIN_SITE_REPO=owner/name to have the site rebuilt on publish.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const REPO = "alex-boulanger/serein-devices-isobare";
const PRODUCT = "Isobare";
const RELEASE_BRANCH = "main";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((argument) => !argument.startsWith("--"));

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  if (version === undefined || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Usage: bun run release <major.minor.patch> [--dry-run]");
  }
  const tag = `v${version}`;

  step("Checking the working tree");
  assertCleanTree();
  assertBranch(RELEASE_BRANCH);
  assertTagIsFree(tag);

  step("Reading the changelog entry");
  const notes = changelogEntry(readFileSync("CHANGELOG.md", "utf8"), version);
  console.log(indent(notes));

  step("Running checks");
  run("bun", ["run", "check"]);
  run("bun", ["test"]);

  step(`Setting the version to ${version}`);
  const restorers = [
    writeVersion("package.json", version),
    writeVersion("manifest.json", version),
  ];
  const restoreVersions = () => {
    for (const restore of restorers) restore();
  };

  step("Packaging the extension");
  let asset: string;
  try {
    removeStaleArtifacts();
    run("bun", ["run", "package"]);
    asset = renameAsset(version);
  } catch (error) {
    // Nothing has been committed yet, so leave the tree as we found it.
    restoreVersions();
    throw error;
  }

  if (dryRun) {
    restoreVersions();
    console.log(`\n✓ Dry run complete. Built ${asset}; nothing was pushed.`);
    console.log("  package.json and manifest.json have been restored.");
    return;
  }

  step("Tagging and pushing");
  run("git", ["add", "package.json", "manifest.json"]);
  run("git", ["commit", "-m", `chore: release ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", tag]);
  run("git", ["push", "--follow-tags"]);

  step("Publishing the GitHub release");
  const notesFile = `.release-notes-${version}.md`;
  writeFileSync(notesFile, notes, "utf8");
  try {
    run("gh", [
      "release", "create", tag,
      "--repo", REPO,
      "--title", `${PRODUCT} ${version}`,
      "--notes-file", notesFile,
      asset,
      `${PRODUCT}.ablx`,
    ]);
  } finally {
    run("rm", ["-f", notesFile], { allowFailure: true });
  }

  step("Refreshing the site");
  triggerSiteRebuild(tag);

  console.log(`\n✓ ${PRODUCT} ${version} published`);
  console.log(`  https://github.com/${REPO}/releases/tag/${tag}`);
}

/** The `## [version]` section, without its heading. */
export function changelogEntry(changelog: string, target: string): string {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) =>
    line.startsWith(`## [${target}]`) || line.startsWith(`## ${target}`),
  );
  if (start < 0) {
    throw new Error(
      `CHANGELOG.md has no "## [${target}]" section. Add the entry before releasing.`,
    );
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const section = end < 0 ? rest : rest.slice(0, end);
  const body = withoutTrailingLinkDefinitions(section).join("\n").trim();

  if (body.length === 0) {
    throw new Error(`The "## [${target}]" section is empty.`);
  }
  return body;
}

/**
 * The last section runs to the end of the file, where Keep a Changelog puts its
 * `[1.0.0]: https://…` reference definitions. Those belong to the document, not
 * to the release body.
 */
function withoutTrailingLinkDefinitions(section: readonly string[]): string[] {
  const lines = [...section];
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!.trim();
    if (last.length === 0 || /^\[[^\]]+\]:\s*\S+$/.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines;
}

/** Writes the version and returns an undo that restores the file byte for byte. */
export function writeVersion(file: string, next: string): () => void {
  const source = readFileSync(file, "utf8");
  const parsed = JSON.parse(source) as Record<string, unknown>;
  if (parsed.version === undefined) {
    throw new Error(`${file} has no "version" field.`);
  }
  parsed.version = next;
  writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`  ${file} → ${next}`);
  return () => writeFileSync(file, source, "utf8");
}

/** Old artifacts are gitignored, so they linger in the root until cleared. */
function removeStaleArtifacts(): void {
  const stale = readdirSync(".").filter((name) => name.endsWith(".ablx"));
  for (const name of stale) rmSync(name);
  if (stale.length > 0) {
    console.log(`  Cleared ${stale.length} previous artifact(s)`);
  }
}

/**
 * The packager names the artifact from the manifest's display name, which turns
 * "Serein Devices - Isobare" into "Serein-Devices---Isobare". Publish it under a
 * clean name instead, plus a constant-named copy so
 * `releases/latest/download/Isobare.ablx` always resolves to the newest build.
 */
function renameAsset(target: string): string {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { name: string };
  const built = builtAssetName(manifest.name, target);
  const versioned = `${PRODUCT}-${target}.ablx`;

  copyFileSync(built, versioned);
  copyFileSync(built, `${PRODUCT}.ablx`);
  console.log(`  ${built} → ${versioned} (+ ${PRODUCT}.ablx)`);
  return versioned;
}

/** Mirrors how the packager derives a filename from the manifest display name. */
export function builtAssetName(manifestName: string, target: string): string {
  return `${manifestName.replace(/[^A-Za-z0-9]/g, "-")}-${target}.ablx`;
}

function triggerSiteRebuild(tag: string): void {
  const siteRepo = process.env.SEREIN_SITE_REPO;
  if (siteRepo === undefined || siteRepo.length === 0) {
    console.log("  SEREIN_SITE_REPO is not set — skipping. The site will show");
    console.log("  this release after its next build.");
    return;
  }
  run("gh", [
    "api", `repos/${siteRepo}/dispatches`,
    "-f", "event_type=isobare-release",
    "-f", `client_payload[tag]=${tag}`,
  ], { allowFailure: true });
  console.log(`  Asked ${siteRepo} to rebuild`);
}

function assertCleanTree(): void {
  const status = capture("git", ["status", "--porcelain"]);
  if (status.length > 0) {
    throw new Error(
      `The working tree has uncommitted changes:\n${indent(status)}\n` +
      "Commit or stash them before releasing.",
    );
  }
}

function assertBranch(expected: string): void {
  const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== expected) {
    throw new Error(`Releases are cut from ${expected}, but HEAD is on ${branch}.`);
  }
}

function assertTagIsFree(tag: string): void {
  if (capture("git", ["tag", "--list", tag]).length > 0) {
    throw new Error(`Tag ${tag} already exists.`);
  }
}

function run(
  command: string,
  commandArgs: readonly string[],
  options: { allowFailure?: boolean } = {},
): void {
  const result = spawnSync(command, [...commandArgs], { stdio: "inherit" });
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed.`);
  }
}

function capture(command: string, commandArgs: readonly string[]): string {
  const result = spawnSync(command, [...commandArgs], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed.`);
  }
  return result.stdout.trim();
}

function step(label: string): void {
  console.log(`\n▸ ${label}`);
}

function indent(text: string): string {
  return text.split("\n").map((line) => `    ${line}`).join("\n");
}
