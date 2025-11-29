import { test, expect, type Page } from "@playwright/test";

async function goToDesignGrid(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.getByRole("tab", { name: "Design" }).click();
  // Wait for initial fit-to-view animation to complete
  // (triggered when a design or template is loaded on page load)
  await page.waitForTimeout(150);
}

async function drawHorizontalLine(page: Page) {
  const grid = page.getByTestId("grid-canvas");
  const box = await grid.boundingBox();
  if (!box) throw new Error("No grid bounding box");

  // Draw in the middle of the canvas to avoid overlapping with floating toolbars
  const y = box.y + box.height * 0.5;
  const x1 = box.x + box.width * 0.2;
  const x2 = box.x + box.width * 0.8;

  await page.mouse.move(x1, y);
  await page.mouse.down();
  await page.mouse.move(x2, y);
  await page.mouse.up();
}

async function drawVerticalLine(page: Page) {
  const grid = page.getByTestId("grid-canvas");
  const box = await grid.boundingBox();
  if (!box) throw new Error("No grid bounding box");

  const x = box.x + box.width * 0.5;
  const y1 = box.y + box.height * 0.2;
  const y2 = box.y + box.height * 0.8;

  await page.mouse.move(x, y1);
  await page.mouse.down();
  await page.mouse.move(x, y2);
  await page.mouse.up();
}

test.describe("Grid designer", () => {
  test("draws a grid line by dragging", async ({ page }) => {
    await goToDesignGrid(page);

    const grid = page.getByTestId("grid-canvas");
    const before = await grid.locator('line[stroke="#60A5FA"]').count();

    await drawHorizontalLine(page);

    const after = await grid.locator('line[stroke="#60A5FA"]').count();
    expect(after).not.toBe(before);
  });

  test("deletes a grid line by dragging across it", async ({ page }) => {
    await goToDesignGrid(page);

    const grid = page.getByTestId("grid-canvas");
    const box = await grid.boundingBox();
    if (!box) throw new Error("No grid bounding box");

    // Ensure at least one line exists
    await drawHorizontalLine(page);
    const before = await grid.locator('line[stroke="#60A5FA"]').count();

    // Drag diagonally across the grid to trigger deletion
    const dx1 = box.x + box.width * 0.2;
    const dy1 = box.y + box.height * 0.3;
    const dx2 = box.x + box.width * 0.8;
    const dy2 = box.y + box.height * 0.7;

    await page.mouse.move(dx1, dy1);
    await page.mouse.down();
    await page.mouse.move(dx2, dy2);
    await page.mouse.up();

    const after = await grid.locator('line[stroke="#60A5FA"]').count();
    expect(after).not.toBe(before);
  });

  test("toggles a notch marker when clicking an intersection", async ({ page }) => {
    await goToDesignGrid(page);

    const grid = page.getByTestId("grid-canvas");

    // Ensure notch markers are visible
    await page.getByLabel("Notch markers").check();

    // Create a cross so we have at least one intersection
    await drawHorizontalLine(page);
    await drawVerticalLine(page);

    // Click the "Fit to View" button to ensure all content is visible
    await page.getByRole("button", { name: "Fit to View" }).click();
    await page.waitForTimeout(200);

    // Find a notch toggle - use last() to get one from the newly drawn lines
    // (template notches are at coordinates around 200, new lines are around 300-500)
    const notch = grid.getByRole("button", { name: /Toggle notch/ }).last();

    // Get the aria-label which includes state info via the title element
    const beforeTitle = await notch.locator("title").textContent();
    // Use dispatchEvent because SVG elements with transforms can confuse
    // Playwright's built-in click position calculation
    await notch.dispatchEvent("click");
    const afterTitle = await notch.locator("title").textContent();

    expect(afterTitle).not.toEqual(beforeTitle);
  });
});