import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import GraphPage from "./pages/GraphPage";
import SustainabilityPage from "./pages/SustainabilityPage";
import SimulatorPage from "./pages/SimulatorPage";
import { TourProvider } from "./components/tour/TourContext";
import { NotificationProvider } from "./components/notifications/NotificationContext";

export default function App() {
  return (
    <NotificationProvider>
    <TourProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/sustainability" element={<SustainabilityPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </TourProvider>
    </NotificationProvider>
  );
}
