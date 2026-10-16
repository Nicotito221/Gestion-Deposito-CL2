import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import tbarLogo from "../../assets/tbar-logo.png";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(usuario.trim(), password);
      navigate("/inicio");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error al iniciar sesión. Verifique sus credenciales.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src={tbarLogo} alt="TBAR" className="h-16 w-auto object-contain mb-2" />
          <h1 className="text-lg font-extrabold tracking-widest text-slate-900">FLOW</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Forecast &amp; Logistics Operations Workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-7">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => { setUsuario(e.target.value); setError(""); }}
                placeholder="Ingresá tu usuario"
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 text-slate-900 placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 text-slate-900 placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !usuario || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={15} />
              )}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Solo personal autorizado
        </p>
      </div>
    </div>
  );
}
