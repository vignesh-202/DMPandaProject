import re
from html import escape

SUPPORT_EMAIL = "support@dmpanda.com"
BRAND_NAME = "DM Panda"
DEFAULT_PREHEADER = "Important update from DM Panda."
DEFAULT_LOGO_URL = "https://dmpanda.com/images/logo.png"

COLORS = {
    "canvas": "#f4f4f5",
    "card": "#ffffff",
    "border": "#e4e4e7",
    "border_light": "#f4f4f5",
    "ink": "#09090b",
    "body": "#27272a",
    "muted": "#52525b",
    "subtle": "#71717a",
    "faint": "#a1a1aa",
    "primary": "#09090b",
    "primary_text": "#ffffff",
    "accent_soft": "#f4f4f5",
    "info_bg": "#fafafa",
    "info_border": "#e4e4e7",
    "info_text": "#09090b",
    "warning_bg": "#fffbeb",
    "warning_border": "#fef08a",
    "warning_text": "#854d0e",
    "critical_bg": "#fef2f2",
    "critical_border": "#fecaca",
    "critical_text": "#991b1b",
}


def escape_html(value=""):
    return escape(str(value or ""), quote=True)


def strip_html(value=""):
    text = re.sub(r"<style[\s\S]*?</style>", " ", str(value or ""), flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (text.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&#39;", "'")
                .replace("&quot;", '"'))
    return re.sub(r"\s+", " ", text).strip()


def trim_trailing_slash(value=""):
    return str(value or "").rstrip("/")


def build_logo_url(frontend_origin=""):
    base = trim_trailing_slash(frontend_origin)
    return f"{base}/images/logo.png" if base else DEFAULT_LOGO_URL


def render_html_footer(*, support_email=SUPPORT_EMAIL, support_note="", footer_note="", dashboard_url=""):
    contact_line = support_note or f"Questions? Contact {support_email}."
    dash_link = f'<p style="margin:0 0 6px;"><a href="{escape_html(dashboard_url)}" style="color:{COLORS["ink"]};text-decoration:none;font-weight:600;">Go to dashboard &rarr;</a></p>' if dashboard_url else ""
    extra_note = f'<p style="margin:0 0 6px;">{escape_html(footer_note)}</p>' if footer_note else ""
    return (
        f'<div style="border-top:1px solid {COLORS["border_light"]};padding-top:18px;color:{COLORS["faint"]};font-size:12px;line-height:1.6;">'
        f'<p style="margin:0 0 6px;">{escape_html(contact_line)}</p>'
        f'{dash_link}'
        f'{extra_note}'
        f'<p style="margin:8px 0 0;color:{COLORS["faint"]};font-size:11px;">DM Panda &bull; Instagram Automation</p>'
        '</div>'
    )


def render_paragraphs(paragraphs):
    return "".join(
        f'<p style="margin:0 0 12px;color:{COLORS["body"]};font-size:14px;line-height:1.6;">{escape_html(p)}</p>'
        for p in (paragraphs or [])
        if str(p or "").strip()
    )


def render_bullets(items):
    safe_items = [str(item).strip() for item in (items or []) if str(item or "").strip()]
    if not safe_items:
        return ""
    rendered_items = "".join(
        f'<li style="margin:0 0 6px;">{escape_html(item)}</li>'
        for item in safe_items
    )
    return (
        f'<ul style="margin:0 0 14px 18px;padding:0;color:{COLORS["body"]};font-size:13px;line-height:1.6;">'
        f'{rendered_items}</ul>'
    )


def render_callout(tone="info", title="", lines=None):
    palette = {
        "critical": (COLORS["critical_bg"], COLORS["critical_border"], COLORS["critical_text"]),
        "warning": (COLORS["warning_bg"], COLORS["warning_border"], COLORS["warning_text"]),
    }.get(tone, (COLORS["info_bg"], COLORS["info_border"], COLORS["info_text"]))
    safe_lines = [str(line).strip() for line in (lines or []) if str(line or "").strip()]
    if not title and not safe_lines:
        return ""
    bg, border, text = palette
    rendered_lines = "".join(
        f'<p style="margin:0 0 3px;color:{text};font-size:13px;line-height:1.5;">{escape_html(line)}</p>'
        for line in safe_lines
    )
    heading = (
        f'<p style="margin:0 0 4px;color:{text};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">'
        f'{escape_html(title)}</p>'
        if title else ""
    )
    return (
        f'<div style="margin:0 0 16px;padding:12px 14px;background:{bg};border:1px solid {border};border-radius:8px;">'
        f'{heading}{rendered_lines}</div>'
    )


def render_summary(rows):
    safe_rows = [
        (str(label).strip(), str(value).strip())
        for label, value in (rows or [])
        if str(label or "").strip() and str(value or "").strip()
    ]
    if not safe_rows:
        return ""
    rendered_rows = "".join(
        '<tr>'
        f'<td style="padding:6px 0;color:{COLORS["subtle"]};font-size:13px;font-weight:500;vertical-align:top;">{escape_html(label)}</td>'
        f'<td style="padding:6px 0;color:{COLORS["ink"]};font-size:13px;font-weight:600;vertical-align:top;text-align:right;">{escape_html(value)}</td>'
        '</tr>'
        for label, value in safe_rows
    )
    return (
        f'<div style="margin:0 0 16px;padding:12px 16px;background:{COLORS["info_bg"]};border:1px solid {COLORS["border_light"]};border-radius:8px;">'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">{rendered_rows}</table>'
        '</div>'
    )


def render_button(label="", url=""):
    if not str(label or "").strip() or not str(url or "").strip():
        return ""
    return (
        '<div style="margin:20px 0 14px;">'
        f'<a href="{escape_html(url)}" style="display:inline-block;padding:11px 22px;background:{COLORS["primary"]};border-radius:7px;'
        f'color:{COLORS["primary_text"]};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.01em;">'
        f'{escape_html(label)}</a></div>'
    )


def render_secondary_links(links):
    safe_links = [
        link for link in (links or [])
        if str(link.get("label") or "").strip() and str(link.get("url") or "").strip()
    ]
    if not safe_links:
        return ""
    rendered = "".join(
        f'<a href="{escape_html(link["url"])}" style="display:inline-block;margin-right:14px;color:{COLORS["subtle"]};text-decoration:none;font-size:13px;font-weight:500;">'
        f'{escape_html(link["label"])}</a>'
        for link in safe_links
    )
    return f'<div style="margin:0 0 14px;">{rendered}</div>'


def render_email_html(*, title, preheader=DEFAULT_PREHEADER, eyebrow="", greeting="", intro="",
                      paragraphs=None, bullets=None, callouts=None, summary_rows=None, body_html="",
                      cta_label="", cta_url="", secondary_links=None, footer_note="", support_note="",
                      frontend_origin="", support_email=SUPPORT_EMAIL):
    logo_url = build_logo_url(frontend_origin)
    trimmed_frontend_origin = trim_trailing_slash(frontend_origin)
    dashboard_url = f"{trimmed_frontend_origin}/dashboard" if trimmed_frontend_origin else ""
    eyebrow_html = (
        f'<td align="right" style="vertical-align:middle;">'
        f'<span style="display:inline-block;padding:2px 8px;border-radius:5px;background:{COLORS["accent_soft"]};border:1px solid {COLORS["border"]};color:{COLORS["subtle"]};font-size:11px;font-weight:600;letter-spacing:0.02em;">{escape_html(eyebrow)}</span>'
        '</td>'
    ) if eyebrow else ""

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{escape_html(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:{COLORS["canvas"]};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{escape_html(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{COLORS["canvas"]};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:{COLORS["card"]};border:1px solid {COLORS["border"]};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding:22px 28px 16px;border-bottom:1px solid {COLORS["border_light"]};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="{escape_html(logo_url)}" alt="{BRAND_NAME}" width="28" height="28" style="display:block;border-radius:6px;object-fit:contain;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:15px;font-weight:700;color:{COLORS["ink"]};letter-spacing:-0.01em;">{BRAND_NAME}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    {eyebrow_html}
                  </tr>
                </table>
                <h1 style="margin:16px 0 0;color:{COLORS["ink"]};font-size:18px;font-weight:700;line-height:1.35;letter-spacing:-0.015em;">{escape_html(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 18px;">
                {f'<p style="margin:0 0 10px;color:{COLORS["ink"]};font-size:14px;font-weight:600;">{escape_html(greeting)}</p>' if greeting else ''}
                {f'<p style="margin:0 0 14px;color:{COLORS["body"]};font-size:14px;line-height:1.6;">{escape_html(intro)}</p>' if intro else ''}
                {"".join(render_callout(**callout) for callout in (callouts or []))}
                {render_summary(summary_rows)}
                {render_paragraphs(paragraphs)}
                {render_bullets(bullets)}
                {f'<div style="margin:0 0 14px;padding:12px 14px;background:{COLORS["info_bg"]};border:1px solid {COLORS["border"]};border-radius:8px;color:{COLORS["body"]};font-size:13px;line-height:1.6;">{body_html}</div>' if body_html else ''}
                {render_button(cta_label, cta_url)}
                {render_secondary_links(secondary_links)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 22px;">
                {render_html_footer(
                    support_email=support_email,
                    support_note=support_note,
                    footer_note=footer_note,
                    dashboard_url=dashboard_url
                )}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def build_plain_text_email(*, title, greeting="", intro="", paragraphs=None, bullets=None,
                           summary_rows=None, cta_label="", cta_url="", footer_note="",
                           support_note="", body_text=""):
    lines = [BRAND_NAME, title, ""]
    if greeting:
        lines.extend([greeting, ""])
    if intro:
        lines.extend([intro, ""])
    for label, value in (summary_rows or []):
        if str(label or "").strip() and str(value or "").strip():
            lines.append(f"{label}: {value}")
    if summary_rows:
        lines.append("")
    for paragraph in (paragraphs or []):
        if str(paragraph or "").strip():
            lines.extend([str(paragraph).strip(), ""])
    for bullet in (bullets or []):
        if str(bullet or "").strip():
            lines.append(f"- {str(bullet).strip()}")
    if bullets:
        lines.append("")
    if str(body_text or "").strip():
        lines.extend([str(body_text).strip(), ""])
    if str(cta_label or "").strip() and str(cta_url or "").strip():
        lines.extend([f"{cta_label}: {cta_url}", ""])
    lines.append(support_note or f"Questions? Contact {SUPPORT_EMAIL}.")
    if footer_note:
        lines.append(footer_note)
    lines.append(BRAND_NAME)
    return "\n".join(lines).replace("\n\n\n", "\n\n").strip()
