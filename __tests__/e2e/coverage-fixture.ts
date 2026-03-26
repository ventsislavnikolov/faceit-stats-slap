import * as fs from "node:fs";
import * as path from "node:path";
import { test as base } from "@playwright/test";

type CoverageFixture = {
  coverage: undefined;
};

export const test = base.extend<CoverageFixture>({
  coverage: [
    async ({ page, browserName }, use) => {
      // Coverage API is only supported on Chromium-based browsers
      if (browserName !== "chromium") {
        await use(undefined);
        return;
      }

      // Create coverage directory if it doesn't exist
      const coverageDir = path.join(process.cwd(), "coverage", "e2e");
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }

      // Start JS and CSS coverage
      await page.coverage.startJSCoverage({
        resetOnNavigation: false,
        reportAnonymousScripts: true,
      });
      await page.coverage.startCSSCoverage({
        resetOnNavigation: false,
      });

      // Yield to allow the test to run
      await use(undefined);

      // Stop coverage and save results
      const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage(),
      ]);

      // Generate unique filename based on test info
      const timestamp = Date.now();
      const testName = test
        .info()
        .title.replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
      const outputFile = path.join(
        coverageDir,
        `coverage-${testName}-${timestamp}.json`
      );

      // Save coverage data
      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          {
            js: jsCoverage,
            css: cssCoverage,
            timestamp,
            testTitle: test.info().title,
            testFile: test.info().file,
          },
          null,
          2
        )
      );
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
