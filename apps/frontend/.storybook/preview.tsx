import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import type { Preview } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  reactRouterParameters,
  withRouter,
} from "storybook-addon-remix-react-router";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { userId: "42" },
      },
      routing: { path: "/users/:userId" },
    }),
  },
  decorators: [
    withRouter,
    (Story: React.ComponentType) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <SiteAppProvider>
          <ToastProvider>
            <Story />
          </ToastProvider>
        </SiteAppProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
