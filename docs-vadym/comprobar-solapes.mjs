// oxlint-disable actual/no-extraneous-dependencies -- script suelto: usa el playwright del repo raíz
// Comprobación de solapes en las pantallas móviles (Chromium 390x844, táctil).
//
// Uso:  node docs-vadym/comprobar-solapes.mjs [carpetaBuild] [carpetaCapturas]
//   carpetaBuild    por defecto packages/desktop-client/build
//   carpetaCapturas por defecto docs-vadym/capturas
//
// Sirve el build con `python3 -m http.server`, crea el presupuesto demo y una
// cuenta de préstamo, visita cada pantalla y falla (código 1) si:
//   - dos hermanos en flujo normal se solapan en vertical y horizontal.
// Además avisa (sin fallar) de bloques cuyo contenido desborda su caja.
// ALTO=620 simula el área visible de un móvil con las barras del navegador
// (con 844 el contenido de la deuda cabe y el fallo no se manifiesta).
// Causa que vigila: el View de Actual no fija flexShrink: 0 y su minHeight es 0,
// así que en una columna con scroll los hijos se comprimen y se pintan encima.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const build = path.resolve(process.argv[2] ?? 'packages/desktop-client/build');
const capturas = path.resolve(process.argv[3] ?? 'docs-vadym/capturas');
const PUERTO = 3917;
const ALTO = Number(process.env.ALTO ?? 844);
const BASE = `http://localhost:${PUERTO}`;

const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO)], {
  cwd: build,
  stdio: 'ignore',
});

/** Se ejecuta en la página: devuelve la lista de problemas de maquetación. */
function detectar() {
  const problemas = [];
  const nombre = el =>
    (el.getAttribute('data-testid')
      ? `[${el.getAttribute('data-testid')}]`
      : '') +
    el.tagName.toLowerCase() +
    (el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '') +
    ' «' +
    (el.textContent || '').trim().slice(0, 30) +
    '»';
  const visible = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none' &&
      cs.position !== 'absolute' &&
      cs.position !== 'fixed' &&
      cs.position !== 'sticky'
    );
  };
  for (const padre of document.querySelectorAll('body *')) {
    if (padre.closest('svg')) continue;
    const hijos = [...padre.children].filter(visible);
    for (let i = 0; i < hijos.length; i++) {
      for (let j = i + 1; j < hijos.length; j++) {
        const a = hijos[i].getBoundingClientRect();
        const b = hijos[j].getBoundingClientRect();
        const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const icono = e => e.tagName === 'svg' || e.tagName === 'SVG';
        if (dx > 2 && dy > 2 && !icono(hijos[i]) && !icono(hijos[j])) {
          problemas.push(
            `solape ${Math.round(dy)}px entre ${nombre(hijos[i])} y ${nombre(
              hijos[j],
            )}`,
          );
        }
      }
    }
    // Un bloque cuyo contenido se sale de su caja sin ser scroll ni recortar.
    const cs = getComputedStyle(padre);
    if (
      cs.overflowY === 'visible' &&
      cs.display.includes('flex') &&
      cs.flexDirection === 'column' &&
      padre.scrollHeight > padre.clientHeight + 2 &&
      padre.clientHeight > 0
    ) {
      problemas.push(
        `AVISO contenido desbordado ${
          padre.scrollHeight - padre.clientHeight
        }px en ${nombre(padre)}`,
      );
    }
  }
  // Solape de texto: dos textos distintos (no anidados) cuyas cajas se pisan.
  const textos = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (
      !n.textContent.trim() ||
      !el ||
      el.closest('svg') ||
      el.closest('[aria-hidden=true]')
    ) {
      continue;
    }
    const cs = getComputedStyle(el);
    if (
      cs.visibility === 'hidden' ||
      cs.display === 'none' ||
      cs.opacity === '0'
    ) {
      continue;
    }
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const r = rango.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Capas superpuestas a propósito (barra de pestañas, modal con su fondo):
    // el texto de la capa y el de debajo no cuentan como solape.
    let capa = null;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const pos = getComputedStyle(a).position;
      if (
        pos === 'fixed' ||
        pos === 'sticky' ||
        a.getAttribute('role') === 'dialog'
      ) {
        capa = a;
        break;
      }
    }
    textos.push({ el, r, capa, t: n.textContent.trim().slice(0, 24) });
  }
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const a = textos[i];
      const b = textos[j];
      if (a.capa !== b.capa) continue;
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const dx = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const dy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      // Más de la mitad de la altura de la línea más baja: solape real.
      if (dx > 4 && dy > Math.min(a.r.height, b.r.height) * 0.5) {
        problemas.push(`texto solapado «${a.t}» y «${b.t}»`);
      }
    }
  }
  return [...new Set(problemas)];
}

async function esperar(page, ms = 700) {
  await page.waitForTimeout(ms);
}

