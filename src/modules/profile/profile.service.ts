import type { Locator, Page } from "playwright";
import { cleanLines, extractTopLevelItems, normalizeUrl } from "../../shared/lib/pageExtract.ts";
import {
  byLabel,
  click,
  dialog,
  fill,
  fillTypeahead,
  find,
  findVisible,
  open,
  openDialog,
  pause,
  saveDialog,
  scrollToBottom,
  selectByLabel,
  setChecked,
  type Finder,
} from "../../shared/lib/pageActions.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { loadImage } from "../../shared/utils/safeFetch.ts";
import { withLinkedIn } from "../session/index.ts";
import { EDIT_ID_PATTERNS, profileSelectors as select } from "./profile.selectors.ts";
import type {
  ContactInfoInput,
  EducationInput,
  ExperienceInput,
  MonthYear,
  OpenToWorkInput,
  Profile,
  ProfileEntry,
  ProfileSection,
} from "./profile.types.ts";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DETAIL_SECTIONS = ["experience", "education", "skills"] as const;

function editId(links: string[], pattern: RegExp): string | null {
  for (const link of links) {
    const match = link.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function readProfile(page: Page, publicIdentifier: string, sections: readonly ProfileSection[]): Promise<Profile> {
  await open(page, `/in/${encodeURIComponent(publicIdentifier)}/`);

  const top = await page.evaluate(() => {
    const main = document.querySelector("main");
    const heading = main?.querySelector("h1");
    const card = heading?.closest("section") ?? main?.querySelector("section");
    const aboutSection = document.getElementById("about")?.closest("section");
    return {
      name: heading?.textContent ?? "",
      headline: main?.querySelector(".text-body-medium")?.textContent ?? "",
      location: main?.querySelector(".text-body-small.inline")?.textContent ?? "",
      card: card instanceof HTMLElement ? card.innerText : "",
      about: aboutSection instanceof HTMLElement ? aboutSection.innerText : "",
    };
  });

  const canonical = page.url().match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  const id = canonical ? decodeURIComponent(canonical) : publicIdentifier;
  const profile: Profile = {
    publicIdentifier: id,
    url: normalizeUrl(`/in/${encodeURIComponent(id)}/`),
    name: cleanLines(top.name, 1)[0] ?? "",
    headline: cleanLines(top.headline, 1)[0] ?? "",
    location: cleanLines(top.location, 1)[0] ?? "",
    topCard: cleanLines(top.card, 15),
  };

  if (sections.includes("about")) {
    const lines = cleanLines(top.about, 80);
    profile.about = (lines[0]?.toLowerCase() === "about" ? lines.slice(1) : lines).join("\n");
  }

  for (const section of DETAIL_SECTIONS) {
    if (!sections.includes(section)) continue;
    await open(page, `/in/${encodeURIComponent(id)}/details/${section}/`);
    await scrollToBottom(page, 2);
    const items = await extractTopLevelItems(page);
    profile[section] = items
      .map((item): ProfileEntry => ({ id: editId(item.links, EDIT_ID_PATTERNS[section]), lines: item.lines }))
      .filter((entry) => entry.lines.length > 0);
  }

  return profile;
}

export function getMyProfile(userId: string, sections: readonly ProfileSection[]) {
  return withLinkedIn(userId, ({ page, me }) => readProfile(page, me, sections));
}

async function openForm(page: Page, path: string): Promise<Locator> {
  await open(page, path);
  return openDialog(page);
}

async function setMonthYear(modal: Locator, groupName: RegExp, value: MonthYear): Promise<void> {
  const group =
    (await findVisible(modal, [(scope) => scope.getByRole("group", { name: groupName })], 2_000)) ??
    (await find(modal, [(scope) => scope.locator("fieldset").filter({ hasText: groupName })], "the date fields"));

  if (value.month !== undefined) {
    const month = MONTHS[value.month - 1];
    if (!month) throw new ToolError(`Month must be between 1 and 12, got ${value.month}.`);
    await selectByLabel(group, [byLabel(/month/i), (scope) => scope.locator("select").nth(0)], "the month picker", month);
  }
  await selectByLabel(group, [byLabel(/year/i), (scope) => scope.locator("select").nth(1)], "the year picker", String(value.year));
}

async function fillExperience(page: Page, modal: Locator, input: ExperienceInput): Promise<void> {
  const fields = select.experience;
  if (input.title !== undefined) await fill(modal, fields.title, "the Title field", input.title);
  if (input.employmentType !== undefined) {
    await selectByLabel(modal, fields.employmentType, "the Employment type picker", input.employmentType);
  }
  if (input.company !== undefined) await fillTypeahead(page, modal, fields.company, "the Company field", input.company);
  if (input.current !== undefined) await setChecked(modal, fields.current, "the current role checkbox", input.current);
  if (input.startDate) await setMonthYear(modal, /^Start date/i, input.startDate);
  if (input.endDate && !input.current) await setMonthYear(modal, /^End date/i, input.endDate);
  if (input.location !== undefined) await fillTypeahead(page, modal, fields.location, "the Location field", input.location);
  if (input.locationType !== undefined) {
    await selectByLabel(modal, fields.locationType, "the Location type picker", input.locationType);
  }
  if (input.description !== undefined) await fill(modal, fields.description, "the Description field", input.description);
}

async function fillEducation(page: Page, modal: Locator, input: EducationInput): Promise<void> {
  const fields = select.education;
  if (input.school !== undefined) await fillTypeahead(page, modal, fields.school, "the School field", input.school);
  if (input.degree !== undefined) await fillTypeahead(page, modal, fields.degree, "the Degree field", input.degree);
  if (input.fieldOfStudy !== undefined) {
    await fillTypeahead(page, modal, fields.fieldOfStudy, "the Field of study field", input.fieldOfStudy);
  }
  if (input.startDate) await setMonthYear(modal, /^Start date/i, input.startDate);
  if (input.endDate) await setMonthYear(modal, /^End date/i, input.endDate);
  if (input.grade !== undefined) await fill(modal, fields.grade, "the Grade field", input.grade);
  if (input.activities !== undefined) await fill(modal, fields.activities, "the Activities field", input.activities);
  if (input.description !== undefined) await fill(modal, fields.description, "the Description field", input.description);
}

async function confirmDeletion(page: Page, modal: Locator, deleteButton: Finder[]): Promise<void> {
  await click(modal, deleteButton, "the Delete button");
  await pause(page, 500, 900);
  const confirm = page.locator('[role="dialog"]:visible').last();
  await click(confirm, select.confirmDelete, "the confirmation Delete button");
  await page
    .locator('[role="dialog"]:visible')
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await pause(page);
}

export function updateHeadline(userId: string, headline: string) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/intro/`);
    await fill(modal, select.headline, "the Headline field", headline);
    await saveDialog(page, modal);
    return { headline };
  });
}

export function updateLocation(userId: string, location: { country: string; city?: string | undefined; postalCode?: string | undefined }) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/intro/`);
    await fillTypeahead(page, modal, select.country, "the Country/Region field", location.country);
    if (location.postalCode !== undefined) {
      const postal = await findVisible(modal, select.postalCode, 1_500);
      if (postal) await postal.fill(location.postalCode);
    }
    if (location.city !== undefined) await fillTypeahead(page, modal, select.city, "the City field", location.city);
    await saveDialog(page, modal);
    return location;
  });
}

