import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import {
  addEducation,
  addExperience,
  addSkills,
  deleteEducation,
  deleteExperience,
  getMyProfile,
  removeSkill,
  setOpenToWork,
  updateAbout,
  updateContactInfo,
  updateEducation,
  updateExperience,
  updateHeadline,
  updateLocation,
  updatePhoto,
} from "./profile.service.ts";
import { PROFILE_SECTIONS } from "./profile.types.ts";

const monthYear = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(1900).max(2100),
});

const experienceFields = {
  title: z.string().min(1).max(100).optional(),
  company: z.string().min(1).max(100).optional(),
  employmentType: z
    .string()
    .optional()
    .describe("As shown on LinkedIn: Full-time, Part-time, Self-employed, Freelance, Contract, Internship, Apprenticeship, Seasonal"),
  location: z.string().max(100).optional(),
  locationType: z.enum(["On-site", "Hybrid", "Remote"]).optional(),
  current: z.boolean().optional().describe("True if the user currently works in this role"),
  startDate: monthYear.optional(),
  endDate: monthYear.optional(),
  description: z.string().max(2000).optional(),
};

const educationFields = {
  school: z.string().min(1).max(100).optional(),
  degree: z.string().max(100).optional(),
  fieldOfStudy: z.string().max(100).optional(),
  startDate: monthYear.optional(),
  endDate: monthYear.optional(),
  grade: z.string().max(80).optional(),
  activities: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
};

const entryId = z.string().regex(/^\d+$/).describe("Entry id from get_my_profile");

const imageSource = {
  imageUrl: z.url().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif"]).optional(),
};

export function registerProfileTools(server: McpServer, context: ToolContext): void {
  const { userId } = context;

  defineTool(server, {
    name: "get_my_profile",
    title: "Get my profile",
    description:
      "Read the user's own profile: name, headline, location, about, experience, education and skills. Entries include ids for the update and delete tools.",
    kind: "read",
    input: { sections: z.array(z.enum(PROFILE_SECTIONS)).default([...PROFILE_SECTIONS]) },
    handler: ({ sections }) => getMyProfile(userId, sections),
  });

  defineTool(server, {
    name: "update_headline",
    title: "Update headline",
    description: "Replace the headline under the user's name.",
    kind: "write",
    input: { headline: z.string().min(1).max(220) },
    handler: ({ headline }) => updateHeadline(userId, headline),
  });

  defineTool(server, {
    name: "update_about",
    title: "Update about",
    description: "Replace the About section text.",
    kind: "write",
    input: { about: z.string().min(1).max(2600) },
    handler: ({ about }) => updateAbout(userId, about),
  });

  defineTool(server, {
    name: "update_location",
    title: "Update location",
    description: "Change the location shown on the profile.",
    kind: "write",
    input: {
      country: z.string().min(2).max(100),
      city: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
    },
    handler: (location) => updateLocation(userId, location),
  });

  defineTool(server, {
    name: "update_contact_info",
    title: "Update contact info",
    description: "Change phone, address or website in the profile contact info. Omitted fields stay unchanged.",
    kind: "write",
    input: {
      phone: z.string().max(30).optional(),
      phoneType: z.enum(["Home", "Work", "Mobile"]).optional(),
      address: z.string().max(220).optional(),
      website: z.url().optional(),
      websiteType: z.enum(["Personal", "Company", "Blog", "RSS feed", "Portfolio", "Other"]).optional(),
    },
    handler: (input) => updateContactInfo(userId, input),
  });

  defineTool(server, {
    name: "add_experience",
    title: "Add experience",
    description: "Add a position to the Experience section. Title, company and start date are required by LinkedIn.",
    kind: "write",
    input: { ...experienceFields, title: z.string().min(1).max(100), company: z.string().min(1).max(100), startDate: monthYear },
    handler: (input) => addExperience(userId, input),
  });

  defineTool(server, {
    name: "update_experience",
    title: "Update experience",
    description: "Edit an existing position. Only the given fields change.",
    kind: "write",
    input: { id: entryId, ...experienceFields },
    handler: ({ id, ...input }) => updateExperience(userId, id, input),
  });

  defineTool(server, {
    name: "delete_experience",
    title: "Delete experience",
    description: "Remove a position from the Experience section.",
    kind: "destructive",
    input: { id: entryId },
    handler: ({ id }) => deleteExperience(userId, id),
  });

  defineTool(server, {
    name: "add_education",
    title: "Add education",
    description: "Add a school to the Education section.",
    kind: "write",
    input: { ...educationFields, school: z.string().min(1).max(100) },
    handler: (input) => addEducation(userId, input),
  });

  defineTool(server, {
    name: "update_education",
    title: "Update education",
    description: "Edit an existing education entry. Only the given fields change.",
    kind: "write",
    input: { id: entryId, ...educationFields },
    handler: ({ id, ...input }) => updateEducation(userId, id, input),
  });

  defineTool(server, {
    name: "delete_education",
    title: "Delete education",
    description: "Remove an entry from the Education section.",
    kind: "destructive",
    input: { id: entryId },
    handler: ({ id }) => deleteEducation(userId, id),
  });

  defineTool(server, {
    name: "add_skills",
    title: "Add skills",
    description: "Add one or more skills to the profile.",
    kind: "write",
    input: { skills: z.array(z.string().min(1).max(80)).min(1).max(20) },
    handler: ({ skills }) => addSkills(userId, skills),
  });

  defineTool(server, {
    name: "remove_skill",
    title: "Remove skill",
    description: "Remove a skill from the profile by its exact name.",
    kind: "destructive",
    input: { skill: z.string().min(1).max(80) },
    handler: ({ skill }) => removeSkill(userId, skill),
  });

  defineTool(server, {
    name: "update_profile_photo",
    title: "Update profile photo",
    description: "Upload a new profile photo from a public image URL or base64 data.",
    kind: "write",
    input: imageSource,
    handler: (source) => updatePhoto(userId, "profile", source),
  });

  defineTool(server, {
    name: "update_banner",
    title: "Update background photo",
    description: "Upload a new background (banner) image from a public image URL or base64 data. 1584x396 works best.",
    kind: "write",
    input: imageSource,
    handler: (source) => updatePhoto(userId, "banner", source),
  });

  defineTool(server, {
    name: "set_open_to_work",
    title: "Set open to work",
    description: "Turn the Open to work signal on (with job titles and visibility) or off.",
    kind: "write",
    input: {
      enabled: z.boolean(),
      jobTitles: z.array(z.string().min(1).max(100)).max(5).optional(),
      visibility: z.enum(["recruiters", "everyone"]).optional(),
    },
    handler: (input) => setOpenToWork(userId, input),
  });
}
