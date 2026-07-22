import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../lib/api";
import { Button, ErrorBanner, Field, Input } from "../components/ui";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as LocationState)?.from?.pathname ?? "/";

  // Redirect declaratively — navigating during render logs a React warning and
  // can fire twice in StrictMode.
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-100 via-canvas to-brand-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-soft">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">PlantView</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-7"
        >
          <Field label="Email">
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              // Phone keyboards otherwise capitalise and autocorrect an address.
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
