import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import type { Preview } from "@storybook/react";
import { initialize, mswLoader } from "msw-storybook-addon";
import React from "react";
import {
  reactRouterParameters,
  withRouter,
} from "storybook-addon-remix-react-router";
import "../src/index.css";

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
  decorators: [
    withRouter,
    (Story: React.ComponentType) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default preview;
