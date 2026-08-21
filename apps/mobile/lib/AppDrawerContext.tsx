import { usePathname } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AppDrawerContextValue = {
  isOpen: boolean;
  isPermanent: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);

export function AppDrawerProvider({
  children,
  isPermanent,
}: {
  children: React.ReactNode;
  isPermanent: boolean;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isPermanent) {
      setIsMobileOpen(false);
    }
  }, [isPermanent]);

  // Auto-close drawer when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const openDrawer = useCallback(() => {
    if (!isPermanent) {
      setIsMobileOpen(true);
    }
  }, [isPermanent]);

  const closeDrawer = useCallback(() => {
    if (!isPermanent) {
      setIsMobileOpen(false);
    }
  }, [isPermanent]);

  const toggleDrawer = useCallback(() => {
    if (!isPermanent) {
      setIsMobileOpen((current) => !current);
    }
  }, [isPermanent]);

  const value = useMemo(
    () => ({
      isOpen: isPermanent || isMobileOpen,
      isPermanent,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [closeDrawer, isMobileOpen, isPermanent, openDrawer, toggleDrawer],
  );

  return (
    <AppDrawerContext.Provider value={value}>
      {children}
    </AppDrawerContext.Provider>
  );
}

export function useAppDrawer() {
  const context = useContext(AppDrawerContext);

  if (!context) {
    throw new Error("useAppDrawer must be used inside AppDrawerProvider");
  }

  return context;
}
