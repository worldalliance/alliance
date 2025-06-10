import {
  withRouter,
  reactRouterParameters,
} from "storybook-addon-remix-react-router";
import React from "react";
import type { Preview } from "@storybook/react";
import "../src/index.css";
import { initialize, mswLoader } from "msw-storybook-addon";
import { MemoryRouter } from "react-router";

initialize({
  onUnhandledRequest: ({ url, method }) => {
    const pathname = new URL(url).pathname;
    if (
      pathname.startsWith("/src") ||
      pathname.includes(".ts") ||
      pathname.includes(".js")
    ) {
      return;
    } else {
      console.warn(`Unhandled ${method} request to ${url}.`);
    }
  },
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    msw: {},
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { userId: "42" },
      },
      routing: { path: "/users/:userId" },
    }),
  },
  loaders: [mswLoader],
  decorators: [withRouter, (Story: React.ComponentType) => <Story />],
};

export default preview;
