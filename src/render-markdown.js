export function renderReportMarkdown(report) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("report must be an object");
  }

  const lines = [
    "# Wavelength evidence report",
    "",
    `Report ${code(report.reportId)} analyzes one captured interaction. It does **not** authorize, retry, refund, or otherwise trigger an economic action.`,
    "",
    report.input.mode === "SYNTHETIC_DOCUMENTATION_FIXTURE"
      ? "> Synthetic documentation-derived fixture: this is a reproducible example, not evidence of a live payment."
      : "> Imported, unattested capture: the source files are untrusted input and the daemon/operator identity is not authenticated.",
    "",
    "## Result",
    "",
    "| Proven | Not proven | Unknown | Economic action |",
    "| ---: | ---: | ---: | --- |",
    `| ${report.summary.proven} | ${report.summary.notProven} | ${report.summary.unknown} | ${inline(report.economicAction)} |`,
    "",
    "## Context",
    "",
    `- Captured at: ${code(report.capturedAt)}`,
    `- Capture ID commitment: ${code(report.input.captureIdCommitment)}`,
    `- Private capture digest: ${code(report.input.captureDigest)}`,
    `- Wavelength: ${code(report.input.sourceVersion)}, ${code(report.input.network)}, ${code(report.input.interface)}`,
    `- Interaction ID commitment: ${code(report.subject.interactionIdCommitment)}`,
    `- Resource origin: ${inline(report.subject.resourceOrigin)}`,
    `- Private resource commitment: ${code(report.subject.resourceCommitment)}`,
    `- Canonical request digest: ${code(report.subject.requestDigest)}`,
    "",
    "## Claims",
    "",
    "| Claim | Status | Reason |",
    "| --- | --- | --- |"
  ];

  for (const claim of report.claims) {
    lines.push(
      `| ${inline(claim.type)} | ${statusLabel(claim.status)} | ${code(claim.reasonCode)} |`
    );
  }

  lines.push("", "## Claim details", "");
  for (const claim of report.claims) {
    lines.push(`### ${inline(claim.type)}`, "");
    lines.push(`Status: **${statusLabel(claim.status)}** — ${code(claim.reasonCode)}.`);
    if (claim.evidence.length > 0) {
      lines.push("", `Evidence fields: ${claim.evidence.map(code).join(", ")}.`);
    }
    if (claim.limitations.length > 0) {
      lines.push("", "Limitations:", "");
      for (const limitation of claim.limitations) lines.push(`- ${inline(limitation)}`);
    }
    lines.push("");
  }

  lines.push(
    "## Disclosure boundary",
    "",
    `${inline(report.publicDisclosure.note)}`,
    "",
    `Omitted by policy: ${report.publicDisclosure.omittedFields.map(inline).join(", ")}.`,
    "",
    `Disclaimer: ${code(report.disclaimerCode)}.`,
    ""
  );
  return lines.join("\n");
}

function statusLabel(status) {
  if (status === "PROVEN") return "PROVEN";
  if (status === "NOT_PROVEN") return "NOT PROVEN";
  return "UNKNOWN";
}

function inline(value) {
  return String(value)
    .replace(/\\/gu, "\\\\")
    .replace(/`/gu, "\\`")
    .replace(/([*_[\]<>|])/gu, "\\$1")
    .replace(/[\r\n]+/gu, " ");
}

function code(value) {
  return `\`${String(value).replace(/`/gu, "\\`").replace(/[\r\n]+/gu, " ")}\``;
}
