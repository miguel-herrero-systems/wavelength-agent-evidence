import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(PROJECT_ROOT, "src", "cli.js");

test("CLI generates, verifies, and independently analyzes the offline demo", async t => {
  const temporary = await mkdtemp(join(tmpdir(), "wavelength-evidence-cli-"));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const outputDirectory = join(temporary, "reports");

  const generated = await runCli("demo", "--out", outputDirectory);
  assert.match(generated.stdout, /Generated 3 report pairs/u);

  const verified = await runCli("verify-demo", "--dir", outputDirectory);
  assert.match(verified.stdout, /Verified 3 demo report pairs/u);

  const reportPath = join(outputDirectory, "completed-lightning.report.json");
  const markdownPath = join(outputDirectory, "completed-lightning.report.md");
  const [reportText, markdown] = await Promise.all([
    readFile(reportPath, "utf8"),
    readFile(markdownPath, "utf8")
  ]);
  const report = JSON.parse(reportText);
  assert.equal(report.economicAction, "NOT_EVALUATED");
  assert.match(markdown, /Synthetic documentation-derived fixture/u);

  const fixturePath = join(PROJECT_ROOT, "fixtures", "completed-lightning.json");
  const directVerify = await runCli(
    "verify",
    "--capture",
    fixturePath,
    "--report",
    reportPath
  );
  assert.match(directVerify.stdout, new RegExp(`Verified ${report.reportId}`, "u"));

  const analyzed = await runCli("analyze", "--capture", fixturePath);
  assert.equal(JSON.parse(analyzed.stdout).reportId, report.reportId);
});

test("CLI verification rejects a tampered report", async t => {
  const temporary = await mkdtemp(join(tmpdir(), "wavelength-evidence-tamper-"));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const outputDirectory = join(temporary, "reports");
  await runCli("demo", "--out", outputDirectory);

  const reportPath = join(outputDirectory, "completed-lightning.report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.economicAction = "REFUND";
  const tamperedPath = join(temporary, "tampered.report.json");
  await writeFile(tamperedPath, `${JSON.stringify(report)}\n`, "utf8");

  const fixturePath = join(PROJECT_ROOT, "fixtures", "completed-lightning.json");
  await assert.rejects(
    runCli("verify", "--capture", fixturePath, "--report", tamperedPath),
    error => {
      assert.match(error.stderr, /report does not match deterministic analysis/u);
      return true;
    }
  );
});

test("CLI normalizes exported records to an owner-only private capture", async t => {
  const temporary = await mkdtemp(join(tmpdir(), "wavelength-evidence-normalize-"));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const preparePath = join(temporary, "prepare.json");
  const activityPath = join(temporary, "activity.json");
  const capturePath = join(temporary, "capture.private.json");
  const rawIntent = "synthetic-private-send-intent";
  const preimage = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const paymentHash = "630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd";
  await writeFile(preparePath, JSON.stringify({
    send_intent_id: rawIntent,
    amount_sat: "2100",
    expected_fee_sat: "4",
    fee_known: true,
    expected_total_outflow_sat: "2104",
    total_outflow_known: true,
    rail: "SEND_RAIL_LIGHTNING",
    quote_status: "QUOTE_STATUS_COMPLETE",
    payment_hash: paymentHash,
    expires_at_unix: "1784640000"
  }));
  await writeFile(activityPath, JSON.stringify({
    id: "activity-cli-normalize",
    status: "COMPLETE",
    kind: "SEND",
    amount_sat: "-2100",
    fee_sat: "4",
    payment_hash: paymentHash,
    preimage,
    settlement: "LIGHTNING"
  }));

  const result = await runCli(
    "normalize",
    "--prepare", preparePath,
    "--activity", activityPath,
    "--resource", "https://agent.example/paid-task",
    "--interaction-id", "cli-normalize",
    "--captured-at", "2026-07-21T14:00:00Z",
    "--network", "signet",
    "--version", "a1094c9f7787d8b91cecc1ee7ae9117e811478d3",
    "--interface", "wavecli",
    "--out", capturePath
  );
  const captureText = await readFile(capturePath, "utf8");
  const capture = JSON.parse(captureText);
  assert.equal(result.stdout.includes(rawIntent), false);
  assert.equal(result.stdout.includes(preimage), false);
  assert.equal(captureText.includes(rawIntent), false);
  assert.equal(capture.terminalActivity.preimage, preimage);
  assert.equal(capture.source.network, "signet");
  if (process.platform !== "win32") {
    assert.equal((await stat(capturePath)).mode & 0o777, 0o600);
  }
});

test("CLI help explicitly states that it performs no economic or network action", async () => {
  const result = await runCli("help");
  const directFlag = await runCli("--help");
  assert.match(result.stdout, /offline, signet-only/u);
  assert.equal(directFlag.stdout, result.stdout);
  assert.match(
    result.stdout,
    /No command invokes Wavelength or performs a network\/economic action\./u
  );
});

test("CLI rejects inputs larger than its one MiB safety bound", async t => {
  const temporary = await mkdtemp(join(tmpdir(), "wavelength-evidence-oversized-"));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const oversizedPath = join(temporary, "oversized.json");
  await writeFile(oversizedPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
  await assert.rejects(
    runCli("analyze", "--capture", oversizedPath),
    error => {
      assert.match(error.stderr, /input exceeds 1048576 bytes/u);
      return true;
    }
  );
});

function runCli(...arguments_) {
  return execFileAsync(process.execPath, [CLI, ...arguments_], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024
  });
}
