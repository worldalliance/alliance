import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import { redirectKeepingParams } from "./redirectKeepingParams";

export function loader({ request }: { request: Request }) {
  return redirectKeepingParams({ request, target: KORA_PROJECT_PATH });
}

export default function SaferChatbotsRedirect() {
  return null;
}
