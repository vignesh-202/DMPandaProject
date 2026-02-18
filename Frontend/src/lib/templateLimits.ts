/**
 * Template & reply field limits (bytes unless noted).
 * Must stay in sync with Backend template_validation.py.
 * Used for UI enforcement (max input) and must match backend validation.
 */

export const getByteLength = (s: string): number => new Blob([s]).size;

// --- Automation ---
export const AUTOMATION_TITLE_MIN = 2;
export const AUTOMATION_TITLE_MAX = 25;

// --- Template name (Reply Templates library) ---
export const TEMPLATE_NAME_MIN = 2;
export const TEMPLATE_NAME_MAX = 50;

// --- Main message / text (template_text, quick_replies prompt) ---
export const TEXT_MIN = 2;
export const TEXT_MAX = 1000;

// --- Button template text (separate limit from general text) ---
export const BUTTON_TEXT_MAX = 640; // Button template message content limit (matches InboxMenu)

// --- Button title (all: template_buttons, template_carousel element, template_media) ---
// Note: InboxMenu uses 40 bytes for carousel/button templates, but general limit is 20
// We use 40 to match InboxMenu's stricter validation
export const BUTTON_TITLE_MIN = 2;
export const BUTTON_TITLE_MAX = 40; // Updated to match InboxMenu validation (carousel/button templates)

// --- Quick reply ---
export const QUICK_REPLY_TITLE_MIN = 2;
export const QUICK_REPLY_TITLE_MAX = 20;
export const QUICK_REPLY_PAYLOAD_MIN = 2;
export const QUICK_REPLY_PAYLOAD_MAX = 950; // Updated to match InboxMenu validation

// --- Quick replies prompt text ---
export const QUICK_REPLIES_TEXT_MAX = 950; // Title text for quick replies template (matches InboxMenu)

// --- Carousel ---
export const CAROUSEL_TITLE_MIN = 2;
export const CAROUSEL_TITLE_MAX = 80;
export const CAROUSEL_SUBTITLE_MAX = 80;
export const CAROUSEL_ELEMENTS_MAX = 10;
export const CAROUSEL_BUTTON_TITLE_MIN = 2;
export const CAROUSEL_BUTTON_TITLE_MAX = 20;

// --- Counts ---
export const BUTTONS_MAX = 3;
export const QUICK_REPLIES_MAX = 13;

// --- Media ---
export const MEDIA_URL_MAX = 500;

// --- Share post caption (optional) ---
export const SHARE_POST_CAPTION_MAX = 1000;

/** Truncate string to max UTF-8 bytes (for onChange when we want hard cap) */
export function truncateToBytes(str: string, maxBytes: number): string {
  if (getByteLength(str) <= maxBytes) return str;
  let u = str;
  while (u.length && getByteLength(u) > maxBytes) u = u.slice(0, -1);
  return u;
}
