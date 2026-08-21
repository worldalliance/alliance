import type { StorybookConfig } from "@storybook/react-vite";

import { dirname, join } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in some monorepos / strict package layouts so Storybook resolves packages correctly.
 */
function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, "package.json")));
}
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../public"],
  addons: [
    {
      name: getAbsolutePath("@storybook/addon-essentials"),
      options: {
        docs: false,
      },
    },
    getAbsolutePath("@storybook/addon-interactions"),
    getAbsolutePath("@storybook/manager-api"),
    getAbsolutePath("@storybook/theming"),
    getAbsolutePath("storybook-addon-remix-react-router"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
};
export default config;
