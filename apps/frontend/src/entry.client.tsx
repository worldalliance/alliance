import React from "react";
import ReactDOM from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import "./index.css";
import { hydrateAfterCapture } from "./lib/linkOpenings";

void hydrateAfterCapture(() => {
  ReactDOM.hydrateRoot(
    document,
    <React.StrictMode>
      <HydratedRouter />
    </React.StrictMode>,
  );
});
