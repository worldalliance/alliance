import React from "react";
import ReactDOM from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import "./index.css";
import { captureRouteError } from "./lib/analytics";
import { start } from "./start";

void start(() =>
  ReactDOM.hydrateRoot(
    document,
    <React.StrictMode>
      <HydratedRouter onError={captureRouteError} />
    </React.StrictMode>,
  ),
);
