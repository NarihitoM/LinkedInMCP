import type { Locator, Page } from "playwright";
import { cleanLines, extractLinkedItems, extractSectionText } from "../../shared/lib/pageExtract.ts";
import { find, findVisible, open, pause, scrollToBottom } from "../../shared/lib/pageActions.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { companySlug, jobId } from "../../shared/utils/linkedinIds.ts";
import { withLinkedIn } from "../session/index.ts";
import { jobSelectors as select } from "./jobs.selectors.ts";

const JOB_LINK = /linkedin\.com\/jobs\/view\/\d+/;
const COMPANY_LINK = /linkedin\.com\/company\/[^/?#]+/;
const MAX_APPLY_STEPS = 12;

const WORKPLACE = { onsite: "1", remote: "2", hybrid: "3" } as const;
const DATE_POSTED = { day: "r86400", week: "r604800", month: "r2592000" } as const;
const EXPERIENCE = { internship: "1", entry: "2", associate: "3", "mid-senior": "4", director: "5", executive: "6" } as const;

export interface JobSearch {
  keywords: string;
  location?: string | undefined;
  workplace?: Array<keyof typeof WORKPLACE> | undefined;
  datePosted?: keyof typeof DATE_POSTED | undefined;
  experience?: Array<keyof typeof EXPERIENCE> | undefined;
  easyApplyOnly: boolean;
  page: number;
}

function jobUrl(id: string): string {
  return `https://www.linkedin.com/jobs/view/${id}/`;
}

function toJob(item: { url: string; title: string; lines: string[] }) {
  return {
    jobId: item.url.match(/jobs\/view\/(\d+)/)?.[1] ?? null,
    url: item.url,
    title: item.title || item.lines[0] || "",
    details: item.lines.slice(0, 6),
  };
}

export function searchJobs(userId: string, search: JobSearch) {
  return withLinkedIn(userId, async ({ page }) => {
    const params = new URLSearchParams({ keywords: search.keywords });
    if (search.location) params.set("location", search.location);
    if (search.workplace?.length) params.set("f_WT", search.workplace.map((value) => WORKPLACE[value]).join(","));
    if (search.datePosted) params.set("f_TPR", DATE_POSTED[search.datePosted]);
    if (search.experience?.length) params.set("f_E", search.experience.map((value) => EXPERIENCE[value]).join(","));
    if (search.easyApplyOnly) params.set("f_AL", "true");
    if (search.page > 1) params.set("start", String((search.page - 1) * 25));

    await open(page, `/jobs/search/?${params.toString()}`);
    const list = page.locator(".jobs-search-results-list, .scaffold-layout__list").first();
    if (await list.isVisible().catch(() => false)) {
      for (let round = 0; round < 4; round += 1) {
        await list.evaluate((element) => element.scrollBy(0, 1500)).catch(() => undefined);
        await pause(page, 500, 900);
      }
    } else {
      await scrollToBottom(page, 3);
    }

    const items = await extractLinkedItems(page, JOB_LINK, 25);
    return items.map(toJob);
  });
}

export function getJob(userId: string, job: string) {
  const id = jobId(job);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/jobs/view/${id}/`);
    const topCard = await findVisible(page, select.topCard, 4_000);
    const description = await findVisible(page, select.description, 4_000);
    return {
      jobId: id,
      url: jobUrl(id),
      title: cleanLines(await page.locator("h1").first().innerText().catch(() => ""), 1)[0] ?? "",
      summary: topCard ? cleanLines(await topCard.innerText(), 20) : [],
      description: description ? cleanLines(await description.innerText(), 200).join("\n") : (await extractSectionText(page, "main", 120)).join("\n"),
      easyApply: Boolean(await findVisible(page, select.easyApply, 1_000)),
    };
  });
}

export function saveJob(userId: string, job: string) {
  const id = jobId(job);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/jobs/view/${id}/`);
    const button = await find(page, select.save, "the Save button");
    const label = `${(await button.innerText().catch(() => "")).trim()} ${(await button.getAttribute("aria-pressed")) ?? ""}`;
    if (/saved|true/i.test(label)) return { jobId: id, saved: true, changed: false };
    await button.click();
    await pause(page);
    return { jobId: id, saved: true, changed: true };
  });
}

export function listSavedJobs(userId: string, limit: number) {
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, "/my-items/saved-jobs/");
    await scrollToBottom(page, Math.ceil(limit / 10));
    const items = await extractLinkedItems(page, JOB_LINK, limit);
    return items.map(toJob);
  });
}

export function getCompany(userId: string, company: string) {
  const slug = companySlug(company);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/company/${encodeURIComponent(slug)}/about/`);
    const details = await page.evaluate(() => {
      const main = document.querySelector("main");
      const facts: Record<string, string> = {};
      for (const term of Array.from(main?.querySelectorAll("dt") ?? [])) {
        const value = term.nextElementSibling;
        if (value && value.tagName === "DD") facts[term.textContent?.trim() ?? ""] = (value as HTMLElement).innerText;
      }
      return {
        name: main?.querySelector("h1")?.textContent ?? "",
        overview: main?.querySelector("section p")?.textContent ?? "",
        facts,
      };
    });

    return {
      slug,
      url: `https://www.linkedin.com/company/${slug}/`,
      name: cleanLines(details.name, 1)[0] ?? slug,
      overview: cleanLines(details.overview, 40).join("\n"),
      facts: Object.fromEntries(
        Object.entries(details.facts)
          .filter(([key]) => key)
          .map(([key, value]) => [key, cleanLines(value, 4).join(" ")]),
      ),
      topCard: await extractSectionText(page, "main section", 12),
    };
  });
}

