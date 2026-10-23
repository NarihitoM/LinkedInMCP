import { byCss, byRole, type Finder } from "../../shared/lib/pageActions.ts";

export const messagingSelectors = {
  messageButton: [
    byCss('main section:first-of-type button[aria-label^="Message"]'),
    byCss('main a[href*="/messaging/compose"]'),
    byRole("button", /^Message\b/i),
    byRole("link", /^Message\b/i),
  ] satisfies Finder[],
  composer: [
    byCss('.msg-form__contenteditable[contenteditable="true"]'),
    byCss('div[role="textbox"][contenteditable="true"]'),
    byRole("textbox", /write a message/i),
  ] satisfies Finder[],
  send: [byCss("button.msg-form__send-button"), byCss('button.msg-form__send-btn'), byRole("button", /^Send$/i)] satisfies Finder[],
  messageList: [byCss(".msg-s-message-list-content"), byCss(".msg-s-message-list"), byRole("list", /messages/i)] satisfies Finder[],
  threadTitle: [byCss(".msg-entity-lockup__entity-title"), byCss(".msg-thread__link-to-profile"), byCss("h2")] satisfies Finder[],
};
