import { defineAllianceApiConfig } from "../../shared/openapi-config";

export default defineAllianceApiConfig({
  output: "./src/client",
  runtimeConfigPath: "./src/hey-api.ts",
});
