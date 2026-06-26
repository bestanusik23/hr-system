import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "hr" | "head" | "deputy" | "deputyHR" | "admin";
  role_2: string | null;
  role_3: string | null;
  role_title: string | null;
  scope_division_id: number | null;
  scope_department_id: number | null;
  color: string | null;
  initial: string | null;
}

export function hasRole(user: User | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.some(r => r === user.role || r === user.role_2 || r === user.role_3);
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() as Promise<{ ok: boolean; user: User }> : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string): Promise<string | null> {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json() as { ok: boolean; user?: User; error?: string };
    if (d.ok && d.user) { setUser(d.user); return null; }
    return d.error ?? "เกิดข้อผิดพลาด";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
