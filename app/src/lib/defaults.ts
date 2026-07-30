import type { Tenant, Theme, WorkingHours } from "./types";

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  sun: [],
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "16:00" }],
  sat: [],
};

/**
 * Neutral, deliberately un-branded starting point. It is replaced wholesale the
 * first time the owner uploads a logo and generates a theme.
 */
export const DEFAULT_THEME: Theme = {
  palette: {
    background: "#FFFFFF",
    surface: "#F6F7F9",
    foreground: "#15181D",
    muted: "#5C6470",
    border: "#E2E5EA",
    primary: "#1F2933",
    primaryForeground: "#FFFFFF",
    accent: "#3D5AFE",
  },
  darkPalette: {
    background: "#0E1116",
    surface: "#171B22",
    foreground: "#EDEFF3",
    muted: "#9AA3B2",
    border: "#262C36",
    primary: "#EDEFF3",
    primaryForeground: "#0E1116",
    accent: "#7C8CFF",
  },
  typography: {
    headingFont: "Manrope",
    bodyFont: "Inter",
    headingWeight: 700,
    headingLetterSpacing: "-0.02em",
  },
  radius: { sm: "6px", md: "12px", lg: "20px" },
  style: {
    vibe: "clean",
    rationale: "Default theme — upload a logo in the admin portal to generate a branded one.",
  },
  copy: {
    tagline: "Book in a few clicks",
    heroHeading: "Book your appointment",
    heroSubheading: "Pick a service, choose a time that works for you, and you're done.",
    bookButtonLabel: "Book now",
  },
};

export function defaultTenant(ownerEmail: string): Tenant {
  return {
    businessName: "Your Business",
    ownerEmail,
    calendarId: "primary",
    timezone: "Europe/London",
    logoUrl: null,
    logoObjectPath: null,
    contactEmail: ownerEmail || null,
    contactPhone: null,
    bookingWindowDays: 30,
    minNoticeHours: 4,
    bufferMinutes: 0,
    slotGranularityMinutes: 15,
    workingHours: DEFAULT_WORKING_HOURS,
    theme: DEFAULT_THEME,
    calendarConnected: false,
  };
}

/** Fonts the site is allowed to load. The model must pick from this list. */
export const ALLOWED_FONTS = [
  "Inter",
  "Manrope",
  "DM Sans",
  "Work Sans",
  "Outfit",
  "Sora",
  "Space Grotesk",
  "Archivo",
  "Epilogue",
  "IBM Plex Sans",
  "Playfair Display",
  "Fraunces",
  "Lora",
  "Libre Baskerville",
  "Cormorant Garamond",
] as const;