const resultados = [];
const avisos = [];
const navegador = await chromium.launch({
  executablePath:
    process.env.CHROMIUM ??
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
try {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: ALTO },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await ctx.addInitScript(() =>
    localStorage.setItem('SharedArrayBufferOverride', 'true'),
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
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
  await esperar(page, 1500);

  const ids = await page.evaluate(async () => {
    const nota = `#prestamo ${JSON.stringify({
      tipo: 'autoLoan',
      interes_anual: 8.72,
      cuota_minima: 246.72,
      desde: '2026-07-01',
    })}`;
    const cuenta = await window.$send('account-create', {
      name: 'Ford KUGA',
      offBudget: true,
      balance: 0,
    });
    await window.$send('notes-save', { id: `account-${cuenta}`, note: nota });
    const hoy = new Date().toISOString().slice(0, 10);
    await window.$send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: cuenta,
          date: '2026-07-01',
          amount: -1200000,
        },
        { id: crypto.randomUUID(), account: cuenta, date: hoy, amount: 14557 },
      ],
    });
    const { data } = await window.$query(
      window.$q('categories').select('id').limit(1),
    );
    return { cuenta, categoria: data[0].id };
  });

  const pantallas = [
    ['inicio', '/inicio'],
    ['plan', '/budget'],
    ['asignar', '/asignar'],
    ['anual', '/anual'],
    ['objetivo', `/categories/${ids.categoria}/objetivo`],
    ['deuda', `/accounts/${ids.cuenta}`],
    ['simulador', `/accounts/${ids.cuenta}?vista=simulador`],
    ['formulario-prestamo', `/accounts/${ids.cuenta}?prestamo=1`],
    ['informes', '/reports'],
    ['informes-gasto', '/reports/gasto'],
    ['informes-ingresos-gastos', '/reports/ingresos-gastos'],
    ['informes-sube-baja', '/reports/sube-baja'],
    ['informes-patrimonio', '/reports/patrimonio'],
    ['informes-edad-dinero', '/reports/edad-dinero'],
    ['informes-nominas', '/reports/nominas'],
    ['analisis', '/reports/analisis'],
  ];

  async function visitar(nombre, accion) {
    await accion();
    await esperar(page, 1200);
    const problemas = await page.evaluate(detectar);
    resultados.push({
      nombre,
      problemas: problemas.filter(p => !p.startsWith('AVISO')),
    });
    for (const p of problemas.filter(p => p.startsWith('AVISO'))) {
      avisos.push(`${nombre}: ${p}`);
    }
    const captura = {
      deuda: 'fix-deuda',
      'filtro-categorias': 'fix-filtro',
      plan: 'arreglos3-plan',
    }[nombre];
    if (captura) {
      await page.screenshot({ path: path.join(capturas, `${captura}.png`) });
    }
  }

  for (const [nombre, ruta] of pantallas) {
    await visitar(nombre, async () => {
      await page.evaluate(r => {
        window.history.pushState({}, '', r);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, ruta);
    });
  }

  // Editar inicio (si el botón existe en la pantalla de inicio).
  await visitar('editar-inicio', async () => {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/inicio');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await esperar(page, 800);
    const boton = page
      .getByRole('button', { name: /edit|editar|personaliz/i })
      .first();
    if (await boton.count()) await boton.click();
  });

  // Modal «Qué cuenta como gasto»: cada grupo debe quedar debajo del anterior.
  await visitar('filtro-categorias', async () => {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/reports');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await esperar(page, 1000);
    await page
      .getByRole('button', { name: /filter|filtr|qué cuenta|categor/i })
      .first()
      .click();
  });
  const filas = await page.evaluate(() => {
    const m = document.querySelector('[role=dialog]');
    if (!m) return null;
    return [...m.querySelectorAll('label')].map(l => {
      const r = l.getBoundingClientRect();
      return { y1: r.top, y2: r.bottom };
    });
  });
  if (!filas?.length) {
    resultados.push({
      nombre: 'filtro-categorias',
      problemas: ['no se abrió el modal'],
    });
  } else {
    for (let i = 1; i < filas.length; i++) {
      if (filas[i].y1 < filas[i - 1].y2 - 1) {
        resultados.push({
          nombre: 'filtro-categorias',
          problemas: [
            `la fila ${i} (y1=${
              filas[i].y1
            }) empieza antes de acabar la anterior (y2=${filas[i - 1].y2})`,
          ],
        });
        break;
      }
    }
  }
  // Cabecera de cuenta con importes de 7 dígitos: nada se pisa ni se sale.
  const cuentaGrande = await page.evaluate(async () => {
    const cuenta = await window.$send('account-create', {
      name: 'Cuenta grande',
      offBudget: false,
      balance: 0,
    });
    await window.$send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: cuenta,
          date: '2026-07-01',
          amount: -123456789,
          cleared: true,
        },
        {
          id: crypto.randomUUID(),
          account: cuenta,
          date: '2026-07-02',
          amount: 61491200,
          cleared: false,
        },
      ],
    });
    return cuenta;
  });
  await visitar('cuenta-cabecera', async () => {
    await page.evaluate(r => {
      window.history.pushState({}, '', r);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/accounts/${cuentaGrande}`);
  });
  {
    const problemas = [];
    for (const id of [
      'transactions-balance',
      'transactions-balance-cleared',
      'transactions-balance-uncleared',
    ]) {
      const c = await page
        .locator(`[data-testid="${id}"]`)
        .first()
        .boundingBox();
      if (!c) {
        problemas.push(`${id} no está visible`);
      } else if (c.x < 0 || c.x + c.width > 390) {
        problemas.push(`${id} se sale de la pantalla (x=${c.x}, w=${c.width})`);
      }
    }
    const saldo = await page
      .locator('[data-testid="transactions-balance"]')
      .first()
      .boundingBox();
    const conf = await page
      .locator('[data-testid="transactions-balance-cleared"]')
      .first()
      .boundingBox();
    if (saldo && conf && conf.y < saldo.y + saldo.height - 1) {
      problemas.push('«Confirmado» no queda debajo del saldo');
    }
    resultados.push({ nombre: 'cuenta-cabecera-cajas', problemas });
    await page.screenshot({
      path: path.join(capturas, 'arreglos3-cuenta.png'),
    });
  }

  // Teclado de «Asignar el mes»: pegado al borde inferior de la ventana, tanto
  // llegando por navegación interna desde Inicio como con carga directa.
  async function comprobarTeclado(nombre) {
    const problemas = [];
    const fila = page.locator('[data-testid="asignar-fila"]').first();
    await fila.waitFor({ timeout: 30000 });
    await fila.click();
    await esperar(page, 900);
    const panel = page.locator('[data-testid="assign-keypad"]');
    const caja = await panel.boundingBox();
    if (!caja) {
      problemas.push('el teclado no se abrió');
    } else {
      const fondo = caja.y + caja.height;
      if (Math.abs(fondo - ALTO) > 2) {
        problemas.push(`el teclado acaba en y=${fondo}, esperado ${ALTO}`);
      }
      if (await panel.evaluate(e => e.parentElement !== document.body)) {
        problemas.push('el teclado no cuelga de <body>');
      }
    }
    resultados.push({ nombre, problemas });
    if (nombre === 'teclado-asignar-directo') {
      await page.screenshot({
        path: path.join(capturas, 'arreglos3-asignar.png'),
      });
    }
  }
  await page.evaluate(() => {
    window.history.pushState({}, '', '/inicio');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await esperar(page, 1000);
  const botonAsignar = page.getByRole('button', {
    name: /^asignar$|^assign$/i,
  });
  if (await botonAsignar.count()) {
    await botonAsignar.first().click();
  } else {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/asignar');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await esperar(page, 1200);
  await comprobarTeclado('teclado-asignar-navegando');
  await page.goto(`${BASE}/asignar`);
  await page.waitForFunction(() => window.$send, null, { timeout: 90000 });
  await esperar(page, 2500);
  await comprobarTeclado('teclado-asignar-directo');

  // Deuda: comprobación explícita con boundingBox de los bloques principales.
  await page.evaluate(r => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/accounts/${ids.cuenta}`);
  await esperar(page, 1500);
  const ordenados = [
    'deuda-saldo',
    'deuda-donut',
    'deuda-frase',
    'deuda-interes-total',
    'deuda-simular',
    'deuda-registrar-intereses',
    'deuda-editar',
    'deuda-letra',
  ];
  let yPrev = -Infinity;
  const problemasDeuda = [];
  for (const id of ordenados) {
    const caja = await page
      .locator(`[data-testid="${id}"]`)
      .first()
      .boundingBox();
    if (!caja) continue;
    if (id === 'deuda-interes-total') {
      // Ocupa la celda: sube al bloque contenedor (la celda) para medirlo entero.
      const celda = await page
        .locator(`[data-testid="${id}"]`)
        .first()
        .locator('xpath=ancestor::div[1]')
        .boundingBox();
      if (celda && celda.y + celda.height > yPrev) {
        yPrev = celda.y + celda.height;
      }
      continue;
    }
    if (caja.y < yPrev - 1) {
      problemasDeuda.push(
        `${id} empieza en y=${caja.y} antes de y2=${yPrev} del bloque anterior`,
      );
    }
    yPrev = Math.max(yPrev, caja.y + caja.height);
  }
  resultados.push({
    nombre: 'deuda-orden-vertical',
    problemas: problemasDeuda,
  });
} finally {
  await navegador.close();
  servidor.kill();
}

let fallos = 0;
for (const { nombre, problemas } of resultados) {
  console.log(`${problemas.length ? 'FALLO' : 'ok   '} ${nombre}`);
  for (const p of problemas) console.log(`       - ${p}`);
  fallos += problemas.length;
}
for (const a of avisos) console.log(a);
console.log(`${fallos} problema(s) con alto ${ALTO}`);
process.exit(fallos ? 1 : 0);
