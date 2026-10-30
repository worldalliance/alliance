import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import type { NotificationDto } from "../../client";
import { makeNotification } from "../testFixtures";
import { routes, serveApi } from "./serveApi";

export const LOADED_AT = "2026-09-23T12:00:00.000Z";

export const list = (notifications: NotificationDto[]) =>
  Response.json(notifications, {
    headers: { [NOTIFS_LOADED_AT_HEADER]: LOADED_AT },
  });
export const accepted = () => new Response(null, { status: 201 });

type Respond = () => Response | Promise<Response>;

/** Serves the notification routes for the calling test file, each answered by
 * a stub the test may replace and that resets before every test. */
export function serveNotifications() {
  const defaults = (): Record<
    "listed" | "counted" | "readResponse" | "readAllResponse",
    Respond
  > => ({
    listed: () => list([makeNotification({ id: 1 })]),
    counted: () => Response.json({ unreadCount: 1 }),
    readResponse: accepted,
    readAllResponse: accepted,
  });
  const api = defaults();
  serveApi(
    routes({
      "GET /notifs": () => api.listed(),
      "GET /notifs/unread-count": () => api.counted(),
      "POST /notifs/read/:id": () => api.readResponse(),
      "POST /notifs/read-all": () => api.readAllResponse(),
    }),
  );
  beforeEach(() => Object.assign(api, defaults()));
  return api;
}
