import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export enum ImmersiveTone {
  Plain = "plain",
  /** Green, behind the flow's completion screen. */
  Success = "success",
}

export interface NavbarOptions {
  whiteBackground?: boolean;
  noBorder?: boolean;
  /** Collapses the side nav to its icons and hides search and notifications. */
  immersive?: boolean;
  immersiveTone?: ImmersiveTone;
}

interface NavbarOptionsContextValue {
  options: NavbarOptions;
  setOptions: (opts: Partial<NavbarOptions>) => void;
}

export const NavbarOptionsContext = createContext<
  NavbarOptionsContextValue | undefined
>(undefined);

export function NavbarOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptionsState] = useState<NavbarOptions>({});

  const setOptions = useCallback((opts: Partial<NavbarOptions>) => {
    setOptionsState((prev) => ({ ...prev, ...opts }));
  }, []);

  const value = useMemo(() => ({ options, setOptions }), [options, setOptions]);

  return (
    <NavbarOptionsContext.Provider value={value}>
      {children}
    </NavbarOptionsContext.Provider>
  );
}

export function useNavbarOptions(opts: NavbarOptions) {
  const setOptions = useContext(NavbarOptionsContext)?.setOptions;

  useEffect(() => {
    if (!setOptions) {
      return;
    }
    setOptions({
      whiteBackground: opts.whiteBackground,
      noBorder: opts.noBorder,
    });
    return () => setOptions({ whiteBackground: false, noBorder: false });
  }, [opts.whiteBackground, opts.noBorder, setOptions]);
}

export function useImmersiveNavbar({
  immersive,
  tone,
}: {
  immersive: boolean;
  tone: ImmersiveTone;
}) {
  const setOptions = useContext(NavbarOptionsContext)?.setOptions;

  useEffect(() => {
    if (!setOptions || !immersive) return;
    setOptions({ immersive: true, immersiveTone: tone });
    // Fixed panels can't cover the root's reserved scrollbar gutter.
    document.documentElement.dataset.immersive = "";
    return () => {
      setOptions({ immersive: false, immersiveTone: undefined });
      delete document.documentElement.dataset.immersive;
    };
  }, [immersive, tone, setOptions]);
}

const SUCCESS_CHROME: Record<ImmersiveTone, boolean> = {
  [ImmersiveTone.Plain]: false,
  [ImmersiveTone.Success]: true,
};

/** Whether the nav is immersive, and whether its chrome is the success green. */
export function useImmersiveChrome() {
  const options = useContext(NavbarOptionsContext)?.options;
  const immersive = options?.immersive ?? false;
  const tone = options?.immersiveTone ?? ImmersiveTone.Plain;
  return { immersive, success: immersive && SUCCESS_CHROME[tone] };
}
