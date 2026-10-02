import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';

import { useScrollListener } from '#hooks/useScrollListener';

import { Icono } from './ui/Icono';
import type { NombreIcono } from './ui/Icono';
import { color, movimiento, radio, sombra } from './ui/tokens';

// Barra de pestañas flotante en cápsula (concepto A · Cartera): 5 pestañas
// fijas. Lo demás (Pagos programados, Reglas, Beneficiarios, Sincronización,
// Ajustes) vive en la página «Más» (/mas), enlazada desde Cuentas y Ajustes.
const ALTO_PESTANA = 52;
const RELLENO = 6;
const MARGEN = 10;
const ALTO_CAPSULA = ALTO_PESTANA + RELLENO * 2;

/** Hueco que deben reservar las páginas al final para no quedar tapadas. */
export const MOBILE_NAV_HEIGHT = ALTO_CAPSULA + MARGEN * 2;

type Pestana = { nombre: string; ruta: string; icono: NombreIcono };

export function MobileNavTabs() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const [estado, setEstado] = useState<'default' | 'hidden'>('default');

  const pestanas: Pestana[] = [
    { nombre: t('Home'), ruta: '/inicio', icono: 'home' },
    { nombre: t('Plan'), ruta: '/budget', icono: 'plan' },
    { nombre: t('Spending'), ruta: '/gastos', icono: 'receipt' },
    { nombre: t('Accounts'), ruta: '/accounts', icono: 'wallet' },
    { nombre: t('Reports'), ruta: '/reports', icono: 'pie' },
  ];

  useScrollListener(
    useCallback(({ isScrolling, hasScrolledToEnd }) => {
      if (isScrolling('down') && !hasScrolledToEnd('up')) {
        setEstado('hidden');
      } else if (isScrolling('up') && !hasScrolledToEnd('down')) {
        setEstado('default');
      }
    }, []),
  );

  if (!isNarrowWidth) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label={t('Main')}
      data-navbar-state={estado}
      style={{
        position: 'fixed',
        left: MARGEN,
        right: MARGEN,
        bottom: `calc(${MARGEN}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 100,
        display: 'grid',
        gridTemplateColumns: `repeat(${pestanas.length}, 1fr)`,
        gap: 2,
        padding: RELLENO,
        borderRadius: radio.heroe,
        backgroundColor: color.surface2,
        boxShadow: sombra.tarjeta,
        transform:
          estado === 'hidden'
            ? `translateY(calc(100% + ${MARGEN * 2}px))`
            : 'translateY(0)',
        transition: `transform ${movimiento.hoja}ms ${movimiento.muelle}`,
      }}
    >
      {pestanas.map(p => (
        <NavLink
          key={p.ruta}
          to={p.ruta}
          onClick={() => setEstado('default')}
          style={({ isActive }) => ({
            ...styles.noTapHighlight,
            minHeight: ALTO_PESTANA,
            minWidth: 0,
            borderRadius: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            textDecoration: 'none',
            userSelect: 'none',
            fontSize: 10.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: isActive ? color.accent : color.fg3,
            backgroundColor: isActive ? color.accentSoft : 'transparent',
            transition: `background-color ${movimiento.pildora}ms, color ${movimiento.pildora}ms`,
          })}
        >
          <Icono nombre={p.icono} size={21} />
          {p.nombre}
        </NavLink>
      ))}
      <style>
        {'@media (prefers-reduced-motion: reduce){nav[data-navbar-state]{transition:none!important}}' +
          // Con el teclado de asignar abierto, la barra se retira del todo.
          `body[data-teclado-abierto] nav[data-navbar-state]{transform:translateY(calc(100% + ${MARGEN * 2}px))!important;pointer-events:none}`}
      </style>
    </nav>
  );
}
