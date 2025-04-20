import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import IssuesListPage from "./pages/IssuesListPage";
import IssuePage from "./pages/IssuePage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/issues" element={<IssuesListPage />} />
        <Route path="/issues/:issue" element={<IssuePage />} />
      </Routes>
    </Router>
  );
}

export default App;
