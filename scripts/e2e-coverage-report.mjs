#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import v8toIstanbul from "v8-to-istanbul";

function shouldEnforceThresholds() {
  const rawValue = process.env.E2E_COVERAGE_ENFORCE_THRESHOLDS;

  if (typeof rawValue !== "string") {
    return true;
  }

  return rawValue.trim().toLowerCase() !== "false";
}

function toReportSafePath(rawPath) {
  if (!(typeof rawPath === "string" && rawPath.length > 0)) {
    return path.join(process.cwd(), ".coverage-virtual", "unknown-file.js");
  }

  const hasUrlFragment =
    /^https?:/i.test(rawPath) ||
    rawPath.includes("http:") ||
    rawPath.includes("https:") ||
    rawPath.includes("localhost:3000");

  if (!hasUrlFragment && path.isAbsolute(rawPath)) {
    return rawPath;
  }

  const withoutProtocol = rawPath.replace(/^https?:[\\/]{0,2}/i, "");
  const sanitized = withoutProtocol
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return path.join(process.cwd(), ".coverage-virtual", sanitized);
}

async function generateCoverageReport() {
  const coverageDir = path.join(process.cwd(), "coverage", "e2e");
  const outputDir = path.join(process.cwd(), "coverage", "e2e-report");

  if (!fs.existsSync(coverageDir)) {
    console.error("No coverage data found. Run tests with coverage first.");
    process.exit(1);
  }

  const coverageFiles = fs
    .readdirSync(coverageDir)
    .filter((file) => file.startsWith("coverage-") && file.endsWith(".json"));

  if (coverageFiles.length === 0) {
    console.error("No coverage files found in coverage/e2e directory.");
    process.exit(1);
  }

  console.log(`[coverage] Found ${coverageFiles.length} coverage files`);

  const coverageMap = libCoverage.createCoverageMap();
  const baseUrl = "http://localhost:3000";

  for (const file of coverageFiles) {
    const filePath = path.join(coverageDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    console.log(`  Processing: ${data.testTitle || file}`);

    for (const entry of data.js || []) {
      if (
        !(entry.url.startsWith(baseUrl) || entry.url.includes("localhost:3000"))
      ) {
        continue;
      }

      if (
        entry.url.includes("node_modules") ||
        entry.url.includes("@vite") ||
        entry.url.includes("@react-refresh")
      ) {
        continue;
      }

      try {
        const converter = v8toIstanbul(
          entry.url,
          0,
          { source: entry.source },
          (resolvedPath) => resolvedPath.includes("node_modules")
        );
        await converter.load();

        if (entry.functions) {
          converter.applyCoverage(entry.functions);
        }

        const istanbulCoverage = converter.toIstanbul();
        const normalizedCoverage = {};

        for (const [coveragePath, coverageData] of Object.entries(
          istanbulCoverage
        )) {
          const reportSafePath = toReportSafePath(coveragePath);
          normalizedCoverage[reportSafePath] = {
            ...coverageData,
            path: reportSafePath,
          };
        }

        coverageMap.merge(normalizedCoverage);
      } catch (_error) {
        console.warn(`  [warn] Could not process: ${entry.url}`);
      }
    }
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const context = libReport.createContext({
    dir: outputDir,
    coverageMap,
  });

  const reportTypes = ["html", "text", "text-summary", "json-summary"];

  for (const reportType of reportTypes) {
    const report = reports.create(reportType, {});
    report.execute(context);
  }

  console.log("Coverage report generated successfully.");
  console.log(`HTML report: ${path.join(outputDir, "index.html")}`);

  const summaryFile = path.join(outputDir, "coverage-summary.json");
  if (fs.existsSync(summaryFile)) {
    const summary = JSON.parse(fs.readFileSync(summaryFile, "utf-8"));
    const total = summary.total;

    console.log("\nCoverage Summary:");
    console.log(`  Lines:      ${total.lines.pct.toFixed(2)}%`);
    console.log(`  Statements: ${total.statements.pct.toFixed(2)}%`);
    console.log(`  Functions:  ${total.functions.pct.toFixed(2)}%`);
    console.log(`  Branches:   ${total.branches.pct.toFixed(2)}%`);

    const thresholds = {
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 70,
    };

    let hasFailures = false;
    for (const [metric, threshold] of Object.entries(thresholds)) {
      const actual = total[metric].pct;
      if (actual < threshold) {
        console.log(
          `  [warn] ${metric} coverage (${actual.toFixed(2)}%) is below threshold (${threshold}%)`
        );
        hasFailures = true;
      }
    }

    if (hasFailures && process.env.CI && shouldEnforceThresholds()) {
      console.error("\nCoverage thresholds not met.");
      process.exit(1);
    }
  }
}

generateCoverageReport().catch((error) => {
  console.error("Error generating coverage report:", error);
  process.exit(1);
});
