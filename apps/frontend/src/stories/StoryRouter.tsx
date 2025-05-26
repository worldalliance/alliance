import {
  MemoryRouter,
  Route,
  Routes,
  UNSAFE_LocationContext,
} from "react-router-dom";

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
          <Route path={path} element={children} />
        </Routes>
      </MemoryRouter>
    </UNSAFE_LocationContext.Provider>
  );
};

export default StoryRouter;
