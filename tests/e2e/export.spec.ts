import { test, expect, type Page } from "@playwright/test";

async function setupLayoutWithPiece(page: Page) {
  await page.goto("/");
  // Wait for the default template to load to ensure stability
  await expect(page.getByPlaceholder("Untitled design")).toHaveValue("squares");
  
  await page.evaluate(() => localStorage.clear());
  await page.getByRole("tab", { name: "Layout" }).click();

  // Clear layout to ensure clean state - open the more menu first
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Clear layout" }).click();

  const firstStrip = page.getByTestId("strip-bank-item").first();
  await firstStrip.click();

  const layout = page.getByTestId("layout-canvas");
  const box = await layout.boundingBox();
  if (!box) throw new Error("No layout bounding box");

  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;
  await page.mouse.click(x, y);
  
  // Wait for the piece to be placed
  await expect(page.getByTestId("layout-piece").first()).toBeVisible();
}

test.describe("SVG export", () => {
  test("exports current group SVG", async ({ page }) => {
    await setupLayoutWithPiece(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export SVG" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const path = await download.path();
    expect(path).not.toBeNull();
  });

  test("exports all groups SVG", async ({ page }) => {
    await setupLayoutWithPiece(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "All Groups" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const path = await download.path();
    expect(path).not.toBeNull();
  });
});