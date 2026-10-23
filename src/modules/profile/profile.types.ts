export const PROFILE_SECTIONS = ["about", "experience", "education", "skills"] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export interface ProfileEntry {
  id: string | null;
  lines: string[];
}

export interface Profile {
  publicIdentifier: string;
  url: string;
  name: string;
  headline: string;
  location: string;
  topCard: string[];
  about?: string;
  experience?: ProfileEntry[];
  education?: ProfileEntry[];
  skills?: ProfileEntry[];
}

export interface MonthYear {
  month?: number | undefined;
  year: number;
}

export interface ExperienceInput {
  title?: string | undefined;
  company?: string | undefined;
  employmentType?: string | undefined;
  location?: string | undefined;
  locationType?: string | undefined;
  current?: boolean | undefined;
  startDate?: MonthYear | undefined;
  endDate?: MonthYear | undefined;
  description?: string | undefined;
}

export interface EducationInput {
  school?: string | undefined;
  degree?: string | undefined;
  fieldOfStudy?: string | undefined;
  startDate?: MonthYear | undefined;
  endDate?: MonthYear | undefined;
  grade?: string | undefined;
  activities?: string | undefined;
  description?: string | undefined;
}

export interface ContactInfoInput {
  phone?: string | undefined;
  phoneType?: string | undefined;
  address?: string | undefined;
  website?: string | undefined;
  websiteType?: string | undefined;
}

export interface OpenToWorkInput {
  enabled: boolean;
  jobTitles?: string[] | undefined;
  visibility?: "recruiters" | "everyone" | undefined;
}
