import { taskWithdrew } from "@alliance/shared/lib/copy";
import Card, { CardStyle } from "./system/Card";

export default function ActionTaskPanelDeclined() {
  return <Card cardStyle={CardStyle.Grey}>{taskWithdrew}</Card>;
}
