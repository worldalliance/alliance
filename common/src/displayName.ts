export const ANONYMOUS_DISPLAY_NAME = "Someone";

export const publicDisplayName = (user: {
  anonymous: boolean;
  name: string;
}) => (user.anonymous ? ANONYMOUS_DISPLAY_NAME : user.name);
