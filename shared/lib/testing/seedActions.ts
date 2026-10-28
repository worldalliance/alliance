import type { QueryClient } from "@tanstack/react-query";
import type { ActionDto } from "../../client";
import { ActionSource, actionStore } from "../actionStore";
import { queryKeys } from "../queryKeys";

export function seedActions(client: QueryClient, actions: ActionDto[]) {
  client.setQueryData(
    queryKeys.actions(),
    actionStore(client).receive(actions, ActionSource.List),
  );
}

export function seedAction(client: QueryClient, action: ActionDto) {
  actionStore(client).receive([action], ActionSource.Detail);
  client.setQueryData(queryKeys.action(action.id), action.id);
}
