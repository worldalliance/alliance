import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import TimelineRedirect from "./TimelineRedirect";

const Location = () => {
  const { pathname, search } = useLocation();
  return <p>{pathname + search}</p>;
};

it("sends the old timeline route to the actions timeline view", () => {
  render(
    <MemoryRouter initialEntries={["/timeline"]}>
      <Routes>
        <Route path="/timeline" element={<TimelineRedirect />} />
        <Route path="/actions" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("/actions?view=timeline")).toBeTruthy();
});