export function searchCompanies(userId: string, keywords: string, pageNumber: number) {
  return withLinkedIn(userId, async ({ page }) => {
    const params = new URLSearchParams({ keywords });
    if (pageNumber > 1) params.set("page", String(pageNumber));
    await open(page, `/search/results/companies/?${params.toString()}`);
    await scrollToBottom(page, 2);
    const items = await extractLinkedItems(page, COMPANY_LINK, 10);
    return items.map((item) => ({
      name: item.title || item.lines[0] || "",
      url: item.url,
      slug: item.url.match(/company\/([^/?#]+)/)?.[1] ?? null,
      details: item.lines.slice(0, 5),
    }));
  });
}

interface FieldState {
  label: string;
  filled: boolean;
  required: boolean;
}

interface FieldLabels {
  label: string;
  question: string;
}

async function labelsFor(field: Locator): Promise<FieldLabels> {
  return field.evaluate((element) => {
    const clean = (text: string | null | undefined) => (text ?? "").replace(/s+/g, " ").trim();
    const id = element.getAttribute("id");
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const legend = element.closest("fieldset")?.querySelector("legend");
    const own = clean(label?.textContent) || clean(element.getAttribute("aria-label"));
    return { label: own, question: clean(legend?.textContent) || own };
  });
}

function answerFor(question: string, answers: Record<string, string>): string | undefined {
  const normalized = question.toLowerCase();
  const match = Object.entries(answers).find(([key]) => normalized.includes(key.toLowerCase()));
  return match?.[1];
}

async function fillStep(modal: Locator, answers: Record<string, string>): Promise<FieldState[]> {
  const states: FieldState[] = [];
  const choiceGroups = new Map<string, boolean>();
  const fields = modal.locator("input:visible, textarea:visible, select:visible");
  const count = await fields.count();

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const type = (await field.getAttribute("type")) ?? "";
    if (["hidden", "file", "submit", "button"].includes(type)) continue;

    const { label, question } = await labelsFor(field);
    const answer = answerFor(question, answers);

    if (type === "radio" || type === "checkbox") {
      if (answer && answer.toLowerCase() === label.toLowerCase()) await field.check({ force: true });
      if (type === "radio") {
        choiceGroups.set(question, (choiceGroups.get(question) ?? false) || (await field.isChecked()));
      }
      continue;
    }

    const required = (await field.getAttribute("required")) !== null || (await field.getAttribute("aria-required")) === "true";
    const tag = await field.evaluate((element) => element.tagName.toLowerCase());

    if (tag === "select") {
      if (answer) await field.selectOption({ label: answer }).catch(() => undefined);
      const selected = await field.evaluate((element) => (element instanceof HTMLSelectElement ? element.selectedIndex : 0));
      states.push({ label: question, filled: selected > 0, required });
      continue;
    }

    if (answer !== undefined) await field.fill(answer);
    states.push({ label: question, filled: (await field.inputValue()).trim().length > 0, required });
  }

  for (const [question, filled] of choiceGroups) {
    states.push({ label: question, filled, required: true });
  }
  return states;
}

async function closeApplication(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  const discard = await findVisible(page, select.discard, 2_000);
  if (discard) await discard.click();
}

export function easyApply(userId: string, job: string, answers: Record<string, string>) {
  const id = jobId(job);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/jobs/view/${id}/`);
    const button = await findVisible(page, select.easyApply, 4_000);
    if (!button) throw new ToolError("This job has no Easy Apply button. It may use an external application or you already applied.");
    await button.click();

    for (let step = 0; step < MAX_APPLY_STEPS; step += 1) {
      await pause(page, 900, 1_500);
      const modal = await find(page, [(scope) => scope.locator('[role="dialog"]:visible').last()], "the application dialog");
      const states = await fillStep(modal, answers);
      const missing = states.filter((state) => state.required && !state.filled).map((state) => state.label || "(unlabelled field)");

      if (missing.length > 0) {
        await closeApplication(page);
        throw new ToolError(
          `The application needs answers for: ${missing.join("; ")}. Call easy_apply again with answers keyed by these questions.`,
        );
      }

      const submit = await findVisible(modal, select.submit, 1_000);
      if (submit) {
        await submit.click();
        await pause(page, 2_000, 3_000);
        const done = await findVisible(page, select.dismiss, 3_000);
        if (done) await done.click();
        return { jobId: id, url: jobUrl(id), submitted: true };
      }

      const next = (await findVisible(modal, select.review, 1_000)) ?? (await findVisible(modal, select.next, 1_000));
      if (!next) {
        await closeApplication(page);
        throw new ToolError("Could not find the Next, Review or Submit button in the application.");
      }
      await next.click();
      await pause(page, 700, 1_100);

      const errors = await modal.locator(".artdeco-inline-feedback--error:visible").allInnerTexts().catch(() => []);
      if (errors.length > 0) {
        await closeApplication(page);
        throw new ToolError(`LinkedIn rejected some answers: ${errors.map((text) => text.trim()).join("; ")}`);
      }
    }

    await closeApplication(page);
    throw new ToolError("The application had more steps than expected and was not submitted.");
  });
}

