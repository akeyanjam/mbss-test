import { test, expect } from '../../shared/fixtures/base.fixture.js';

test('basic-login', async ({ page, config }) => {
	// Config is automatically loaded from constants.json via the base fixture

	// Navigate to login page
	await page.goto(config.baseUrl);
	await page.waitForLoadState('networkidle');

	// Wait for email field and fill using config value
	const emailInput = page.getByRole('textbox', { name: 'Email Enter your Email ID' });
	await emailInput.waitFor();
	await emailInput.fill(config.email!);

	// Wait for password field and fill using config value
	const passwordInput = page.getByRole('textbox', { name: 'Password' });
	await passwordInput.waitFor();
	await passwordInput.fill(config.password!);

	// Click login and wait for network to settle
	const loginButton = page.getByRole('button', { name: 'Log in' });
	await loginButton.waitFor();
	await loginButton.click();
	await page.waitForLoadState('networkidle');

	// Assert success using the final click target from recording
	// Recording ended with clicking the "My profile" link; verify it is visible
	const successLink = page.getByRole('link', { name: 'My profile 󢀉' });
	await expect(successLink).toBeVisible();
});
