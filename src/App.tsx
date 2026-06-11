import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Spinner } from "./components/ui";

// Code-split each page so heavy deps (e.g. charts) load only when needed.
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const MachinesPage = lazy(() =>
  import("./pages/MachinesPage").then((m) => ({ default: m.MachinesPage })),
);
const TemplatesPage = lazy(() =>
  import("./pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })),
);
const TemplateBuilderPage = lazy(() =>
  import("./pages/TemplateBuilderPage").then((m) => ({ default: m.TemplateBuilderPage })),
);
const TemplateDetailPage = lazy(() =>
  import("./pages/TemplateDetailPage").then((m) => ({ default: m.TemplateDetailPage })),
);
const BatchesPage = lazy(() =>
  import("./pages/BatchesPage").then((m) => ({ default: m.BatchesPage })),
);
const BatchDetailPage = lazy(() =>
  import("./pages/BatchDetailPage").then((m) => ({ default: m.BatchDetailPage })),
);
const InventoryPage = lazy(() =>
  import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage })),
);
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const UsersPage = lazy(() => import("./pages/UsersPage").then((m) => ({ default: m.UsersPage })));
const ChangePasswordPage = lazy(() =>
  import("./pages/ChangePasswordPage").then((m) => ({ default: m.ChangePasswordPage })),
);

const adminRoute = (el: React.ReactNode) => <ProtectedRoute roles={["admin"]}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner label="Loading…" />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="/templates" element={adminRoute(<TemplatesPage />)} />
              <Route path="/templates/new" element={adminRoute(<TemplateBuilderPage />)} />
              <Route path="/templates/:id" element={adminRoute(<TemplateDetailPage />)} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/batches/:id" element={<BatchDetailPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/design" element={<DesignPage />} />
              <Route path="/machines" element={adminRoute(<MachinesPage />)} />
              <Route path="/users" element={adminRoute(<UsersPage />)} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
