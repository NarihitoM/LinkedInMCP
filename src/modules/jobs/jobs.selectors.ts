import { byCss, byRole, type Finder } from "../../shared/lib/pageActions.ts";

export const jobSelectors = {
  description: [byCss("#job-details"), byCss(".jobs-description__content"), byCss(".jobs-box__html-content")] satisfies Finder[],
  topCard: [
    byCss(".job-details-jobs-unified-top-card__container--two-pane"),
    byCss(".jobs-unified-top-card"),
    byCss(".job-view-layout"),
  ] satisfies Finder[],
  save: [byCss("button.jobs-save-button"), byRole("button", /^Save\b/i)] satisfies Finder[],
  easyApply: [byCss("button.jobs-apply-button"), byRole("button", /^Easy Apply/i)] satisfies Finder[],
  next: [byRole("button", /^(Continue to next step|Next)$/i)] satisfies Finder[],
  review: [byRole("button", /^(Review your application|Review)$/i)] satisfies Finder[],
  submit: [byRole("button", /^Submit application$/i)] satisfies Finder[],
  dismiss: [byRole("button", /^(Dismiss|Done)$/i)] satisfies Finder[],
  discard: [byRole("button", /^Discard$/i)] satisfies Finder[],
};
