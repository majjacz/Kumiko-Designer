import { test, expect, type Page } from "@playwright/test";

async function goToLayout(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Wait for the design to load (squares template is default)
  await expect(page.getByPlaceholder("Design name")).toHaveValue("squares", { timeout: 10000 });
  await page.getByRole("button", { name: "Layout Strips" }).click();
}

async function placeOneStrip(page: Page) {
  const firstStrip = page.getByTestId("strip-bank-item").first();
  await firstStrip.click();

  const layout = page.getByTestId("layout-canvas");
  const box = await layout.boundingBox();
  if (!box) throw new Error("No layout bounding box");

  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;

  await page.mouse.click(x, y);
}

test.describe("Layout editor", () => {
  test.beforeEach(({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
  });

  test("places a strip on the layout canvas", async ({ page }) => {
    await goToLayout(page);

    // Clear existing layout to start fresh
    await page.getByRole("button", { name: "Clear Layout" }).click();

    const pieces = page.getByTestId("layout-piece");
    await expect(pieces).toHaveCount(0);

    await placeOneStrip(page);

    await expect(pieces).toHaveCount(1);
  });

  test("deletes a strip from the layout", async ({ page }) => {
    await goToLayout(page);

    // Ensure at least one piece exists
    await placeOneStrip(page);

    // Deselect the strip so we can interact with the layout pieces
    const firstStrip = page.getByTestId("strip-bank-item").first();
    await firstStrip.click();

    const pieces = page.getByTestId("layout-piece");
    const countBefore = await pieces.count();
    const target = pieces.first();

    // Hover to show the delete button
    await target.hover();
    const deleteButton = target.getByTestId("delete-strip-button");
    await deleteButton.click();

    await expect(pieces).toHaveCount(countBefore - 1);
  });
});