import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { navItemFor } from "./nav/navConfig";
import { AdminPage } from "./pages/AdminPage";
import { ContractsPage } from "./pages/ContractsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ItemsPage } from "./pages/ItemsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotAuthorizedPage } from "./pages/NotAuthorizedPage";
import { ReceivingPage } from "./pages/ReceivingPage";
import { SalesPage } from "./pages/SalesPage";
import { SettlementPage } from "./pages/SettlementPage";
import { TraceabilityPage } from "./pages/TraceabilityPage";
import { VendorsPage } from "./pages/VendorsPage";

function guarded(path: string, element: JSX.Element): JSX.Element {
  const item = navItemFor(path);
  return <RequireRole allowed={item?.allowed ?? "any"}>{element}</RequireRole>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="vendors" element={guarded("/vendors", <VendorsPage />)} />
          <Route path="items" element={guarded("/items", <ItemsPage />)} />
          <Route path="contracts" element={guarded("/contracts", <ContractsPage />)} />
          <Route path="receiving" element={guarded("/receiving", <ReceivingPage />)} />
          <Route path="sales" element={guarded("/sales", <SalesPage />)} />
          <Route path="traceability" element={guarded("/traceability", <TraceabilityPage />)} />
          <Route path="settlement" element={guarded("/settlement", <SettlementPage />)} />
          <Route path="admin" element={guarded("/admin", <AdminPage />)} />
          <Route path="*" element={<NotAuthorizedPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