export function updateAbout(userId: string, about: string) {
  return withLinkedIn(userId, async ({ page, me }) => {
    await open(page, `/in/${me}/`);
    const editLink = await findVisible(page, select.aboutEditLink, 3_000);
    if (editLink) {
      await editLink.click();
    } else {
      await open(page, `/in/${me}/edit/forms/summary/new/`);
    }
    const modal = await openDialog(page);
    await fill(modal, select.aboutText, "the About text box", about);
    await saveDialog(page, modal);
    return { characters: about.length };
  });
}

export function updateContactInfo(userId: string, input: ContactInfoInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/contact-info/`);
    if (input.phone !== undefined) await fill(modal, select.phone, "the Phone number field", input.phone);
    if (input.phoneType !== undefined) await selectByLabel(modal, select.phoneType, "the Phone type picker", input.phoneType);
    if (input.address !== undefined) await fill(modal, select.address, "the Address field", input.address);
    if (input.website !== undefined) {
      if (!(await findVisible(modal, select.website, 1_500))) {
        await click(modal, select.addWebsite, "the Add website button");
      }
      await fill(modal, select.website, "the Website URL field", input.website);
      if (input.websiteType !== undefined) {
        await selectByLabel(modal, select.websiteType, "the Website type picker", input.websiteType);
      }
    }
    await saveDialog(page, modal);
    return input;
  });
}

export function addExperience(userId: string, input: ExperienceInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/position/new/`);
    await fillExperience(page, modal, input);
    await saveDialog(page, modal);
    return { added: true };
  });
}

export function updateExperience(userId: string, id: string, input: ExperienceInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/position/${encodeURIComponent(id)}/`);
    await fillExperience(page, modal, input);
    await saveDialog(page, modal);
    return { updated: id };
  });
}

export function deleteExperience(userId: string, id: string) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/position/${encodeURIComponent(id)}/`);
    await confirmDeletion(page, modal, select.experience.delete);
    return { deleted: id };
  });
}

