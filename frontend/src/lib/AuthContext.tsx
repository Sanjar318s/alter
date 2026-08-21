"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth } from "@/lib/api";

export type PlatformRole = "client" | "blogger" | "seller";

interface User {
  id: string;
  email: string;
  username: string;
  roleFlags?: string;
  avatarUrl?: string;
  platformRole?: PlatformRole | null;
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
  return {
    id: data.user.id,
    email: data.user.email,
    username: data.user.username,
    roleFlags: data.user.roleFlags,
    avatarUrl: data.profile?.avatarUrl,
    platformRole,
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
    if (token) {
      loadMe()
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "";
          if (typeof window !== "undefined" && msg.includes("заблокированы")) {
            sessionStorage.setItem("alter_block_notice", msg);
          }
          localStorage.removeItem("alter_token");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
