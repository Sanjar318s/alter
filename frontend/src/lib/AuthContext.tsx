"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth } from "@/lib/api";

export type PlatformRole = "client" | "blogger" | "seller";
export type StaffRole = "none" | "owner" | "admin";

interface User {
  id: string;
  email: string;
  username: string;
  roleFlags?: string;
  avatarUrl?: string;
  platformRole?: PlatformRole | null;
  socialCrosspostOptIn?: boolean;
  staffRole?: StaffRole;
}

type RegisterStart = {
  pendingId: string;
  channel: "email" | "phone";
  maskedTarget: string;
  expiresIn: number;
  resendIn: number;
  devCode?: string;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  startRegister: (data: {
    username: string;
    password: string;
    roleFlags?: string;
    method: "email" | "phone";
    email?: string;
    phone?: string;
  }) => Promise<RegisterStart>;
  verifyRegister: (pendingId: string, code: string) => Promise<User>;
  resendRegister: (pendingId: string) => Promise<RegisterStart>;
  refresh: () => Promise<void>;
  logout: () => void;
}

function mapUser(data: { user: any; profile?: any }): User {
  const raw = data.user.platformRole;
  const platformRole: PlatformRole | null =
    raw === "client" || raw === "blogger" || raw === "seller" ? raw : null;
  const rawRole = data.profile?.staffRole;
  const staffRole: StaffRole =
    rawRole === "owner" || rawRole === "admin" ? rawRole : "none";
  return {
    id: data.user.id,
    email: data.user.email,
    username: data.user.username,
    roleFlags: data.user.roleFlags,
    avatarUrl: data.profile?.avatarUrl,
    platformRole,
    socialCrosspostOptIn: data.user.socialCrosspostOptIn !== false && data.user.socialCrosspostOptIn !== 0,
    staffRole,
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  startRegister: async () => ({
    pendingId: "",
    channel: "email",
    maskedTarget: "",
    expiresIn: 0,
    resendIn: 0,
  }),
  verifyRegister: async () => ({ id: "", email: "", username: "" }),
  resendRegister: async () => ({
    pendingId: "",
    channel: "email",
    maskedTarget: "",
    expiresIn: 0,
    resendIn: 0,
  }),
  refresh: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const data = await auth.me();
    setUser(mapUser(data));
  }

  useEffect(() => {
    const token = localStorage.getItem("alter_token");
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function tryLoad(): Promise<"ok" | "fatal" | "transient"> {
      try {
        const data = await auth.me();
        if (cancelled) return "ok";
        setUser(mapUser(data));
        return "ok";
      } catch (err) {
        if (cancelled) return "ok";
        const status = (err as { status?: number }).status;
        const msg = err instanceof Error ? err.message : "";
        if (status === 401 || (typeof window !== "undefined" && msg.includes("заблокированы"))) {
          if (msg.includes("заблокированы")) {
            sessionStorage.setItem("alter_block_notice", msg);
          }
          localStorage.removeItem("alter_token");
          setUser(null);
          return "fatal";
        }
        return "transient";
      }
    }

    (async () => {
      let result = await tryLoad();
      for (let attempt = 0; attempt < 2 && result === "transient" && !cancelled; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        result = await tryLoad();
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (emailOrPhone: string, password: string) => {
    const ident = emailOrPhone.trim();
    const data = ident.includes("@")
      ? await auth.login({ email: ident.toLowerCase(), password })
      : await auth.login({ phone: ident, password });
    localStorage.setItem("alter_token", data.token);
    try {
      await loadMe();
    } catch {
      setUser(mapUser({ user: data.user }));
    }
  };

  const startRegister: AuthContextType["startRegister"] = (payload) => auth.register(payload);

  const verifyRegister = async (pendingId: string, code: string) => {
    const data = await auth.verify({ pendingId, code });
    localStorage.setItem("alter_token", data.token);
    try {
      await loadMe();
    } catch {
      setUser(mapUser({ user: data.user }));
    }
    return mapUser({ user: data.user });
  };

  const resendRegister: AuthContextType["resendRegister"] = (pendingId) =>
    auth.resend({ pendingId });

  const logout = () => {
    auth.logout().catch(() => {});
    localStorage.removeItem("alter_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, startRegister, verifyRegister, resendRegister, refresh: loadMe, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
