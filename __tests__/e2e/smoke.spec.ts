import { expect, test } from "./coverage-fixture";

test.describe("smoke", () => {
  test("home page loads and shows search prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Faceit Friends Tracker/);
    await expect(
      page.getByText("Enter a FACEIT nickname, profile link, or match ID")
    ).toBeVisible();
  });

  test("search input is present and interactive", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(/nickname/i);
    await expect(input).toBeVisible();
    await input.fill("testplayer");
    await expect(input).toHaveValue("testplayer");
  });

  test("unknown nickname shows player-not-found message", async ({ page }) => {
    await page.goto("/this-does-not-exist-at-all");
    await expect(page.getByText("not found on FACEIT")).toBeVisible();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByText("Sign in to access match history")
    ).toBeVisible();
  });
});
