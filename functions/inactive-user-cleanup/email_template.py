import re
from html import escape

SUPPORT_EMAIL = "support@dmpanda.com"
BRAND_NAME = "DM Panda"
DEFAULT_PREHEADER = "Important update from DM Panda."

COLORS = {
    "canvas": "#f8fafc",
    "card": "#ffffff",
    "border": "#e2e8f0",
    "border_light": "#f1f5f9",
    "ink": "#0f172a",
    "body": "#334155",
    "muted": "#475569",
    "subtle": "#64748b",
    "faint": "#94a3b8",
    "primary": "#0f172a",
    "primary_text": "#ffffff",
    "accent": "#0f172a",
    "accent_dark": "#1e293b",
    "accent_soft": "#f1f5f9",
    "info_bg": "#f8fafc",
    "info_border": "#e2e8f0",
    "info_text": "#0f172a",
    "warning_bg": "#fffbeb",
    "warning_border": "#fde68a",
    "warning_text": "#92400e",
    "critical_bg": "#fef2f2",
    "critical_border": "#fecdd3",
    "critical_text": "#9f1239",
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
    return f"{base}/images/logo.png" if base else ""


def render_html_footer(*, support_email=SUPPORT_EMAIL, support_note="", footer_note="", dashboard_url=""):
    lines = [
        support_note or f"Need a hand? Contact {support_email}.",
        "You are receiving this email because you use DM Panda or recently interacted with your account settings, billing, or automation activity.",
    ]
    return (
        f'<div style="border-top:1px solid {COLORS["border_light"]};padding-top:20px;color:{COLORS["faint"]};font-size:12px;line-height:1.65;">'
        f'<p style="margin:0 0 6px;">{escape_html(lines[0])}</p>'
        f'<p style="margin:0 0 8px;">{escape_html(lines[1])}</p>'
        + (
            f'<p style="margin:0 0 8px;"><a href="{escape_html(dashboard_url)}" style="color:{COLORS["ink"]};text-decoration:underline;font-weight:600;">Open your DM Panda dashboard &rarr;</a></p>'
            if dashboard_url else ""
        )
        + (f'<p style="margin:0 0 8px;">{escape_html(footer_note)}</p>' if footer_note else "")
        + f'<p style="margin:0;color:{COLORS["faint"]};">DM Panda &bull; Instagram automation & lead capture</p>'
        + "</div>"
    )


def render_paragraphs(paragraphs):
    return "".join(
        f'<p style="margin:0 0 14px;color:{COLORS["body"]};font-size:14px;line-height:1.65;">{escape_html(paragraph)}</p>'
        for paragraph in (paragraphs or [])
        if str(paragraph or "").strip()
    )


def render_bullets(items):
    safe_items = [str(item).strip() for item in (items or []) if str(item or "").strip()]
    if not safe_items:
        return ""
    rendered_items = "".join(
        f'<li style="margin:0 0 8px;">{escape_html(item)}</li>'
        for item in safe_items
    )
    return (
        f'<ul style="margin:0 0 16px 20px;padding:0;color:{COLORS["body"]};font-size:14px;line-height:1.65;">'
        f"{rendered_items}</ul>"
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
        f'<p style="margin:0 0 6px;color:{text};font-size:13px;line-height:1.6;">{escape_html(line)}</p>'
        for line in safe_lines
    )
    heading = (
        f'<p style="margin:0 0 6px;color:{text};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">'
        f"{escape_html(title)}</p>"
        if title else ""
    )
    return (
        f'<div style="margin:0 0 18px;padding:14px 16px;background:{bg};border:1px solid {border};border-radius:12px;">'
        f"{heading}{rendered_lines}</div>"
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
        "<tr>"
        f'<td style="padding:8px 0;color:{COLORS["subtle"]};font-size:13px;font-weight:500;vertical-align:top;">{escape_html(label)}</td>'
        f'<td style="padding:8px 0;color:{COLORS["ink"]};font-size:13px;font-weight:600;vertical-align:top;text-align:right;">{escape_html(value)}</td>'
        "</tr>"
        for label, value in safe_rows
    )
    return (
        f'<div style="margin:0 0 20px;padding:14px 18px;background:{COLORS["info_bg"]};border:1px solid {COLORS["border"]};border-radius:12px;">'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">{rendered_rows}</table>'
        "</div>"
    )


def render_button(label="", url=""):
    if not str(label or "").strip() or not str(url or "").strip():
        return ""
    return (
        '<div style="margin:24px 0 16px;">'
        f'<a href="{escape_html(url)}" style="display:inline-block;padding:12px 24px;background:{COLORS["primary"]};border-radius:8px;'
        f'color:{COLORS["primary_text"]};text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">'
        f"{escape_html(label)}</a></div>"
    )


def render_secondary_links(links):
    safe_links = [
        link for link in (links or [])
        if str(link.get("label") or "").strip() and str(link.get("url") or "").strip()
    ]
    if not safe_links:
        return ""
    rendered = "".join(
        f'<a href="{escape_html(link["url"])}" style="display:inline-block;margin-right:16px;color:{COLORS["subtle"]};text-decoration:underline;font-size:13px;font-weight:600;">'
        f'{escape_html(link["label"])}</a>'
        for link in safe_links
    )
    return f'<div style="margin:0 0 16px;">{rendered}</div>'


def render_email_html(*, title, preheader=DEFAULT_PREHEADER, eyebrow=BRAND_NAME, greeting="Hello,", intro="",
                      paragraphs=None, bullets=None, callouts=None, summary_rows=None, body_html="",
                      cta_label="", cta_url="", secondary_links=None, footer_note="", support_note="",
                      frontend_origin="", support_email=SUPPORT_EMAIL):
    logo_url = build_logo_url(frontend_origin)
    logo_html = (
        f'<img src="{escape_html(logo_url)}" alt="{BRAND_NAME}" width="38" height="38" style="display:block;border-radius:8px;object-fit:contain;" />'
        if logo_url
        else f'<span style="font-size:16px;font-weight:800;color:{COLORS["ink"]};letter-spacing:-0.02em;">DM Panda</span>'
    )
    trimmed_frontend_origin = trim_trailing_slash(frontend_origin)
    dashboard_url = f"{trimmed_frontend_origin}/dashboard" if trimmed_frontend_origin else ""
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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:{COLORS["card"]};border:1px solid {COLORS["border"]};border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.04);">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid {COLORS["border_light"]};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      {logo_html}
                    </td>
                    {f'''<td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">{escape_html(eyebrow)}</span>
                    </td>''' if eyebrow else ''}
                  </tr>
                </table>
                <h1 style="margin:18px 0 0;color:{COLORS["ink"]};font-size:21px;font-weight:700;line-height:1.3;letter-spacing:-0.015em;">{escape_html(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 20px;">
                {f'<p style="margin:0 0 12px;color:{COLORS["ink"]};font-size:14px;font-weight:600;">{escape_html(greeting)}</p>' if greeting else ''}
                {f'<p style="margin:0 0 18px;color:{COLORS["body"]};font-size:14px;line-height:1.65;">{escape_html(intro)}</p>' if intro else ''}
                {"".join(render_callout(**callout) for callout in (callouts or []))}
                {render_summary(summary_rows)}
                {render_paragraphs(paragraphs)}
                {render_bullets(bullets)}
                {f'<div style="margin:0 0 16px;padding:14px 16px;background:{COLORS["accent_soft"]};border:1px solid {COLORS["border"]};border-radius:12px;color:{COLORS["body"]};font-size:14px;line-height:1.65;">{body_html}</div>' if body_html else ''}
                {render_button(cta_label, cta_url)}
                {render_secondary_links(secondary_links)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
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


def build_plain_text_email(*, title, greeting="Hello,", intro="", paragraphs=None, bullets=None,
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
    lines.append(support_note or f"Need a hand? Contact {SUPPORT_EMAIL}.")
    lines.append("You are receiving this email because you use DM Panda or recently interacted with your account settings, billing, or automation activity.")
    if footer_note:
        lines.append(footer_note)
    lines.append(BRAND_NAME)
    return "\n".join(lines).replace("\n\n\n", "\n\n").strip()
