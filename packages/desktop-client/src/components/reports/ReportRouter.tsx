import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Route, Routes, useLocation } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { AnalisisPage } from '#components/mobile/analisis/AnalisisPage';
import { CategoriaPage } from '#components/mobile/informes/CategoriaPage';
import { EdadDineroPage } from '#components/mobile/informes/EdadDineroPage';
import { GastoMesPage } from '#components/mobile/informes/GastoMesPage';
import { InformesPage } from '#components/mobile/informes/InformesPage';
import { IngresosGastosPage } from '#components/mobile/informes/IngresosGastosPage';
import { NominasPage } from '#components/mobile/informes/NominasPage';
import { PatrimonioPage } from '#components/mobile/informes/PatrimonioPage';
import { SubeBajaPage } from '#components/mobile/informes/SubeBajaPage';
import { useFeatureFlag } from '#hooks/useFeatureFlag';

import { AgeOfMoney } from './reports/AgeOfMoney';
import { BalanceForecast } from './reports/BalanceForecast';
import { BudgetAnalysis } from './reports/BudgetAnalysis';
import { Calendar } from './reports/Calendar';
import { CashFlow } from './reports/CashFlow';
import { Crossover } from './reports/Crossover';
import { CustomReport } from './reports/CustomReport';
import { Formula } from './reports/Formula';
import { MonteCarlo } from './reports/monte-carlo/MonteCarlo';
import { NetWorth } from './reports/NetWorth';
import { Sankey } from './reports/Sankey';
import { Spending } from './reports/Spending';
import { Summary } from './reports/Summary';
import { ReportsDashboardRouter } from './ReportsDashboardRouter';

function ReportBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={FeatureErrorFallback}
      resetKeys={[location.pathname]}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Presupuesto: en el móvil la pestaña Informes es la página de tarjetas
 * (`InformesPage`); en escritorio se mantiene el panel de Actual.
 */
function PortadaInformes() {
  const { isNarrowWidth } = useResponsive();
  if (isNarrowWidth) {
    return (
      <ReportBoundary>
        <InformesPage />
      </ReportBoundary>
    );
  }
  return <ReportsDashboardRouter />;
}

const RUTAS_INFORMES: Array<[string, () => ReactNode]> = [
  ['/gasto', () => <GastoMesPage />],
  ['/ingresos-gastos', () => <IngresosGastosPage />],
  ['/categoria', () => <CategoriaPage />],
  ['/categoria/:id', () => <CategoriaPage />],
  ['/sube-baja', () => <SubeBajaPage />],
  ['/patrimonio', () => <PatrimonioPage />],
  ['/edad-dinero', () => <EdadDineroPage />],
  ['/nominas', () => <NominasPage />],
  ['/analisis', () => <AnalisisPage />],
];

export function ReportRouter() {
  const balanceForecastReportEnabled = useFeatureFlag('balanceForecastReport');
  const budgetAnalysisReportEnabled = useFeatureFlag('budgetAnalysisReport');
  const sankeyReportEnabled = useFeatureFlag('sankeyReport');
  const monteCarloReportEnabled = useFeatureFlag('monteCarloReport');

  return (
    <Routes>
      <Route path="/" element={<PortadaInformes />} />
      <Route path="/:dashboardId" element={<PortadaInformes />} />
      {RUTAS_INFORMES.map(([ruta, render]) => (
        <Route
          key={ruta}
          path={ruta}
          element={<ReportBoundary>{render()}</ReportBoundary>}
        />
      ))}
      <Route
        path="/net-worth"
        element={
          <ReportBoundary>
            <NetWorth />
          </ReportBoundary>
        }
      />
      <Route
        path="/net-worth/:id"
        element={
          <ReportBoundary>
            <NetWorth />
          </ReportBoundary>
        }
      />
      <Route
        path="/crossover"
        element={
          <ReportBoundary>
            <Crossover />
          </ReportBoundary>
        }
      />
      <Route
        path="/crossover/:id"
        element={
          <ReportBoundary>
            <Crossover />
          </ReportBoundary>
        }
      />
      <Route
        path="/age-of-money"
        element={
          <ReportBoundary>
            <AgeOfMoney />
          </ReportBoundary>
        }
      />
      <Route
        path="/age-of-money/:id"
        element={
          <ReportBoundary>
            <AgeOfMoney />
          </ReportBoundary>
        }
      />
      <Route
        path="/cash-flow"
        element={
          <ReportBoundary>
            <CashFlow />
          </ReportBoundary>
        }
      />
      <Route
        path="/cash-flow/:id"
        element={
          <ReportBoundary>
            <CashFlow />
          </ReportBoundary>
        }
      />
      <Route
        path="/custom"
        element={
          <ReportBoundary>
            <CustomReport />
          </ReportBoundary>
        }
      />
      <Route
        path="/custom/:id"
        element={
          <ReportBoundary>
            <CustomReport />
          </ReportBoundary>
        }
      />
      <Route
        path="/spending"
        element={
          <ReportBoundary>
            <Spending />
          </ReportBoundary>
        }
      />
      <Route
        path="/spending/:id"
        element={
          <ReportBoundary>
            <Spending />
          </ReportBoundary>
        }
      />
      {budgetAnalysisReportEnabled && (
        <>
          <Route
            path="/budget-analysis"
            element={
              <ReportBoundary>
                <BudgetAnalysis />
              </ReportBoundary>
            }
          />
          <Route
            path="/budget-analysis/:id"
            element={
              <ReportBoundary>
                <BudgetAnalysis />
              </ReportBoundary>
            }
          />
        </>
      )}
      <Route
        path="/summary"
        element={
          <ReportBoundary>
            <Summary />
          </ReportBoundary>
        }
      />
      <Route
        path="/summary/:id"
        element={
          <ReportBoundary>
            <Summary />
          </ReportBoundary>
        }
      />
      <Route
        path="/calendar"
        element={
          <ReportBoundary>
            <Calendar />
          </ReportBoundary>
        }
      />
      <Route
        path="/calendar/:id"
        element={
          <ReportBoundary>
            <Calendar />
          </ReportBoundary>
        }
      />
      <Route
        path="/formula"
        element={
          <ReportBoundary>
            <Formula />
          </ReportBoundary>
        }
      />
      <Route
        path="/formula/:id"
        element={
          <ReportBoundary>
            <Formula />
          </ReportBoundary>
        }
      />
      {balanceForecastReportEnabled && (
        <>
          <Route
            path="/forecast"
            element={
              <ReportBoundary>
                <BalanceForecast />
              </ReportBoundary>
            }
          />
          <Route
            path="/forecast/:id"
            element={
              <ReportBoundary>
                <BalanceForecast />
              </ReportBoundary>
            }
          />
        </>
      )}
      {monteCarloReportEnabled && (
        <>
          <Route
            path="/monte-carlo"
            element={
              <ReportBoundary>
                <MonteCarlo />
              </ReportBoundary>
            }
          />
          <Route
            path="/monte-carlo/:id"
            element={
              <ReportBoundary>
                <MonteCarlo />
              </ReportBoundary>
            }
          />
        </>
      )}
      {sankeyReportEnabled && (
        <>
          <Route
            path="/sankey"
            element={
              <ReportBoundary>
                <Sankey />
              </ReportBoundary>
            }
          />
          <Route
            path="/sankey/:id"
            element={
              <ReportBoundary>
                <Sankey />
              </ReportBoundary>
            }
          />
        </>
      )}
    </Routes>
  );
}
