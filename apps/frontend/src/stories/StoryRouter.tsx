import NavbarHorizontal from "../components/NavbarHorizontal";
import { NavbarPage } from "../components/Navbar";
import { Navigate, Routes, Route, MemoryRouter } from "react-router";

interface StoryRouterProps {
  children: React.ReactNode;
  initialEntry: string;
  path: string;
}

const StoryRouter = ({ children, initialEntry, path }: StoryRouterProps) => {
  return (
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
  );
};

export default StoryRouter;
