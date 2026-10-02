// oxlint-disable actual/no-extraneous-dependencies -- script suelto: usa el playwright del repo raíz
// Comprobación de densidad del Plan, «Asignar el mes» y «Gasto anual»
// (Chromium 390x844, táctil): mide con getComputedStyle y boundingBox los
// tamaños reales de letra y el alto de las filas y falla (código 1) si no
// coinciden con los objetivos de docs-vadym/diseno.md («Densidad»).
//
// Uso:  node docs-vadym/comprobar-densidad.mjs [carpetaBuild] [carpetaCapturas]
//   CAPTURAS=0 no guarda capturas.
//
// Crea el presupuesto demo y añade el grupo «Deutes» con «🚙 Cotxe Nou»,
// «🏛️ Seguro Hipoteca» (gastada sin asignar → banner rojo) y «🏰 Hipoteca»
// (con objetivo «#template 38.47» sin cubrir → infrafinanciada).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const build = path.resolve(process.argv[2] ?? 'packages/desktop-client/build');
const capturas = path.resolve(process.argv[3] ?? 'docs-vadym/capturas');
const PUERTO = 3918;
const BASE = `http://localhost:${PUERTO}`;
const CON_CAPTURAS = process.env.CAPTURAS !== '0';

const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO)], {
  cwd: build,
  stdio: 'ignore',
});

