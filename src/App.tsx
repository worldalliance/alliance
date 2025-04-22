import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import IssuesListPage from "./pages/IssuesListPage";
import IssuePage from "./pages/IssuePage";
import Navbar, { NavbarPage } from "./components/Navbar";
import ActionPage from "./pages/ActionPage";

function App() {
  return (
    <>
      <Router>
        <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/action/:id" element={<ActionPage />} />
          <Route path="/issues" element={<IssuesListPage />} />
          <Route path="/issues/:issue" element={<IssuePage />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
