import { NodeEnv } from "@alliance/common/node-env";
import { setWebRuntimeConfig } from "@alliance/sharedweb/lib/runtimeConfig";
import { deployedWebRuntimeConfig } from "@alliance/sharedweb/lib/testing/runtimeConfig";
import { render } from "@testing-library/react";
import { expect, it } from "bun:test";
import EnvironmentBadge from "./EnvironmentBadge";

it.each([
  [NodeEnv.Production, false, "Production"],
  [NodeEnv.Production, true, "Prod"],
  [NodeEnv.Staging, false, "Staging"],
  [NodeEnv.Staging, true, "Stg"],
] as const)("marks %s (collapsed %p) as %s", (environment, collapsed, text) => {
  setWebRuntimeConfig(deployedWebRuntimeConfig(environment));
  const { container } = render(<EnvironmentBadge collapsed={collapsed} />);
  expect(container.textContent).toBe(text);
});

it("marks tests and local runs as Local", () => {
  const { container } = render(<EnvironmentBadge collapsed={false} />);
  expect(container.textContent).toBe("Local");
});
