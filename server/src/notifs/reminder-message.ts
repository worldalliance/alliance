import {
  action,
  ActionListStyle,
  formatActionList,
  joinMessage,
  type Labeled,
  member,
  type NotifMessage,
  SegmentType,
  UserNameForm,
} from "./notification-content";

// Private-use characters, which neither reminder copy nor `renderText` produce.
const placeholder = (index: number) => `\uE000${index}\uE001`;
const PLACEHOLDERS = /\uE000(\d+)\uE001/;

type Named = { id: number; name: string };

/**
 * Keywords naming the recipient, the action, or its tasks become references;
 * `renderText` fills every other keyword now, as reminder copy does.
 */
export async function buildReminderMessage(params: {
  template: string;
  renderText: (text: string) => Promise<string>;
  recipient: Named & { anonymous: boolean };
  action: Named;
  tasks: Named[];
}): Promise<NotifMessage> {
  const { template, renderText, recipient, tasks } = params;
  const taskList = (style: ActionListStyle): Labeled => ({
    segment: {
      type: SegmentType.ActionList,
      ids: tasks.map((task) => task.id),
      style,
    },
    label: formatActionList(
      tasks.map((task) => task.name),
      style,
    ),
  });
  const keywordParts: Record<string, () => Labeled> = {
    fullname: () => member(recipient, UserNameForm.Full),
    firstname: () => member(recipient, UserNameForm.First),
    lastname: () => member(recipient, UserNameForm.Last),
    action: () => action(params.action),
    tasknames: () => taskList(ActionListStyle.Comma),
    formattedtasklist: () => taskList(ActionListStyle.Numbered),
  };

  // One `renderText` pass, so plural switches that wrap a keyword still resolve.
  const references: Labeled[] = [];
  const keywords = new RegExp(
    `#\\{(${Object.keys(keywordParts).join("|")})\\}`,
    "g",
  );
  const rendered = await renderText(
    template.replace(keywords, (_, keyword: string) => {
      references.push(keywordParts[keyword]());
      return placeholder(references.length - 1);
    }),
  );
  return joinMessage(
    rendered
      .split(PLACEHOLDERS)
      .map((piece, index) =>
        index % 2 === 0 ? piece : references[Number(piece)],
      ),
  );
}
