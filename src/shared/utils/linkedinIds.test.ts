import { describe, expect, it } from "vitest";
import { ToolError } from "./errors.ts";
import { companySlug, jobId, profileId, threadId } from "./linkedinIds.ts";

describe("linkedinIds", () => {
  it("parses profile ids from URLs and raw ids", () => {
    expect(profileId("https://www.linkedin.com/in/jane-doe-123/?trk=x")).toBe("jane-doe-123");
    expect(profileId("jane-doe-123")).toBe("jane-doe-123");
    expect(profileId("@jane")).toBe("jane");
  });

  it("rejects ids with path characters", () => {
    expect(() => profileId("../../admin")).toThrow(ToolError);
    expect(() => profileId("a b")).toThrow(ToolError);
  });

  it("parses company slugs", () => {
    expect(companySlug("https://www.linkedin.com/company/microsoft/about/")).toBe("microsoft");
    expect(companySlug("anthropic")).toBe("anthropic");
  });

  it("parses job ids", () => {
    expect(jobId("https://www.linkedin.com/jobs/view/4012345678/")).toBe("4012345678");
    expect(jobId("https://www.linkedin.com/jobs/search/?currentJobId=4012345678")).toBe("4012345678");
    expect(jobId("4012345678")).toBe("4012345678");
    expect(() => jobId("abc")).toThrow(ToolError);
  });

  it("parses conversation ids", () => {
    expect(threadId("https://www.linkedin.com/messaging/thread/2-YWJjZA==/")).toBe("2-YWJjZA==");
    expect(() => threadId("bad/id")).toThrow(ToolError);
  });
});
