const { test, expect } = require('@playwright/test');

test.describe('Granafy smoke', () => {
  test('carrega a tela inicial do app', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('.auth-brand')).toContainText('Granafy');
    await expect(page.locator('body')).toContainText('Gestão Financeira');
    await expect(page.locator('body')).toContainText(/Entrar|Criar acesso|Selecione um cliente/i);
  });

  test('renderiza a autenticacao sem erro visual basico', async ({ page }) => {
    await page.goto('/index.html');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Cannot');
    expect(bodyText).not.toContain('ReferenceError');
    expect(bodyText).not.toContain('TypeError');
  });
});
