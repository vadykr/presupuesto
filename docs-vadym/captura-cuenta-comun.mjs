// oxlint-disable actual/no-extraneous-dependencies -- script suelto: usa el playwright del repo raíz
// Captura del widget «Cuenta común» del Inicio con datos de demo.
// Uso:  node docs-vadym/captura-cuenta-comun.mjs [carpetaBuild] [salida.png]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const build = path.resolve(process.argv[2] ?? 'packages/desktop-client/build');
const salida = path.resolve(
  process.argv[3] ?? 'docs-vadym/capturas/cuenta-comun.png',
);
const PUERTO = 3921;
const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO)], {
  cwd: build,
  stdio: 'ignore',
});
const navegador = await chromium.launch({
  executablePath:
    process.env.CHROMIUM ??
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
try {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    locale: 'es-ES',
  });
  await ctx.addInitScript(() =>
    localStorage.setItem('SharedArrayBufferOverride', 'true'),
  );
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PUERTO}/`);
  await page.waitForFunction(
    () => window.__actionsForMenu?.createBudget,
    null,
    {
      timeout: 60000,
    },
  );
  await page.evaluate(() =>
    window.__actionsForMenu.createBudget({ testMode: true }),
  );
  await page.waitForFunction(
    () => window.$send && /\/(budget|inicio)/.test(window.location.pathname),
    null,
    { timeout: 90000 },
  );
  await page.waitForTimeout(1500);

  await page.evaluate(async () => {
    const send = window.$send;
    const hoy = new Date();
    const mes = hoy.toISOString().slice(0, 7);
    const mesesAtras = n => {
      const d = new Date(
        Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1),
      );
      return d.toISOString().slice(0, 7);
    };
    const personal = await send('account-create', {
      name: 'Cuenta Personal',
      balance: 300000,
    });
    // 12 meses completos de salidas (en euros) con uno atípico de 4.800 €.
    const euros = [
      1000, 1020, 980, 1050, 4800, 1010, 1030, 990, 1020, 1040, 1000, 1020,
    ];
    const gastosMes = 310_00;
    const entradaMes = 105324; // traspaso de finales del mes anterior
    const conjunta = await send('account-create', {
      name: 'Conte conjunt',
      balance: 0,
    });
    const grupo = await send('category-group-create', { name: 'Cuenta común' });
    const cats = {};
    for (const n of ['🏰 Hipoteca', '💡 Llum', '🛒 Menjar']) {
      cats[n] = await send('category-create', { name: n, groupId: grupo });
    }
    const asignado = {
      '🏰 Hipoteca': 70000,
      '💡 Llum': 4550,
      '🛒 Menjar': 30774,
    };
    for (const [n, id] of Object.entries(cats)) {
      await send('budget/budget-amount', {
        month: mes,
        category: id,
        amount: asignado[n],
      });
    }
    const añadidas = [];
    euros.forEach((e, i) => {
      const m = mesesAtras(12 - i);
      const partes = [Math.round(e * 100 * 0.7), Math.round(e * 100 * 0.2)];
      partes.push(e * 100 - partes[0] - partes[1]);
      partes.forEach((p, j) =>
        añadidas.push({
          id: crypto.randomUUID(),
          account: conjunta,
          date: `${m}-${String(5 + j * 9).padStart(2, '0')}`,
          amount: -p,
          category: Object.values(cats)[j],
        }),
      );
    });
    añadidas.push({
      id: crypto.randomUUID(),
      account: conjunta,
      date: `${mes}-02`,
      amount: -gastosMes,
      category: Object.values(cats)[2],
    });
    await send('transactions-batch-update', { added: añadidas });
    const { data: pagadores } = await window.$query(
      window.$q('payees').filter({ transfer_acct: personal }).select('id'),
    );
    const finAnterior = `${mesesAtras(1)}-30`;
    await send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: conjunta,
          date: finAnterior,
          amount: entradaMes,
          payee: pagadores[0].id,
        },
      ],
    });
    // Ajuste de saldo (una entrada del primer mes) para que el saldo sea 1.217,63.
    const { data: suma } = await window.$query(
      window
        .$q('transactions')
        .filter({ account: conjunta })
        .options({ splits: 'none' })
        .calculate({ $sum: '$amount' }),
    );
    await send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: conjunta,
          date: `${mesesAtras(13)}-01`,
          amount: 121763 - suma,
        },
      ],
    });
    await send('preferences/save', {
      id: 'cuenta-comun-categorias',
      value: JSON.stringify(Object.values(cats)),
    });
  });
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(() => window.$send, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.history.pushState({}, '', '/inicio');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const tarjeta = page.getByTestId('inicio-cuenta-comun');
  await tarjeta.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await tarjeta.scrollIntoViewIfNeeded();
  const textos = await tarjeta.innerText();
  console.log(textos);
  await page.screenshot({ path: salida });
  console.log('captura', salida);
} finally {
  await navegador.close();
  servidor.kill();
}
