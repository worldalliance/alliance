import { defineAllianceApiConfig } from "./openapi-config";

export default defineAllianceApiConfig({
  output: "./client",
  runtimeConfigPath: "./lib/hey-api.ts",
});