/** Se ejecuta en la página: mide los elementos del Plan. */
function medirPlan() {
  const visible = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none'
    );
  };
  const ficha = el => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      fs: parseFloat(cs.fontSize),
      fw: Number(cs.fontWeight),
      lh: cs.lineHeight,
      tab: cs.fontVariantNumeric.includes('tabular-nums'),
      h: Math.round(r.height * 10) / 10,
      x: Math.round(r.left * 10) / 10,
      w: Math.round(r.width * 10) / 10,
    };
  };
  /** Primer elemento cuyo texto propio (nodo de texto hijo) cumple `re`. */
  const hoja = (raiz, re, excluir) => {
    if (!raiz) return null;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !visible(el)) continue;
      if (excluir && el.closest(excluir)) continue;
      if (re.test(n.textContent.trim())) return el;
    }
    return null;
  };
  const q = s => [...document.querySelectorAll(s)].find(visible) ?? null;

  const nombreCotxe = [
    ...document.querySelectorAll('[data-testid="category-name"]'),
  ].find(e => /Cotxe Nou/.test(e.textContent));
  const filaCotxe = nombreCotxe?.closest('[data-category-id]');
  const nombreSeguro = [
    ...document.querySelectorAll('[data-testid="category-name"]'),
  ].find(e => /Seguro Hipoteca/.test(e.textContent));
  const filaSeguro = nombreSeguro?.closest('[data-category-id]');
  const filaGrupo = [
    ...document.querySelectorAll('[data-testid="category-group-row"]'),
  ].find(e => /Deutes/.test(e.textContent));
  const nombreGrupo = filaGrupo?.querySelector(
    '[data-testid="category-group-name"]',
  );
  const selector = q('[data-testid="selector-mes"]');
  const banner =
    q('[data-testid="banner"]') ??
    hoja(document.body, /en rojo|overspent/i, '[role=dialog]');

  // Alturas de todas las filas de categoría de una línea (sin texto extra).
  const altosFilas = [...document.querySelectorAll('[data-category-id]')]
    .filter(visible)
    .filter(f => !f.querySelector('[data-testid="budget-cell-spent"]'))
    .map(f => Math.round(f.getBoundingClientRect().height));
  const altosGrupos = [
    ...document.querySelectorAll('[data-testid="category-group-row"]'),
  ]
    .filter(visible)
    .map(f => Math.round(f.getBoundingClientRect().height));

  // Letra más pequeña de toda la pantalla (sin la barra de pestañas).
  let minimo = { fs: 99, t: '' };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || !visible(el)) continue;
    if (el.closest('[aria-hidden=true]') || el.closest('svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < minimo.fs) minimo = { fs, t: n.textContent.trim().slice(0, 24) };
  }

  const pildora = filaCotxe?.querySelector('[data-estado]');
  return {
    nombreCategoria: ficha(nombreCotxe),
    emoji: ficha(
      filaCotxe?.querySelector('[data-testid="category-emoji"]') ??
        hoja(filaCotxe, /🚙/),
    ),
    cifraFila: ficha(
      filaCotxe?.querySelector('[data-testid="budget-cell-amount"]') ??
        hoja(filaCotxe, /\d/, '[data-estado]'),
    ),
    pildora: ficha(pildora ? hoja(pildora, /\d/) : null),
    gastoFila: ficha(
      filaSeguro?.querySelector('[data-testid="budget-cell-spent"]'),
    ),
    altoFila: ficha(filaCotxe),
    altosFilas,
    nombreGrupo: ficha(nombreGrupo),
    cifraGrupo: ficha(
      filaGrupo?.querySelector('[data-testid="group-amount"]') ??
        hoja(filaGrupo, /\d/),
    ),
    altoGrupo: ficha(filaGrupo),
    altosGrupos,
    menuGrupo: ficha(
      filaGrupo?.querySelector('[data-testid="menu-grupo"] svg'),
    ),
    menusEnCategorias: document.querySelectorAll(
      '[data-category-id] [data-testid="menu-grupo"]',
    ).length,
    cabeceraColumnas: ficha(
      q('[data-testid="cabecera-columnas"]') ??
        hoja(document.body, /^(categoría|category)$/i),
    ),
    banner: ficha(banner),
    listo: ficha(
      q('[data-testid="to-budget-texto"]') ??
        hoja(q('[data-testid="to-budget"]'), /listos|ready|asignad|assigned/i),
    ),
    altoListo: ficha(q('[data-testid="to-budget"]')),
    mes: ficha(
      q('[data-testid="selector-mes-nombre"]') ??
        hoja(selector, /^[a-záéíóú]+$/i),
    ),
    anio: ficha(
      q('[data-testid="selector-mes-anio"]') ?? hoja(selector, /^\d{4}$/),
    ),
    seguroLineas: nombreSeguro
      ? Math.round(
          nombreSeguro.getBoundingClientRect().height /
            parseFloat(getComputedStyle(nombreSeguro).lineHeight || '18'),
        )
      : null,
    seguroAlto: ficha(filaSeguro),
    xGrupo: ficha(nombreGrupo)?.x,
    xEmoji: ficha(
      filaCotxe?.querySelector('[data-testid="category-emoji"]') ??
        hoja(filaCotxe, /🚙/),
    )?.x,
    xChevron: ficha(filaGrupo?.querySelector('svg'))?.x,
    // Nombres de ≤ 24 caracteres que salen cortados (elipsis).
    cortados: [
      ...document.querySelectorAll(
        '[data-testid="category-name"], [data-testid="category-group-name"]',
      ),
    ]
      .filter(visible)
      .filter(
        e =>
          e.textContent.trim().length <= 24 &&
          (e.scrollHeight > e.clientHeight + 1 ||
            e.scrollWidth > e.clientWidth + 1),
      )
      .map(e => e.textContent.trim()),
    estadoObjetivo: document.querySelectorAll(
      '[data-testid="estado-objetivo-corto"]',
    ).length,
    minimo,
  };
}

function medirLista([selFila, selNombre, selCifra, selEstado]) {
  const visible = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const filas = [...document.querySelectorAll(selFila)].filter(visible);
  const f = filas[0];
  const ficha = el => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      fs: parseFloat(cs.fontSize),
      fw: Number(cs.fontWeight),
      h: Math.round(el.getBoundingClientRect().height * 10) / 10,
    };
  };
  let minimo = { fs: 99, t: '' };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || !visible(el)) continue;
    if (el.closest('[aria-hidden=true]') || el.closest('svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < minimo.fs) minimo = { fs, t: n.textContent.trim().slice(0, 24) };
  }
  return {
    n: filas.length,
    altos: [
      ...new Set(filas.map(x => Math.round(x.getBoundingClientRect().height))),
    ],
    fila: ficha(f),
    nombre: ficha(f?.querySelector(selNombre)),
    cifra: ficha(f?.querySelector(selCifra)),
    estado: ficha(f?.querySelector(selEstado)),
    minimo,
  };
}

async function esperar(page, ms = 700) {
  await page.waitForTimeout(ms);
}

