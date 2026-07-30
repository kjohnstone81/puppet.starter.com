import Anthropic from "@anthropic-ai/sdk";
import { ALLOWED_FONTS, DEFAULT_THEME } from "./defaults";
import { env } from "./env";
import type { Theme } from "./types";

/**
 * Logo -> design system.
 *
 * Claude looks at the uploaded logo and returns a complete theme: light and
 * dark palettes sampled from the mark, a font pairing drawn from a fixed list
 * the site can actually load, corner radii, and landing-page copy in a voice
 * that matches the brand. Structured outputs guarantee the response parses
 * against the schema below, so the caller never has to repair model JSON.
 */

const MODEL = "claude-opus-5";

const HEX = "^#[0-9A-Fa-f]{6}$";

const paletteSchema = (description: string) => ({
  type: "object",
  description,
  properties: {
    background: { type: "string", pattern: HEX, description: "Page background." },
    surface: {
      type: "string",
      pattern: HEX,
      description: "Cards and panels; must be distinguishable from background.",
    },
    foreground: {
      type: "string",
      pattern: HEX,
      description: "Body text. At least 7:1 contrast against background.",
    },
    muted: {
      type: "string",
      pattern: HEX,
      description: "Secondary text. At least 4.5:1 contrast against background.",
    },
    border: { type: "string", pattern: HEX, description: "Hairline borders and dividers." },
    primary: {
      type: "string",
      pattern: HEX,
      description: "Primary button and link colour, drawn from the logo.",
    },
    primaryForeground: {
      type: "string",
      pattern: HEX,
      description: "Text on top of primary. At least 4.5:1 contrast against primary.",
    },
    accent: {
      type: "string",
      pattern: HEX,
      description: "Secondary highlight, distinct from primary.",
    },
  },
  required: [
    "background",
    "surface",
    "foreground",
    "muted",
    "border",
    "primary",
    "primaryForeground",
    "accent",
  ],
  additionalProperties: false,
});

const THEME_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    palette: paletteSchema("Light mode palette."),
    darkPalette: paletteSchema("Dark mode palette. Same hues, re-tuned for a dark background."),
    typography: {
      type: "object",
      properties: {
        headingFont: { type: "string", enum: [...ALLOWED_FONTS] },
        bodyFont: { type: "string", enum: [...ALLOWED_FONTS] },
        headingWeight: { type: "integer", enum: [500, 600, 700, 800] },
        headingLetterSpacing: {
          type: "string",
          enum: ["-0.04em", "-0.03em", "-0.02em", "-0.01em", "0em", "0.02em", "0.06em"],
        },
      },
      required: ["headingFont", "bodyFont", "headingWeight", "headingLetterSpacing"],
      additionalProperties: false,
    },
    radius: {
      type: "object",
      description: "Corner radii. Sharp for formal brands, generous for playful ones.",
      properties: {
        sm: { type: "string", enum: ["0px", "2px", "4px", "6px", "8px"] },
        md: { type: "string", enum: ["0px", "4px", "8px", "12px", "16px"] },
        lg: { type: "string", enum: ["0px", "8px", "16px", "24px", "999px"] },
      },
      required: ["sm", "md", "lg"],
      additionalProperties: false,
    },
    style: {
      type: "object",
      properties: {
        vibe: {
          type: "string",
          description: "Two or three words describing the visual direction.",
        },
        rationale: {
          type: "string",
          description: "One sentence on what in the logo drove these choices.",
        },
      },
      required: ["vibe", "rationale"],
      additionalProperties: false,
    },
    copy: {
      type: "object",
      properties: {
        tagline: { type: "string", description: "Under 8 words." },
        heroHeading: { type: "string", description: "Under 8 words." },
        heroSubheading: { type: "string", description: "One sentence, under 20 words." },
        bookButtonLabel: { type: "string", description: "Two or three words." },
      },
      required: ["tagline", "heroHeading", "heroSubheading", "bookButtonLabel"],
      additionalProperties: false,
    },
  },
  required: ["palette", "darkPalette", "typography", "radius", "style", "copy"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a brand designer generating the visual system for a small
business's public booking website. You are given the business's logo and its name.

Derive the palette from colours actually present in the logo. Pull the primary
colour from the mark itself; if the logo is monochrome, build a restrained
neutral system and let one accent carry the personality. Match the typography to
the logo's character — a geometric wordmark and a hand-drawn crest should not
end up with the same font pairing.

Avoid generic AI-generated aesthetics: no purple-to-blue gradients, no defaulting
to Inter for everything, no cookie-cutter choices that ignore the logo in front
of you. The result should look like it was designed for this specific business.

Contrast is not negotiable — this is a page real customers book on. Body text
must clear 7:1 against its background and secondary text 4.5:1, in both light
and dark modes.

Write the copy in the voice the logo implies. A children's nursery and a tax
practice should not sound alike. Keep it concrete and free of filler.`;

export interface GenerateThemeInput {
  logoBytes: Buffer;
  logoMediaType: string;
  businessName: string;
  /** Optional nudge from the owner, e.g. "warmer, less corporate". */
  guidance?: string;
}

export interface GenerateThemeResult {
  theme: Theme;
  /** Set when generation fell back to the default theme. */
  warning?: string;
}

export async function generateThemeFromLogo(
  input: GenerateThemeInput,
): Promise<GenerateThemeResult> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  const instruction = [
    `Business name: ${input.businessName}.`,
    input.guidance ? `Owner's direction: ${input.guidance}` : null,
    "Generate the complete theme for this business's booking site.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "high",
      // Structured outputs: the response is guaranteed to parse against this
      // schema, so there is no model-JSON repair path to maintain.
      format: { type: "json_schema", schema: THEME_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normaliseMediaType(input.logoMediaType),
              data: input.logoBytes.toString("base64"),
            },
          },
          { type: "text", text: instruction },
        ],
      },
    ],
  });

  // Safety classifiers can decline a request; that arrives as a 200 with
  // stop_reason "refusal" and no usable content, so check it before parsing.
  if (response.stop_reason === "refusal") {
    return {
      theme: DEFAULT_THEME,
      warning:
        "The model declined to generate a theme for this image. The default theme is still in place — try a different logo file.",
    };
  }

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    return {
      theme: DEFAULT_THEME,
      warning: "The model returned no theme. The default theme is still in place.",
    };
  }

  const parsed = JSON.parse(text.text) as Omit<Theme, "generatedAt">;
  return {
    theme: { ...parsed, generatedAt: new Date().toISOString() },
  };
}

function normaliseMediaType(contentType: string): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    case "image/gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
