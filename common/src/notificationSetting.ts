/** Whether a member wants a kind on a channel, given its channel default; a required kind always follows the default. */
export const resolveSetting = (params: {
  required: boolean;
  override: boolean | null | undefined;
  fallback: boolean;
}): boolean =>
  params.required ? params.fallback : (params.override ?? params.fallback);
