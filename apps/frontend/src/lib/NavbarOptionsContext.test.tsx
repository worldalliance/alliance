import { renderHook } from "@testing-library/react";
import { useContext } from "react";
import {
  ImmersiveTone,
  NavbarOptionsContext,
  NavbarOptionsProvider,
  useImmersiveChrome,
  useImmersiveNavbar,
} from "./NavbarOptionsContext";

const renderImmersive = (immersive: boolean) =>
  renderHook(
    ({ immersive }) => {
      useImmersiveNavbar({ immersive, tone: ImmersiveTone.Success });
      return useContext(NavbarOptionsContext)?.options;
    },
    { wrapper: NavbarOptionsProvider, initialProps: { immersive } },
  );

const rootImmersive = () => "immersive" in document.documentElement.dataset;

describe("useImmersiveNavbar", () => {
  it("collapses the nav and locks the root's scroll while asked", () => {
    const hook = renderImmersive(true);
    expect(hook.result.current).toMatchObject({
      immersive: true,
      immersiveTone: ImmersiveTone.Success,
    });
    expect(rootImmersive()).toBe(true);

    hook.rerender({ immersive: false });
    expect(hook.result.current?.immersive).toBe(false);
    expect(rootImmersive()).toBe(false);
  });

  it("restores the nav and the root's scroll on unmount", () => {
    const hook = renderImmersive(true);
    hook.unmount();
    expect(rootImmersive()).toBe(false);
  });

  it("leaves the nav alone when not asked", () => {
    const hook = renderImmersive(false);
    expect(hook.result.current?.immersive).toBeUndefined();
    expect(rootImmersive()).toBe(false);
  });
});

describe("useImmersiveChrome", () => {
  it.each([
    [true, true],
    [false, false],
  ])(
    "turns green on a success tone only while immersive (%s)",
    (immersive, success) => {
      const hook = renderHook(() => useImmersiveChrome(), {
        wrapper: ({ children }) => (
          <NavbarOptionsContext.Provider
            value={{
              options: { immersive, immersiveTone: ImmersiveTone.Success },
              setOptions: () => {},
            }}
          >
            {children}
          </NavbarOptionsContext.Provider>
        ),
      });
      expect(hook.result.current).toEqual({ immersive, success });
    },
  );
});
