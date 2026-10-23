import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { easyApply, getCompany, getJob, listSavedJobs, saveJob, searchCompanies, searchJobs } from "./jobs.service.ts";

const job = z.string().min(1).describe("Job id or job URL (https://www.linkedin.com/jobs/view/123/)");

export function registerJobsTools(server: McpServer, context: ToolContext): void {
  const { userId } = context;

  defineTool(server, {
    name: "search_jobs",
    title: "Search jobs",
    description: "Search LinkedIn jobs with optional location, workplace type, date posted and experience level filters.",
    kind: "read",
    input: {
      keywords: z.string().min(1).max(200),
      location: z.string().max(100).optional(),
      workplace: z.array(z.enum(["onsite", "remote", "hybrid"])).optional(),
      datePosted: z.enum(["day", "week", "month"]).optional(),
      experience: z.array(z.enum(["internship", "entry", "associate", "mid-senior", "director", "executive"])).optional(),
      easyApplyOnly: z.boolean().default(false),
      page: z.number().int().min(1).max(40).default(1),
    },
    handler: (search) => searchJobs(userId, search),
  });

  defineTool(server, {
    name: "get_job",
    title: "Get job",
    description: "Read a job posting: title, company, location, description and whether Easy Apply is available.",
    kind: "read",
    input: { job },
    handler: ({ job: id }) => getJob(userId, id),
  });

  defineTool(server, {
    name: "save_job",
    title: "Save job",
    description: "Save a job to the user's saved jobs list.",
    kind: "write",
    input: { job },
    handler: ({ job: id }) => saveJob(userId, id),
  });

  defineTool(server, {
    name: "list_saved_jobs",
    title: "List saved jobs",
    description: "List jobs the user has saved.",
    kind: "read",
    input: { limit: z.number().int().min(1).max(100).default(20) },
    handler: ({ limit }) => listSavedJobs(userId, limit),
  });

  defineTool(server, {
    name: "easy_apply",
    title: "Easy Apply",
    description:
      "Apply to a job with LinkedIn Easy Apply using the user's saved profile and resume, then submit. If questions are unanswered, the tool stops and lists them; call again with answers mapping question text to the answer.",
    kind: "write",
    input: {
      job,
      answers: z
        .record(z.string().min(1), z.string())
        .default({})
        .describe('Answers keyed by part of the question text, e.g. {"years of experience": "5", "authorized to work": "Yes"}'),
    },
    handler: ({ job: id, answers }) => easyApply(userId, id, answers),
  });

  defineTool(server, {
    name: "get_company",
    title: "Get company",
    description: "Read a company page: overview, website, industry, size, headquarters and more.",
    kind: "read",
    input: { company: z.string().min(2).describe("Company URL or slug (https://www.linkedin.com/company/microsoft/)") },
    handler: ({ company }) => getCompany(userId, company),
  });

  defineTool(server, {
    name: "search_companies",
    title: "Search companies",
    description: "Search LinkedIn company pages.",
    kind: "read",
    input: { keywords: z.string().min(1).max(200), page: z.number().int().min(1).max(100).default(1) },
    handler: ({ keywords, page }) => searchCompanies(userId, keywords, page),
  });
}