const fallos = [];
const tabla = [];
function comprobar(nombre, real, objetivo, tolerancia = 0.5) {
  const ok =
    typeof real === 'number' && Math.abs(real - objetivo) <= tolerancia;
  tabla.push(
    `${ok ? 'ok   ' : 'FALLO'} ${nombre.padEnd(34)} ${String(real ?? 'n/d').padStart(6)}  (objetivo ${objetivo})`,
  );
  if (!ok) fallos.push(nombre);
}
function cierto(nombre, valor, detalle = '') {
  tabla.push(`${valor ? 'ok   ' : 'FALLO'} ${nombre.padEnd(34)} ${detalle}`);
  if (!valor) fallos.push(nombre);
}

const navegador = await chromium.launch({
  executablePath:
    process.env.CHROMIUM ??
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
try {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
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

  // Grupo «Deutes» al principio, con las tres categorías de las capturas.
  await page.evaluate(async () => {
    const send = window.$send;
    const grupo = await send('category-group-create', { name: 'Deutes' });
    const cotxe = await send('category-create', {
      name: '🚙 Cotxe Nou',
      groupId: grupo,
    });
    const seguro = await send('category-create', {
      name: '🏛️ Seguro Hipoteca',
      groupId: grupo,
    });
    const hipoteca = await send('category-create', {
      name: '🏰 Hipoteca',
      groupId: grupo,
    });
    const facturas = await send('category-group-create', {
      name: 'Factures mensuals',
    });
    await send('category-create', { name: '💡 Llum', groupId: facturas });
    await send('category-create', {
      name: '🏥 Seguro salut familiar',
      groupId: facturas,
    });
    const { data: grupos } = await window.$query(
      window.$q('category_groups').select(['id', 'sort_order']),
    );
    const primero = grupos
      .filter(g => g.id !== grupo && g.id !== facturas)
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    if (primero) {
      await send('category-group-move', { id: grupo, targetId: primero.id });
      await send('category-group-move', {
        id: facturas,
        targetId: primero.id,
      });
    }
    const mes = new Date().toISOString().slice(0, 7);
    await send('budget/budget-amount', {
      month: mes,
      category: cotxe,
      amount: 24672,
    });
    await send('budget/budget-amount', {
      month: mes,
      category: hipoteca,
      amount: 2000,
    });
    const { data: cuentas } = await window.$query(
      window
        .$q('accounts')
        .filter({ offbudget: false, closed: false })
        .select('id'),
    );
    const hoy = new Date().toISOString().slice(0, 10);
    await send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: cuentas[0].id,
          date: hoy,
          amount: -3293,
          category: seguro,
        },
      ],
    });
    await send('notes-save', { id: hipoteca, note: '#template 38.47' });
    await send('budget/store-note-templates', [hipoteca]);
    await send('budget/refresh-goals', { month: mes });
  });

  const ir = async ruta => {
    await page.evaluate(r => {
      window.history.pushState({}, '', r);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, ruta);
    await esperar(page, 1500);
  };

  // ---------------------------------------------------------------- Plan
  await ir('/budget');
  const p = await page.evaluate(medirPlan);
  console.log('Plan (medidas crudas):', JSON.stringify(p));
  comprobar('nombre de categoría · px', p.nombreCategoria?.fs, 15);
  comprobar('nombre de categoría · peso', p.nombreCategoria?.fw, 500, 0);
  comprobar('emoji · px', p.emoji?.fs, 15);
  comprobar('cifra de fila · px', p.cifraFila?.fs, 14);
  comprobar('cifra de fila · peso', p.cifraFila?.fw, 600, 0);
  cierto('cifra de fila · tabular', !!p.cifraFila?.tab);
  comprobar('píldora disponible · px', p.pildora?.fs, 13);
  comprobar('gasto bajo asignado · px', p.gastoFila?.fs, 12);
  comprobar('alto fila categoría', p.altoFila?.h, 52, 1);
  cierto(
    'todas las filas sin extra = 52',
    p.altosFilas.length > 0 && p.altosFilas.every(h => Math.abs(h - 52) <= 1),
    JSON.stringify([...new Set(p.altosFilas)]),
  );
  comprobar('fila con gasto (Seguro) alto', p.seguroAlto?.h, 52, 1);
  comprobar('nombre de grupo · px', p.nombreGrupo?.fs, 15);
  comprobar('nombre de grupo · peso', p.nombreGrupo?.fw, 700, 0);
  comprobar('cifra de grupo · px', p.cifraGrupo?.fs, 13);
  comprobar('cifra de grupo · peso', p.cifraGrupo?.fw, 600, 0);
  comprobar('alto fila grupo', p.altoGrupo?.h, 46, 1);
  cierto(
    'todas las filas de grupo = 46',
    p.altosGrupos.length > 0 && p.altosGrupos.every(h => Math.abs(h - 46) <= 1),
    JSON.stringify([...new Set(p.altosGrupos)]),
  );
  comprobar('⋮ del grupo · px', p.menuGrupo?.h, 18, 0.5);
  cierto('⋮ solo en grupos', p.menusEnCategorias === 0);
  comprobar('cabecera de columnas · px', p.cabeceraColumnas?.fs, 11);
  comprobar('banner rojo · px', p.banner?.fs, 13);
  comprobar('listos para asignar · px', p.listo?.fs, 16);
  comprobar('listos para asignar · peso', p.listo?.fw, 700, 0);
  comprobar('listos para asignar · alto', p.altoListo?.h, 44, 1);
  comprobar('mes · px', p.mes?.fs, 22);
  comprobar('año · px', p.anio?.fs, 11);
  comprobar('«Seguro Hipoteca» · líneas', p.seguroLineas, 1, 0);
  cierto(
    'sangría categoría ≥ 8 px',
    p.xEmoji != null && p.xChevron != null && p.xEmoji - p.xChevron >= 8,
    `chevron x=${p.xChevron} · emoji x=${p.xEmoji}`,
  );
  cierto('sin «Faltan X» bajo las filas', p.estadoObjetivo === 0);
  cierto(
    'sin elipsis en nombres ≤ 24 car.',
    p.cortados.length === 0,
    JSON.stringify(p.cortados),
  );
  cierto(
    'ninguna letra < 11 px (Plan)',
    p.minimo.fs >= 11,
    JSON.stringify(p.minimo),
  );
  if (CON_CAPTURAS) {
    await page.screenshot({ path: path.join(capturas, 'plan-denso.png') });
  }

  // Tocar el nombre abre el teclado; si falta para el objetivo, el atajo.
  page.setDefaultTimeout(8000);
  try {
    const nombreHipoteca = page
      .locator('[data-testid="category-name"]', { hasText: /^Hipoteca$/ })
      .first();
    await nombreHipoteca.click();
    await esperar(page, 900);
    cierto(
      'tocar la fila abre el teclado',
      (await page.locator('[data-testid="assign-keypad"]').count()) === 1,
    );
    const atajo = page.locator('[data-testid="keypad-asignar-objetivo"]');
    cierto(
      'atajo «Asignar X para el objetivo»',
      (await atajo.count()) === 1,
      (await atajo.count()) ? await atajo.first().innerText() : '',
    );
    cierto(
      'sin ficha al tocar',
      (await page.locator('[role=dialog]').count()) === 0,
    );
    if (CON_CAPTURAS) {
      await page.screenshot({
        path: path.join(capturas, 'plan-denso-teclado.png'),
      });
    }
    if (await atajo.count()) {
      await atajo.first().click();
      await esperar(page, 900);
      cierto('tras asignar, el atajo desaparece', (await atajo.count()) === 0);
    }
    await page.locator('[data-testid="keypad-cancel"]').click();
    await esperar(page, 500);
    // Tocar una categoría cubierta: el teclado sale sin atajo.
    await page
      .locator('[data-testid="category-name"]', { hasText: 'Cotxe Nou' })
      .first()
      .click();
    await esperar(page, 700);
    cierto(
      'sin atajo si no falta nada',
      (await atajo.count()) === 0 &&
        (await page.locator('[data-testid="assign-keypad"]').count()) === 1,
    );
    // «Detalles» abre la ficha y la nota no enseña «#template».
    await page.locator('[data-testid="keypad-cancel"]').click();
    await esperar(page, 500);
    await nombreHipoteca.click();
    await esperar(page, 700);
    await page.locator('[data-testid="keypad-details"]').click();
    await esperar(page, 900);
    const ficha = page.locator('[role=dialog]').first();
    const textoFicha = (await ficha.count()) ? await ficha.innerText() : '';
    cierto('«Detalles» abre la ficha', textoFicha.includes('Hipoteca'));
    cierto(
      'la ficha no enseña «#template»',
      textoFicha !== '' && !textoFicha.includes('#template'),
    );
    cierto('ficha: «Sin notas»', /Sin notas|No notes/.test(textoFicha));
    if (CON_CAPTURAS) {
      await page.screenshot({
        path: path.join(capturas, 'plan-denso-ficha.png'),
      });
    }
    await page.keyboard.press('Escape');
    await esperar(page, 600);
  } catch (e) {
    cierto('interacción del teclado', false, String(e.message).split('\n')[0]);
    await page.keyboard.press('Escape').catch(() => undefined);
  }

  // ------------------------------------------------------- Asignar el mes
  await ir('/asignar');
  const a = await page.evaluate(medirLista, [
    '[data-testid="asignar-fila"]',
    '[data-testid="asignar-nombre"]',
    '[data-testid="asignar-asignado"]',
    '[data-testid="asignar-estado"]',
  ]);
  console.log('Asignar (medidas crudas):', JSON.stringify(a));
  comprobar('asignar · nombre px', a.nombre?.fs, 15);
  comprobar('asignar · nombre peso', a.nombre?.fw, 500, 0);
  comprobar('asignar · cifra px', a.cifra?.fs, 14);
  comprobar('asignar · estado px', a.estado?.fs, 12);
  comprobar('asignar · alto fila', a.fila?.h, 56, 1);
  cierto(
    'asignar · todas las filas = 56',
    a.altos.every(h => Math.abs(h - 56) <= 1),
    JSON.stringify(a.altos),
  );
  cierto(
    'ninguna letra < 11 px (Asignar)',
    a.minimo.fs >= 11,
    JSON.stringify(a.minimo),
  );
  if (CON_CAPTURAS) {
    await page.screenshot({
      path: path.join(capturas, 'plan-denso-asignar.png'),
    });
  }

  // --------------------------------------------------------- Gasto anual
  // «Deutes» como grupo anual; «Cotxe Nou» con objetivo anual de 600.
  await page.evaluate(async () => {
    const send = window.$send;
    const { data: grupos } = await window.$query(
      window.$q('category_groups').filter({ name: 'Deutes' }).select('id'),
    );
    const { data: cats } = await window.$query(
      window.$q('categories').filter({ name: '🚙 Cotxe Nou' }).select('id'),
    );
    const anio = Number(new Date().toISOString().slice(0, 4)) + 1;
    await send('notes-save', {
      id: cats[0].id,
      note: `#template 600 by ${anio}-03 repeat every year`,
    });
    await send('budget/store-note-templates', [cats[0].id]);
    await send('preferences/save', {
      id: 'anual-grupos',
      value: JSON.stringify([grupos[0].id]),
    });
  });
  await ir('/anual');
  const g = await page.evaluate(medirLista, [
    '[data-testid="anual-fila"]',
    '[data-testid="anual-nombre"]',
    '[data-testid="anual-importe"]',
    '[data-testid="anual-estado"]',
  ]);
  console.log('Anual (medidas crudas):', JSON.stringify(g));
  cierto('anual · hay filas', g.n > 0, String(g.n));
  comprobar('anual · nombre px', g.nombre?.fs, 15);
  comprobar('anual · nombre peso', g.nombre?.fw, 500, 0);
  comprobar('anual · cifra px', g.cifra?.fs, 14);
  comprobar('anual · estado px', g.estado?.fs, 12);
  comprobar('anual · alto fila', g.fila?.h, 56, 1);
  cierto(
    'anual · todas las filas = 56',
    g.altos.every(h => Math.abs(h - 56) <= 1),
    JSON.stringify(g.altos),
  );
  cierto(
    'ninguna letra < 11 px (Anual)',
    g.minimo.fs >= 11,
    JSON.stringify(g.minimo),
  );
  if (CON_CAPTURAS) {
    await page.screenshot({
      path: path.join(capturas, 'plan-denso-anual.png'),
    });
  }
} finally {
  await navegador.close();
  servidor.kill();
}

for (const l of tabla) console.log(l);
console.log(`${fallos.length} problema(s) de densidad`);
process.exit(fallos.length ? 1 : 0);
