# Decisions

## One disconnect at a time across the rows

Same as web settings: the provider being disconnected lives in `OAuthAccountLinks`, and every row's button is disabled while it is set. The server already refuses the second of two overlapping disconnects that would leave no way in, so this only keeps a passwordless member from seeing that refusal. A connect keeps its own per-row `busy`, since a pending connect can't take away a way in.

Connect buttons are disabled during a disconnect too. Each row has one button that is either Connect or Disconnect, and splitting the disabled state by which one it is buys nothing a member would notice.

Not verified on a device. Mobile typecheck and lint pass.
