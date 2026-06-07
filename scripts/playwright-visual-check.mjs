import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5500/index.html';
const outDir = path.resolve('test-results', 'visual-check-manual');

async function waitForUser(message) {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(`${message}\nPressione Enter para continuar...`);
  } finally {
    rl.close();
  }
}

async function capture(page, fileName) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({
    path: path.join(outDir, fileName),
    fullPage: true
  });
}

async function ensureClientSelected(page) {
  const state = await page.evaluate(() => ({
    activeClient: window.activeClient || null,
    clientNames: window.data && window.data.clients
      ? Object.values(window.data.clients).map(c => c && c.name).filter(Boolean)
      : []
  }));

  if (state.activeClient) return state;

  console.log('\nNenhum cliente ativo foi detectado na sessao do Playwright.');
  if (state.clientNames.length) {
    console.log(`Clientes encontrados: ${state.clientNames.join(', ')}`);
  }
  await waitForUser('Selecione manualmente um cliente na janela do Playwright.');
  return await page.evaluate(() => ({
    activeClient: window.activeClient || null,
    clientNames: window.data && window.data.clients
      ? Object.values(window.data.clients).map(c => c && c.name).filter(Boolean)
      : []
  }));
}

async function switchTab(page, tabKey) {
  const tab = page.locator(`.tab-btn[data-tab="${tabKey}"]`).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(1200);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: false, channel: 'chrome' }).catch(async () => {
    return await chromium.launch({ headless: false });
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });
  const page = await context.newPage();

  console.log(`Abrindo ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.title = 'PLAYWRIGHT - GRANAFY VISUAL CHECK'; });

  await waitForUser('Faça login na janela "PLAYWRIGHT - GRANAFY VISUAL CHECK".');
  await capture(page, '01-logado.png');

  const state = await ensureClientSelected(page);
  if (!state.activeClient) {
    console.log('\nAinda nao ha cliente selecionado. Encerrando sem capturar abas internas.');
    await browser.close();
    return;
  }

  await capture(page, '02-cliente-selecionado.png');

  const tabs = ['extrato', 'financeiro', 'resumo'];
  for (const tabKey of tabs) {
    await switchTab(page, tabKey);
    await capture(page, `tab-${tabKey}.png`);
  }

  const summary = await page.evaluate(() => ({
    activeClient: window.activeClient || null,
    activeTab: window.activeTab || null,
    title: document.title
  }));

  await fs.writeFile(
    path.join(outDir, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log('\nConferencia visual concluida.');
  console.log(`Arquivos salvos em: ${outDir}`);
  console.log('Capturas geradas:');
  console.log('- 01-logado.png');
  console.log('- 02-cliente-selecionado.png');
  console.log('- tab-extrato.png');
  console.log('- tab-financeiro.png');
  console.log('- tab-resumo.png');

  await waitForUser('Voce pode revisar a janela. Quando terminar, o navegador sera fechado.');
  await browser.close();
}

main().catch(async (error) => {
  console.error('\nFalha na conferencia visual:', error);
  process.exitCode = 1;
});
