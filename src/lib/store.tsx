import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserProfile, Product, ProcurementItem } from "./types";
import type { AuthUserProfile } from "./api/apiClient";
import { INITIAL_PRODUCTS, INITIAL_PROCUREMENT } from "./mock-data";
import { setTokens, clearTokens, logout, tryRestoreSession } from "./api/adminApi";

const USER_KEY = "bajaru_user";

export type { UserProfile, Product, ProcurementItem };

// ── Auth state ────────────────────────────────────────────────────────────────

interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
  user: AuthUserProfile | null;
}

type AppContextType = {
  // Auth
  isAuthenticated: boolean;
  isRestoring: boolean;
  authUser: AuthUserProfile | null;
  signIn: (auth: AuthState) => void;
  signOut: () => void;

  // Data (mock while features are being wired to real API)
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  procurementItems: ProcurementItem[];
  setProcurementItems: React.Dispatch<React.SetStateAction<ProcurementItem[]>>;

  // User profile (display only)
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null);
  const [refreshTokenRef, setRefreshTokenRef] = useState("");

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [procurementItems, setProcurementItems] = useState<ProcurementItem[]>(INITIAL_PROCUREMENT);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "Admin User",
    role: "Store Manager",
    avatarUrl: "",
  });

  // Restore session on mount
  useEffect(() => {
    tryRestoreSession().then((ok) => {
      if (ok) {
        try {
          const raw = localStorage.getItem(USER_KEY);
          const user: AuthUserProfile | null = raw ? JSON.parse(raw) : null;
          if (user) {
            setAuthUser(user);
            setRefreshTokenRef(""); // refreshToken is in tokenStore, not needed here
            setUserProfile({
              name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Admin",
              role: user.role ?? "Admin",
              avatarUrl: user.profilePictureUrl ?? "",
            });
          }
          setIsAuthenticated(!!user);
        } catch {
          setIsAuthenticated(false);
        }
      }
      setIsRestoring(false);
    });
  }, []);

  const signIn = (auth: AuthState) => {
    setTokens({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt,
    });
    if (auth.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    }
    setAuthUser(auth.user);
    setRefreshTokenRef(auth.refreshToken);
    if (auth.user) {
      setUserProfile({
        name: [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") || "Admin",
        role: auth.user.role ?? "Admin",
        avatarUrl: auth.user.profilePictureUrl ?? "",
      });
    }
    setIsAuthenticated(true);
  };

  const signOut = async () => {
    try {
      await logout(refreshTokenRef);
    } catch {
      clearTokens();
    }
    localStorage.removeItem(USER_KEY);
    setIsAuthenticated(false);
    setAuthUser(null);
    setRefreshTokenRef("");
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isRestoring,
        authUser,
        signIn,
        signOut,
        products,
        setProducts,
        procurementItems,
        setProcurementItems,
        userProfile,
        setUserProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within an AppProvider");
  return context;
}
