import React from "react";
import type { Preview } from "@storybook/react";
import "../src/index.css";
import { initialize, mswLoader } from "msw-storybook-addon";
import { http, HttpResponse } from "msw";
import { ActionDto } from "@alliance/shared/client";
import { MemoryRouter } from "react-router-dom";

initialize();

const testActions: ActionDto[] = [
  {
    name: "A task to do something specific",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
    id: 1,
    whyJoin: "",
    image: "",
    status: "Active",
    usersJoined: 0,
    myRelation: {
      status: "joined",
      deadline: new Date().toISOString(),
      dateCommitted: new Date().toISOString(),
    },
  },
  {
    name: "A task to do something else",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
    id: 2,
    whyJoin: "",
    image: "",
    status: "Active",
    usersJoined: 0,
    myRelation: {
      status: "joined",
      deadline: new Date().toISOString(),
      dateCommitted: new Date().toISOString(),
    },
  },
];

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    msw: {
      handlers: [
        http.get("/actions", () => {
          return HttpResponse.json(testActions);
        }),
        http.get("/actions/withStatus", () => {
          return HttpResponse.json(testActions);
        }),
        http.get("/actions/:id", () => {
          return HttpResponse.json(testActions[0]);
        }),
        http.get("/actions/myStatus/:id", () => {
          return HttpResponse.json({
            status: "none",
            deadline: new Date().toISOString(),
            dateCommitted: new Date().toISOString(),
          });
        }),
      ],
    },
  },
  loaders: [mswLoader],
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default preview;
