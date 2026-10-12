export function hasProfilePicture(user: {
  profilePicture: string | null | undefined;
}): boolean {
  return (user.profilePicture?.trim() ?? "") !== "";
}
