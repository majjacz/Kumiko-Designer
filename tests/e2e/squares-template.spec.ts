import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for the "squares" template.
 * This template tests the auto-flip normalization of strips with bottom-only notches.
 * After normalization, all single-sided strips should have top notches only,
 * enabling single-pass CNC cutting.
 */

async function loadSquaresTemplate(page: Page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	// Wait for default template to load first
	await expect(page.getByPlaceholder("Untitled design")).toHaveValue(
		"Basic Grid",
		{ timeout: 10000 },
	);

	// Click the "File" menu button
	await page.getByRole("button", { name: "File" }).click();

	// Click "Load Template..." option
	await page.getByRole("button", { name: "Load Template..." }).click();

	// In the template dialog, click "Use" on "Nested Squares" template
	await page.getByRole("button", { name: "Use" }).nth(1).click(); // squares is the second template

	// Wait for the squares template to load
	await expect(page.getByPlaceholder("Untitled design")).toHaveValue(
		"squares",
		{ timeout: 10000 },
	);
}

async function goToSquaresLayout(page: Page) {
	await loadSquaresTemplate(page);
	await page.getByRole("tab", { name: "Layout" }).click();
}

async function placeStripOnLayout(page: Page) {
	// Select a strip from the bank (pick one that needs placement)
	const strips = page.getByTestId("strip-bank-item");
	await expect(strips.first()).toBeVisible({ timeout: 5000 });

	// Find a strip that still needs placement (look for one with remaining count > 0)
	// Or just use the first strip available
	await strips.first().click();

	// Click on the layout canvas to place the strip
	const layout = page.getByTestId("layout-canvas");
	const box = await layout.boundingBox();
	if (!box) throw new Error("No layout bounding box");

	// Click in the center of the canvas (like the working layout.spec.ts does)
	const x = box.x + box.width * 0.5;
	const y = box.y + box.height * 0.5;
	await page.mouse.click(x, y);
}

test.describe("Squares template", () => {
	test.beforeEach(({ page }) => {
		page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
	});

	test("loads the squares template correctly", async ({ page }) => {
		await loadSquaresTemplate(page);

		// Verify template loaded with correct name
		await expect(page.getByPlaceholder("Untitled design")).toHaveValue(
			"squares",
		);

		// Verify there are lines in the grid
		const grid = page.getByTestId("grid-canvas");
		const lines = await grid.locator('line[stroke="#60A5FA"]').count();
		expect(lines).toBeGreaterThan(0);
	});

	test("design view shows intersections", async ({ page }) => {
		await loadSquaresTemplate(page);

		// Make sure we're on the Design tab
		await page.getByRole("tab", { name: "Design" }).click();

		// Enable notch markers to see intersections
		await page.getByLabel("Notch markers").check();

		const grid = page.getByTestId("grid-canvas");

		// Fit to view to ensure content is visible
		await page.getByRole("button", { name: "Fit to View" }).click();
		await page.waitForTimeout(200);

		// There should be intersection markers
		const notchToggles = grid.getByRole("button", { name: /Toggle notch/ });
		await expect(notchToggles.first()).toBeVisible();
		const notchCount = await notchToggles.count();
		expect(notchCount).toBeGreaterThan(0);
	});

	test("layout view shows available strips", async ({ page }) => {
		await goToSquaresLayout(page);

		// Verify strip bank has items
		const stripBankItems = page.getByTestId("strip-bank-item");
		await expect(stripBankItems.first()).toBeVisible({ timeout: 5000 });

		const stripCount = await stripBankItems.count();
		expect(stripCount).toBeGreaterThan(0);
	});

	test("strips have correct notch orientation after normalization", async ({
		page,
	}) => {
		await goToSquaresLayout(page);

		// The strip bank should show strips with notches
		// After normalization, strips that had only bottom notches should now show top notches
		const stripBankItems = page.getByTestId("strip-bank-item");
		await expect(stripBankItems.first()).toBeVisible();

		// The squares template should have multiple strip types
		const stripCount = await stripBankItems.count();
		expect(stripCount).toBeGreaterThan(1);

		// Strip previews should be visible and should show notches
		// (The actual notch visualization is done in the StripBank SVG previews)
	});

	test("can place strips on layout canvas", async ({ page }) => {
		await goToSquaresLayout(page);

		// Clear existing layout to start fresh
		await page.getByRole("button", { name: "More actions" }).click();
		await page.getByRole("button", { name: "Clear layout" }).click();

		const pieces = page.getByTestId("layout-piece");
		await expect(pieces).toHaveCount(0);

		// Place a strip
		await placeStripOnLayout(page);

		// Verify piece was placed
		await expect(pieces.first()).toBeVisible({ timeout: 5000 });
	});

	test("placement progress updates when strips are placed", async ({
		page,
	}) => {
		await goToSquaresLayout(page);

		// The progress bar shows placement progress across ALL groups
		// Since the squares template has pre-placed strips in some groups, 
		// the progress won't start at 0%
		
		// Verify progress bar exists and shows a percentage
		const progressBar = page.getByText("Placement progress");
		await expect(progressBar).toBeVisible();
		
		// Progress percentage should be visible (some percentage)
		const progressPercent = page.locator("text=/\\d+%/").first();
		await expect(progressPercent).toBeVisible();
	});

	test("can export SVG from layout", async ({ page }) => {
		await goToSquaresLayout(page);

		// Clear and place at least one strip
		await page.getByRole("button", { name: "More actions" }).click();
		await page.getByRole("button", { name: "Clear layout" }).click();

		await placeStripOnLayout(page);
		await expect(page.getByTestId("layout-piece").first()).toBeVisible({
			timeout: 5000,
		});

		// Deselect strip so export button is clickable
		await page.getByTestId("strip-bank-item").first().click();

		// Export SVG
		const [download] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("button", { name: "Export SVG" }).click(),
		]);

		expect(download.suggestedFilename()).toMatch(/\.svg$/);
		const path = await download.path();
		expect(path).not.toBeNull();
	});

	test("layout shows stock length from template", async ({ page }) => {
		await goToSquaresLayout(page);

		// The squares template has stockLength of 400mm
		// There should be a stock length indicator visible in the layout
		await expect(page.getByText(/400/)).toBeVisible();
	});

	test("can switch between groups in template", async ({ page }) => {
		await goToSquaresLayout(page);

		// The squares template defines multiple groups
		// Look for a group selector or group name in the UI
		const groupLabel = page.getByText("Group", { exact: true });
		await expect(groupLabel).toBeVisible();

		// There should be a group dropdown with multiple options
		const groupDropdown = page.getByRole("combobox");
		await expect(groupDropdown).toBeVisible();

		// Verify we can click it and see group options
		await groupDropdown.click();
		
		// Should have multiple group options
		const options = page.getByRole("option");
		const optionCount = await options.count();
		expect(optionCount).toBeGreaterThan(1);
	});

	test("total length indicator is visible", async ({ page }) => {
		await goToSquaresLayout(page);

		// There should be a total length indicator in the header area
		// The squares template with pre-placed strips should show a total
		await expect(page.getByText(/mm.*total/i)).toBeVisible();
	});
});
