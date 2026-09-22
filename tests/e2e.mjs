// Prova end-to-end nel browser (Microsoft Edge) sulla modalità dimostrativa.
//   npm run build && npx vite preview --port 4174   poi   npm run e2e
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const BASE = process.env.PTT_URL ?? 'http://localhost:4174/';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', (e) => errori.push(e.message));
const pausa = (ms = 250) => page.waitForTimeout(ms);
const profilo = async (nome) => {
  await page.getByRole('button', { name: new RegExp(nome) }).first().click();
  await page.waitForSelector('.guscio, form');
  await pausa();
};
const esci = async () => {
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('ptt:demo:sessione');
  });
  await page.goto(BASE);
  await page.reload();
  await page.waitForSelector('.profili');
};

await page.goto(BASE);
await page.waitForSelector('.profili');
await page.getByRole('button', { name: 'Ripristina la situazione esempio' }).click();

// 1. il frequentatore registra un task dal telefono: il logbook e il report si aggiornano
await profilo('Matteo Gallo');
await page.goto(`${BASE}#/logbook?ch=44`);
await pausa();
await page.locator('.task-riga').first().click();
await page.getByRole('button', { name: 'Registra questo task' }).click();
await page.getByLabel(/ET – tempo stimato/).fill('35');
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForSelector('.task.eseguito');
await page.goto(`${BASE}#/report`);
await pausa();
const riga44 = page.locator('.cr-tabella tr', { has: page.locator('td:first-child', { hasText: /^44$/ }) });
assert.equal((await riga44.locator('td').nth(2).textContent()).trim(), '1', 'chapter 44 eseguito nel report');

// 2. data futura rifiutata
await page.goto(`${BASE}#/logbook`);
await pausa();
await page.getByRole('button', { name: /^Registra task$/ }).last().click();
await page.getByPlaceholder('Cerca per numero, chapter o descrizione').fill('Placards');
await page.getByRole('option').first().click();
await page.getByLabel(/^Data/).fill('2099-01-01');
await page.getByLabel(/ET – tempo stimato/).fill('20');
await page.getByRole('button', { name: 'Salva' }).click();
// il browser blocca già l'invio (max = oggi); il motore rifiuta comunque le date future (tests/dominio.test.ts)
assert.ok(await page.getByLabel(/^Data/).evaluate((el) => el.validity.rangeOverflow), 'data futura bloccata');
assert.ok(await page.locator('.mantine-Drawer-content').isVisible(), 'registrazione non salvata');
await page.keyboard.press('Escape');

// 3. il TM vede subito la registrazione e crea un account
await esci();
await profilo('Luca Ferri');
assert.match(await page.locator('.sezione').last().locator('tbody tr').first().textContent(), /Matteo Gallo/, 'ultima registrazione visibile al TM');
await page.goto(`${BASE}#/account`);
await pausa();
await page.getByRole('button', { name: 'Nuovo account' }).click();
await page.getByLabel('Username').fill('nuovo.allievo');
const password = await page.getByLabel('Password provvisoria').inputValue();
await page.getByRole('button', { name: 'Crea account' }).click();
await page.getByText('Credenziali da consegnare di persona').waitFor();

// 4. primo accesso del nuovo frequentatore: cambio password e Personal Data obbligatori
await esci();
await page.locator('input[autocomplete=username]').fill('nuovo.allievo');
await page.locator('input[autocomplete=current-password]').fill(password);
await page.getByRole('button', { name: 'Accedi' }).click();
await page.getByText('Scegli la tua password').waitFor();
await page.getByLabel('Password provvisoria').fill(password);
await page.getByLabel(/^Nuova password/).fill('nuovapassword1');
await page.getByLabel('Ripeti la nuova password').fill('nuovapassword1');
await page.getByRole('button', { name: 'Cambia password' }).click();
await page.getByRole('heading', { name: 'Trainee data' }).waitFor();
await page.getByLabel('Rank (grado)').fill('Serg.');
await page.getByLabel('Name (nome)').fill('Marco');
await page.getByLabel('Surname (cognome)').fill('Villa');
await page.getByLabel('Date of birth').fill('1999-04-12');
await page.getByLabel('Place of birth').fill('Rieti');
await page.getByRole('button', { name: 'Salva personal data' }).click();
await page.locator('.cartiglio').waitFor();
assert.ok(await page.locator('.cartiglio').getByText('Serg. Marco Villa').isVisible(), 'cartiglio del nuovo frequentatore');

// 5. l'istruttore non può modificare
await esci();
await profilo('Paolo Rinaldi');
await page.goto(`${BASE}#/logbook?f=u-romano`);
await pausa();
assert.equal(await page.getByRole('button', { name: /Registra/ }).count(), 0, 'istruttore in sola lettura');

await browser.close();
assert.deepEqual(errori, [], `errori JavaScript: ${errori.join('; ')}`);
console.log('e2e: tutti i controlli superati');
