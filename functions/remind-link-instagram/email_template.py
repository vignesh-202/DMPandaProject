import re
from html import escape

SUPPORT_EMAIL = "support@dmpanda.com"
BRAND_NAME = "DM Panda"
DEFAULT_PREHEADER = "Important update from DM Panda."

COLORS = {
    "canvas": "#f4f7fb",
    "card": "#ffffff",
    "border": "#dbe4f0",
    "ink": "#0f172a",
    "muted": "#475569",
    "subtle": "#64748b",
    "accent": "#f97316",
    "accent_dark": "#ea580c",
    "info_bg": "#eff6ff",
    "info_border": "#bfdbfe",
    "info_text": "#1d4ed8",
    "warning_bg": "#fff7ed",
    "warning_border": "#fdba74",
    "warning_text": "#c2410c",
    "critical_bg": "#fff1f2",
    "critical_border": "#fda4af",
    "critical_text": "#be123c",
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


def render_paragraphs(paragraphs):
    return "".join(
        f'<p style="margin:0 0 16px;color:{COLORS["muted"]};font-size:15px;line-height:1.75;">{escape_html(paragraph)}</p>'
        for paragraph in (paragraphs or [])
        if str(paragraph or "").strip()
    )


def render_bullets(items):
    safe_items = [str(item).strip() for item in (items or []) if str(item or "").strip()]
    if not safe_items:
        return ""
    rendered_items = "".join(
        f'<li style="margin:0 0 10px;">{escape_html(item)}</li>'
        for item in safe_items
    )
    return (
        f'<ul style="margin:0 0 18px 20px;padding:0;color:{COLORS["muted"]};font-size:15px;line-height:1.7;">'
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
        f'<p style="margin:0 0 10px;color:{text};font-size:14px;line-height:1.7;">{escape_html(line)}</p>'
        for line in safe_lines
    )
    heading = (
        f'<p style="margin:0 0 8px;color:{text};font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">'
        f"{escape_html(title)}</p>"
        if title else ""
    )
    return (
        f'<div style="margin:0 0 20px;padding:16px 18px;background:{bg};border:1px solid {border};border-radius:16px;">'
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
        f'<td style="padding:10px 0;color:{COLORS["subtle"]};font-size:13px;font-weight:600;vertical-align:top;">{escape_html(label)}</td>'
        f'<td style="padding:10px 0;color:{COLORS["ink"]};font-size:14px;font-weight:600;vertical-align:top;text-align:right;">{escape_html(value)}</td>'
        "</tr>"
        for label, value in safe_rows
    )
    return (
        f'<div style="margin:0 0 22px;padding:18px 20px;background:#f8fafc;border:1px solid {COLORS["border"]};border-radius:18px;">'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">{rendered_rows}</table>'
        "</div>"
    )


def render_button(label="", url=""):
    if not str(label or "").strip() or not str(url or "").strip():
        return ""
    return (
        '<div style="margin:24px 0 14px;">'
        f'<a href="{escape_html(url)}" style="display:inline-block;padding:14px 22px;background:{COLORS["accent"]};border-radius:14px;'
        'color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">'
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
        f'<a href="{escape_html(link["url"])}" style="display:inline-block;margin-right:16px;color:{COLORS["accent_dark"]};text-decoration:none;font-size:14px;font-weight:700;">'
        f'{escape_html(link["label"])}</a>'
        for link in safe_links
    )
    return f'<div style="margin:0 0 18px;">{rendered}</div>'


def render_email_html(*, title, preheader=DEFAULT_PREHEADER, eyebrow=BRAND_NAME, greeting="Hello,", intro="",
                      paragraphs=None, bullets=None, callouts=None, summary_rows=None, body_html="",
                      cta_label="", cta_url="", secondary_links=None, footer_note="", support_note="",
                      frontend_origin="", support_email=SUPPORT_EMAIL):
    logo_url = build_logo_url(frontend_origin)
    logo_html = (
        f'<img src="{escape_html(logo_url)}" alt="{BRAND_NAME}" width="56" height="56" style="display:block;border-radius:16px;background:#ffffff;padding:6px;object-fit:contain;" />'
        if logo_url
        else f'<div style="display:inline-block;border-radius:16px;background:#ffffff;padding:12px 14px;color:{COLORS["ink"]};font-size:18px;font-weight:900;letter-spacing:0.02em;">DM Panda</div>'
    )
    dashboard_url = f"{trim_trailing_slash(frontend_origin)}/dashboard" if trim_trailing_slash(frontend_origin) else ""
    footer_html = (
        f'{escape_html(support_note or f"Need help? Contact {support_email}.")}'
        + (f'<div style="margin-top:8px;"><a href="{escape_html(dashboard_url)}" style="color:{COLORS["accent_dark"]};text-decoration:none;font-weight:700;">Open DM Panda dashboard</a></div>' if dashboard_url else "")
        + (f'<div style="margin-top:10px;">{escape_html(footer_note)}</div>' if footer_note else "")
        + '<div style="margin-top:12px;">DM Panda, Instagram automation and lead capture for growing teams.</div>'
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{escape_html(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:{COLORS["canvas"]};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{escape_html(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{COLORS["canvas"]};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:{COLORS["card"]};border:1px solid {COLORS["border"]};border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 58%,#334155 100%);">
                {logo_html}
                <p style="margin:18px 0 8px;color:#cbd5e1;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">{escape_html(eyebrow)}</p>
                <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;">{escape_html(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 34px;">
                {f'<p style="margin:0 0 16px;color:{COLORS["ink"]};font-size:15px;font-weight:700;">{escape_html(greeting)}</p>' if greeting else ''}
                {f'<p style="margin:0 0 18px;color:{COLORS["ink"]};font-size:16px;line-height:1.7;">{escape_html(intro)}</p>' if intro else ''}
                {"".join(render_callout(**callout) for callout in (callouts or []))}
                {render_summary(summary_rows)}
                {render_paragraphs(paragraphs)}
                {render_bullets(bullets)}
                {body_html}
                {render_button(cta_label, cta_url)}
                {render_secondary_links(secondary_links)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="border-top:1px solid {COLORS["border"]};padding-top:18px;color:{COLORS["subtle"]};font-size:13px;line-height:1.7;">
                  {footer_html}
                </div>
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
    lines.append(support_note or f"Need help? Contact {SUPPORT_EMAIL}.")
    if footer_note:
        lines.append(footer_note)
    lines.append(BRAND_NAME)
    return "\n".join(lines).replace("\n\n\n", "\n\n").strip()
