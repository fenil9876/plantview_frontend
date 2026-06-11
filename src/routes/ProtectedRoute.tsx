import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "../components/ui";
import type { Role } from "../lib/types";

interface Props {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-card">
          <h2 className="text-lg font-semibold text-slate-800">Access denied</h2>
          <p className="mt-1 text-sm text-slate-500">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
