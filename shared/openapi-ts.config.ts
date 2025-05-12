import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:3005/openapi.yaml",
  output: "./client",
  plugins: ["@hey-api/client-fetch"],
});
