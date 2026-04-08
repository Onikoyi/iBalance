import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FiscalPeriodsPage } from './pages/FiscalPeriodsPage';
import { JournalsPage } from './pages/JournalsPage';
import { ReportsPage } from './pages/ReportsPage';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/journals" element={<JournalsPage />} />
        <Route path="/fiscal-periods" element={<FiscalPeriodsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </AppShell>
  );
}