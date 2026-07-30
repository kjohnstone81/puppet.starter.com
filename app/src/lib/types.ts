export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A wall-clock window in the business's own timezone, e.g. 09:00 -> 17:00. */
export interface TimeWindow {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export type WorkingHours = Record<Weekday, TimeWindow[]>;

export interface Palette {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  primary: string;
  primaryForeground: string;
  accent: string;
}

export interface Theme {
  /** Set when a theme was produced by the model rather than the built-in default. */
  generatedAt?: string;
  palette: Palette;
  darkPalette: Palette;
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    headingLetterSpacing: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
  };
  style: {
    vibe: string;
    rationale: string;
  };
  copy: {
    tagline: string;
    heroHeading: string;
    heroSubheading: string;
    bookButtonLabel: string;
  };
}

export interface Tenant {
  businessName: string;
  ownerEmail: string;
  /** Calendar the bookings are written to. "primary" is the owner's default calendar. */
  calendarId: string;
  timezone: string;
  logoUrl: string | null;
  /** Bucket-relative path of the logo, so a theme can be regenerated from it. */
  logoObjectPath: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** How far ahead clients may book, in days. */
  bookingWindowDays: number;
  /** Minimum lead time before a slot can be booked, in hours. */
  minNoticeHours: number;
  /** Gap enforced on both sides of every appointment, in minutes. */
  bufferMinutes: number;
  /** Slot start times are aligned to this many minutes. */
  slotGranularityMinutes: number;
  workingHours: WorkingHours;
  theme: Theme;
  /** True once the owner has completed the Google OAuth grant. */
  calendarConnected: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  active: boolean;
  sortOrder: number;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  /** ISO-8601 UTC instants. */
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  status: BookingStatus;
  calendarEventId: string | null;
  createdAt: string;
  priceCents: number;
  currency: string;
}

/** One bookable start time, as returned by the availability API. */
export interface Slot {
  /** ISO-8601 UTC instant. */
  startsAt: string;
  endsAt: string;
  /** "HH:MM" in the business timezone, for display. */
  label: string;
}

export interface DayAvailability {
  /** "YYYY-MM-DD" in the business timezone. */
  date: string;
  slots: Slot[];
}