export function addEducation(userId: string, input: EducationInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/education/new/`);
    await fillEducation(page, modal, input);
    await saveDialog(page, modal);
    return { added: true };
  });
}

export function updateEducation(userId: string, id: string, input: EducationInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/education/${encodeURIComponent(id)}/`);
    await fillEducation(page, modal, input);
    await saveDialog(page, modal);
    return { updated: id };
  });
}

export function deleteEducation(userId: string, id: string) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const modal = await openForm(page, `/in/${me}/edit/forms/education/${encodeURIComponent(id)}/`);
    await confirmDeletion(page, modal, select.education.delete);
    return { deleted: id };
  });
}

export function addSkills(userId: string, skills: string[]) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const added: string[] = [];
    for (const skill of skills) {
      const modal = await openForm(page, `/in/${me}/edit/forms/skills/new/`);
      await fillTypeahead(page, modal, select.skill, "the Skill field", skill);
      await saveDialog(page, modal);
      added.push(skill);
    }
    return { added };
  });
}

export function removeSkill(userId: string, skill: string) {
  return withLinkedIn(userId, async ({ page, me }) => {
    await open(page, `/in/${me}/details/skills/`);
    await scrollToBottom(page, 3);
    const items = await extractTopLevelItems(page);
    const target = items.find((item) => item.lines[0]?.toLowerCase() === skill.trim().toLowerCase());
    const editLink = target?.links.find((link) => link.includes("/edit/forms/skills/") || link.includes("/edit/skills/"));

    if (!target) throw new ToolError(`Skill "${skill}" was not found on your profile.`);
    if (!editLink) throw new ToolError(`Could not find the edit link for "${skill}".`);

    await open(page, editLink);
    const modal = await openDialog(page);
    await confirmDeletion(page, modal, select.deleteSkill);
    return { removed: skill };
  });
}

async function uploadIntoDialog(page: Page, opener: Finder[], label: string, image: Parameters<Locator["setInputFiles"]>[0]): Promise<void> {
  await click(page, opener, label);
  const modal = await openDialog(page);
  const fileInput = modal.locator('input[type="file"]').first();

  if ((await fileInput.count()) > 0) {
    await fileInput.setInputFiles(image);
  } else {
    const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
    await click(modal, select.uploadButton, "the Upload photo button");
    await (await chooser).setFiles(image);
  }

  for (let step = 0; step < 4; step += 1) {
    await pause(page, 1_200, 2_000);
    const current = await findVisible(page, dialog, 1_500);
    if (!current) return;
    const apply = await findVisible(current, select.applyImage, 3_000);
    if (!apply) break;
    await apply.click();
  }

  if (await findVisible(page, dialog, 2_000)) {
    throw new ToolError("The photo dialog did not close. LinkedIn may need extra steps for this image.");
  }
}

export function updatePhoto(
  userId: string,
  kind: "profile" | "banner",
  source: { imageUrl?: string | undefined; imageBase64?: string | undefined; mimeType?: string | undefined },
) {
  return withLinkedIn(userId, async ({ page, me }) => {
    const image = await loadImage(source);
    await open(page, `/in/${me}/`);
    const opener = kind === "profile" ? select.photoButton : select.bannerButton;
    const label = kind === "profile" ? "the profile photo button" : "the background photo button";
    await uploadIntoDialog(page, opener, label, { name: image.name, mimeType: image.mimeType, buffer: image.buffer });
    return { updated: kind };
  });
}

export function setOpenToWork(userId: string, input: OpenToWorkInput) {
  return withLinkedIn(userId, async ({ page, me }) => {
    await open(page, `/in/${me}/`);

    if (!input.enabled) {
      await click(page, select.openToWorkEdit, "the Open to work edit button");
      const modal = await openDialog(page);
      await confirmDeletion(page, modal, select.deleteOpenToWork);
      return { enabled: false };
    }

    const existing = await findVisible(page, select.openToWorkEdit, 2_000);
    if (existing) {
      await existing.click();
    } else {
      await click(page, select.openToButton, "the Open to button");
      await click(page, select.findingJob, "the Finding a new job option");
    }

    const modal = await openDialog(page);
    for (const title of input.jobTitles ?? []) {
      await fillTypeahead(page, modal, select.jobTitles, "the Job titles field", title);
    }
    if (input.visibility === "recruiters") await click(modal, select.recruitersOnly, "the Recruiters only option");
    if (input.visibility === "everyone") await click(modal, select.allMembers, "the All LinkedIn members option");
    await saveDialog(page, modal, /^(Add to profile|Save)$/i);
    return { enabled: true, jobTitles: input.jobTitles ?? [], visibility: input.visibility ?? "unchanged" };
  });
}
