const { lstatSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function validateRequest({ pr, number, expectedHead, repo }) {
  if (!/^[1-9]\d*$/.test(number) || !/^[a-f0-9]{40}$/.test(expectedHead)) {
    throw new Error("Provide a PR number and its exact 40-character head SHA");
  }
  if (
    String(pr.number) !== number ||
    pr.state !== "open" ||
    pr.base.repo.full_name !== repo ||
    pr.head.sha !== expectedHead ||
    !pr.head.repo
  ) {
    throw new Error(
      "PR is closed, belongs to another repository, or its head has changed",
    );
  }
  return {
    pr: number,
    base: pr.base.sha,
    head: pr.head.sha,
    head_repo: pr.head.repo.full_name,
  };
}

async function resolveRequest({ github, context, core }) {
  for (const username of new Set([context.actor, process.env.RERUN_ACTOR])) {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username,
    });
    if (!["admin", "maintain", "write"].includes(data.permission)) {
      throw new Error("Only repository writers can request screenshot runs");
    }
  }
  const number = process.env.PR_NUMBER;
  if (!/^[1-9]\d*$/.test(number)) throw new Error("Invalid PR number");
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: Number(number),
  });
  const request = validateRequest({
    pr,
    number,
    expectedHead: process.env.EXPECTED_HEAD,
    repo: `${context.repo.owner}/${context.repo.repo}`,
  });
  for (const [key, value] of Object.entries(request))
    core.setOutput(key, value);
}

function readRegularFile({ directory, name, maxBytes }) {
  const filename = resolve(directory, name);
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.size === 0 || stat.size > maxBytes) {
    throw new Error(`Invalid evidence file: ${name}`);
  }
  return readFileSync(filename);
}

function validateText(value) {
  if (typeof value !== "string" || value.length > 4000) {
    throw new Error("Report text must be a string of at most 4000 characters");
  }
}

function validateEvidence(directory) {
  const report = JSON.parse(
    readRegularFile({ directory, name: "report.json", maxBytes: 65536 }),
  );
  if (!report || typeof report !== "object") throw new Error("Invalid report");
  validateText(report.summary);
  validateText(report.limitations);
  if (
    !Array.isArray(report.pairs) ||
    report.pairs.length < 1 ||
    report.pairs.length > 8
  ) {
    throw new Error("Report must contain 1–8 before/after pairs");
  }
  for (const pair of report.pairs) {
    if (!pair || typeof pair !== "object")
      throw new Error("Invalid screenshot pair");
    validateText(pair.title);
    validateText(pair.description);
    if (pair.before === pair.after)
      throw new Error("Before and after must be different files");
    for (const name of [pair.before, pair.after]) {
      if (
        typeof name !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,79}\.png$/.test(name)
      ) {
        throw new Error("Evidence filenames must be lowercase PNG basenames");
      }
      const bytes = readRegularFile({
        directory,
        name,
        maxBytes: 10 * 1024 * 1024,
      });
      if (
        !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      ) {
        throw new Error(`Not a PNG: ${name}`);
      }
    }
  }
  return report;
}

function markdownText(value) {
  return value
    .replace(/[\r\n\u0000-\u001f]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+!|~-]/g, "\\$&")
    .replace(/@/g, "&#64;");
}

async function publishEvidence({ github, context }) {
  if (!process.env.ARTIFACT_URL)
    throw new Error("Screenshot artifact URL is missing");
  const directory = resolve(".scratch/pr-screenshots/evidence");
  const report = validateEvidence(directory);
  const number = process.env.PR_NUMBER;
  const repo = `${context.repo.owner}/${context.repo.repo}`;
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: Number(number),
  });
  validateRequest({ pr, number, expectedHead: process.env.HEAD_SHA, repo });
  const runUrl = `${context.serverUrl}/${repo}/actions/runs/${context.runId}`;
  const lines = [
    "<!-- remote-pr-screenshots -->",
    `### PR screenshots · ${markdownText(process.env.NATIVE_PLATFORM)}`,
    "",
    `Base: \`${process.env.BASE_SHA}\` · Head: \`${process.env.HEAD_SHA}\` · [Workflow run](${runUrl})`,
    "",
    markdownText(report.summary),
    "",
    `[Download before/after screenshots](${process.env.ARTIFACT_URL}) (GitHub sign-in required; retained for 14 days).`,
    "",
  ];
  for (const pair of report.pairs) {
    lines.push(
      `**${markdownText(pair.title)}**`,
      "",
      markdownText(pair.description),
      "",
      "| Before | After |",
      "| --- | --- |",
      `| \`${pair.before}\` | \`${pair.after}\` |`,
      "",
    );
  }
  if (report.limitations)
    lines.push(`Limitations: ${markdownText(report.limitations)}`, "");
  await github.rest.issues.createComment({
    ...context.repo,
    issue_number: Number(number),
    body: lines.join("\n"),
  });
}

module.exports = {
  validateRequest,
  resolveRequest,
  validateEvidence,
  markdownText,
  publishEvidence,
};
