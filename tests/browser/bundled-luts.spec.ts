import { test, expect } from '@playwright/test';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('public/luts/manifest.json','utf8')) as {name:string;url:string;category:string}[];

test('bundled v2 look applies directly and remains usable offline', async ({page,context}) => {
  const look = manifest.find(l => l.url.startsWith('/lutsv2/'))!;
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.getByRole('button', {name:'Choose look. Current: Portra'}).click();
  await expect(page.getByText('Select a look to apply')).toBeVisible();
  const card = page.locator('.look-card').filter({has:page.getByText(look.name,{exact:true})});
  await expect(card).toContainText('Included');
  const response = page.waitForResponse(r=>new URL(r.url()).pathname===look.url && r.ok());
  await card.click();
  await response;
  await expect(card).toContainText('Available offline');
  await page.getByRole('button',{name:'Close panel'}).click();
  await expect(page.getByRole('button',{name:`Choose look. Current: ${look.name}`})).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button',{name:`Choose look. Current: ${look.name}`})).toBeVisible();
  await expect(page.locator('.toast.error')).toHaveCount(0);
  await context.setOffline(false);
});
