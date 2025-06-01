import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  UNSAFE_LocationContext,
} from "react-router-dom";
import NavbarHorizontal from "../components/NavbarHorizontal";
import { NavbarPage } from "../components/Navbar";

interface StoryRouterProps {
  children: React.ReactNode;
  initialEntry: string;
  path: string;
}

const StoryRouter = ({ children, initialEntry, path }: StoryRouterProps) => {
  return (
    <UNSAFE_LocationContext.Provider value={null as unknown as never}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path={path}
            element={
              <>
                <NavbarHorizontal currentPage={NavbarPage.Dashboard} />
                {children}
              </>
            }
          />
          <Route path="*" element={<Navigate to={path} />} />
        </Routes>
      </MemoryRouter>
    </UNSAFE_LocationContext.Provider>
  );
};

export default StoryRouter;
