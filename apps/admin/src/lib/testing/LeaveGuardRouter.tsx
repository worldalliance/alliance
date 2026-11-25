import { createContext, useContext, useState, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";

const Children = createContext<ReactNode>(null);
const Slot = () => useContext(Children);

/**
 * A test wrapper that renders its children on one data router under
 * `LeaveGuard`, kept across rerenders, for code that uses `useLeaveGuard`.
 */
export function LeaveGuardRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: "*",
        element: (
          <LeaveGuard>
            <Slot />
          </LeaveGuard>
        ),
      },
    ]),
  );
  return (
    <Children.Provider value={children}>
      <RouterProvider router={router} />
    </Children.Provider>
  );
}
