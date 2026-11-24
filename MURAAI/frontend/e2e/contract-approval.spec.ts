import { test, expect, type Page } from '@playwright/test'

/**
 * Core contract lifecycle E2E test.
 *
 * Flow:  log in -> create a contract (Draft) -> submit for approval ->
 *        approve it -> activate it -> verify it shows as Active (dashboard
 *        reports exactly one active contract, since the DB is seeded empty).
 *
 * Backend lifecycle: Draft --submit--> Pending Approval --approve--> Approved
 *                    --activate--> Active (see src/services/contract_lifecycle.py)
 *
 * The DB is reseeded on every Playwright run (scripts/e2e_seed.py), so the
 * starting point is deterministic: no contracts, no approvals.
 */

const USER_EMAIL = 'admin@acmetech.com'
const USER_PASSWORD = 'Acme@2026!'
const CONTRACT_NAME = `E2E Approval ${Date.now()}`

async function loginIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('#email').fill(USER_EMAIL)
  await page.locator('#password').fill(USER_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
}

async function navTo(page: Page, label: string, heading: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: label })
    .click()
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

function contractRow(page: Page): ReturnType<Page['locator']> {
  return page.locator('tbody tr').filter({ hasText: CONTRACT_NAME })
}

async function clickAction(page: Page, action: string): Promise<void> {
  await contractRow(page).getByRole('button', { name: 'Contract actions' }).click()
  await page.getByText(action, { exact: true }).click()
}

test('core flow: create -> submit -> approve -> activate -> dashboard shows Active', async ({ page }) => {
  // 1. Login
  await loginIn(page)

  // 2. Create a contract (start Draft so submit-for-approval is allowed)
  await navTo(page, 'Contracts', 'Contracts')
  await page.getByRole('button', { name: 'New Contract' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create Contract' })

  await dialog.locator('#wiz-customer').selectOption({ label: 'Global Retail Ltd' })
  await dialog.locator('#wiz-company').fill('E2E Partner Co')
  await dialog.locator('#wiz-contract-type').selectOption({ label: 'Annual Subscription' })
  await dialog.getByRole('button', { name: 'Next' }).click()

  await dialog.locator('#wiz-contract-name').fill(CONTRACT_NAME)
  await dialog.locator('#wiz-start-date').fill('2026-08-01')
  await dialog.locator('#wiz-end-date').fill('2027-08-01')
  // NOTE: the backend treats renewal_date as required (wizard labels it
  // optional) - set it explicitly for the flow to work.
  await dialog.locator('#wiz-renewal-date').fill('2027-07-01')
  await dialog.locator('#wiz-status').selectOption({ label: 'Draft' })
  await dialog.getByRole('button', { name: 'Next' }).click()

  // Line Items are optional - skip forward to Review and submit.
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Submit' }).click()

  // The wizard closes on success; the new row appears (Draft status).
  await expect(dialog).toBeHidden()
  await expect(contractRow(page)).toBeVisible()
  await expect(contractRow(page)).toContainText('Draft')

  // 3. Submit for approval (Draft -> Pending Approval)
  await clickAction(page, 'Submit for Approval')

  // 4. Approve it - the owner can approve its own submission (Approved).
  //    Use the row's Actions kebab (last button in the row) -> Approve.
  await navTo(page, 'Approvals', 'Approvals')
  const approvalRow = page.locator('tbody tr').filter({ hasText: CONTRACT_NAME })
  await expect(approvalRow).toBeVisible()
  await approvalRow.getByRole('button').last().click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()

  // Back on the contracts list the row now reads Approved (activatable).
  await navTo(page, 'Contracts', 'Contracts')
  await expect(contractRow(page)).toContainText('Approved')

  // 5. Activate (Approved -> Active)
  await clickAction(page, 'Activate')

  // 6. Verify it is now Active on the contracts list AND the dashboard.
  await expect(contractRow(page)).toContainText('Active')

  await navTo(page, 'Dashboard', 'Mission Control')
  await expect(page.getByText(/1 active contracts?\b/)).toBeVisible()
})