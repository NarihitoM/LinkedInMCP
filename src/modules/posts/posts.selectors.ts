import { byCss, byRole, type Finder } from "../../shared/lib/pageActions.ts";

export const REACTIONS = {
  like: "Like",
  celebrate: "Celebrate",
  support: "Support",
  love: "Love",
  insightful: "Insightful",
  funny: "Funny",
} as const;

export type Reaction = keyof typeof REACTIONS;

export const postSelectors = {
  likeButton: [
    byCss('button[aria-label^="React Like"]'),
    byRole("button", /^React Like/i),
    byRole("button", /^Like$/i),
  ] satisfies Finder[],
  reactionOption: (label: string): Finder[] => [
    byCss(`button[aria-label="${label}"]`),
    byRole("button", new RegExp(`^${label}$`, "i")),
  ],
  commentButton: [byRole("button", /^Comment$/i), byCss('button[aria-label="Comment"]')] satisfies Finder[],
  commentBox: [
    byCss('.comments-comment-box [contenteditable="true"]'),
    byCss('.comments-comment-texteditor [contenteditable="true"]'),
    byRole("textbox", /comment/i),
  ] satisfies Finder[],
  commentSubmit: [
    byCss("button.comments-comment-box__submit-button--cr"),
    byCss("button.comments-comment-box__submit-button"),
    byCss('form.comments-comment-box__form button[type="submit"]'),
  ] satisfies Finder[],
};
