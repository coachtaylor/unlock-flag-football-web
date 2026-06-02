// Name of the short-lived resume cookie set when a signed-out recipient
// opens an invite link. After they authenticate, login (client) and the
// proxy (middleware) read it to send them back to /join/<token> to finish
// accepting. Lives in a plain module so the client, the server action, and
// the proxy can all import it (a "use server" file may only export async
// functions, so it can't live in invite-actions.ts).
export const INVITE_COOKIE = "uff_invite";
