/** Messages a socket handshake is refused with, which clients branch on.
 * Installed clients match these values, so a value never changes; add a
 * member instead.
 * `socketAuthMiddleware` refuses a token jsonwebtoken rejects with
 * jsonwebtoken's own message, such as "jwt expired", instead. */
export enum SocketRefusal {
  Unauthorized = "Unauthorized",
}
