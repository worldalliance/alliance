export const INVITE_LINK_TOKEN = "{invite_link}";
export const INVITE_MESSAGE_TEMPLATE_MAX_LENGTH = 5000;

export const DEFAULT_INVITE_MESSAGE_TEMPLATE = `Hey! I think you'd enjoy joining the Alliance. You can sign up with my invite link:

${INVITE_LINK_TOKEN}`;

export function formatInviteMessage(template: string, inviteLink: string) {
  return template.replaceAll(INVITE_LINK_TOKEN, inviteLink);
}
