/**
 * SQL equivalent of `hasProfilePicture` from `@alliance/common/profilePicture`.
 * Postgres `\S` follows the database's ctype, so the two agree on ASCII
 * whitespace but may differ on other Unicode whitespace.
 *
 * @param profilePictureExpr Column SQL, e.g. `'u."profilePicture"'`.
 */
export function sqlUserHasProfilePicture(profilePictureExpr: string): string {
  return `(${profilePictureExpr} IS NOT NULL AND ${profilePictureExpr} ~ '\\S')`;
}
