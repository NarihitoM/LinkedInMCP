import { byCss, byRole, type Finder } from "../../shared/lib/pageActions.ts";

const topCard = "main section:first-of-type";

export const networkSelectors = {
  connect: [
    byCss(`${topCard} button[aria-label^="Invite"][aria-label$="to connect"]`),
    byCss('main button[aria-label^="Invite"][aria-label$="to connect"]'),
    byRole("button", /^Connect$/i),
  ] satisfies Finder[],
  moreActions: [
    byCss(`${topCard} button[aria-label="More actions"]`),
    byCss('main button[aria-label="More actions"]'),
    byRole("button", /^More$/i),
  ] satisfies Finder[],
  menuConnect: [byCss('[role="menu"] [aria-label$="to connect"]'), byRole("menuitem", /connect/i), byRole("button", /^Connect$/i)] satisfies Finder[],
  pending: [byRole("button", /^Pending/i), byCss('main button[aria-label^="Pending"]')] satisfies Finder[],
  addNote: [byRole("button", /^Add a note$/i)] satisfies Finder[],
  noteBox: [byCss('textarea[name="message"]'), byCss("textarea")] satisfies Finder[],
  sendInvite: [byRole("button", /^Send( invitation)?$/i), byRole("button", /^Send now$/i)] satisfies Finder[],
  sendWithoutNote: [byRole("button", /^Send without a note$/i), byRole("button", /^Send( invitation)?$/i)] satisfies Finder[],
  removeConnection: [byRole("menuitem", /remove connection/i), byCss('[role="menu"] [aria-label*="Remove your connection"]'), byRole("button", /remove connection/i)] satisfies Finder[],
  confirmRemove: [byRole("button", /^Remove$/i)] satisfies Finder[],
  follow: [byRole("button", /^Follow\b/i), byCss('main button[aria-label^="Follow"]')] satisfies Finder[],
  menuFollow: [byRole("menuitem", /^Follow\b/i), byCss('[role="menu"] [aria-label^="Follow"]')] satisfies Finder[],
  following: [byRole("button", /^Following\b/i), byCss('main button[aria-label^="Following"]')] satisfies Finder[],
  menuUnfollow: [byRole("menuitem", /^Unfollow\b/i), byCss('[role="menu"] [aria-label^="Unfollow"]')] satisfies Finder[],
  confirmUnfollow: [byRole("button", /^Unfollow$/i)] satisfies Finder[],
  accept: [byRole("button", /^Accept\b/i)] satisfies Finder[],
  ignore: [byRole("button", /^Ignore\b/i)] satisfies Finder[],
  withdraw: [byRole("button", /^Withdraw\b/i)] satisfies Finder[],
  confirmWithdraw: [byRole("button", /^Withdraw$/i)] satisfies Finder[],
};
