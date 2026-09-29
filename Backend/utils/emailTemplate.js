const SUPPORT_EMAIL = 'support@dmpanda.com';
const BRAND_NAME = 'DM Panda';
const DEFAULT_EYEBROW = '';
const DEFAULT_PREHEADER = 'Important update from DM Panda.';
const DEFAULT_LOGO_URL = 'https://dmpanda.com/images/logo.png';

const COLORS = {
    canvas: '#f4f4f5',
    card: '#ffffff',
    border: '#e4e4e7',
    borderLight: '#f4f4f5',
    ink: '#09090b',
    body: '#27272a',
    muted: '#52525b',
    subtle: '#71717a',
    faint: '#a1a1aa',
    primary: '#09090b',
    primaryText: '#ffffff',
    accentSoft: '#f4f4f5',
    infoBg: '#fafafa',
    infoBorder: '#e4e4e7',
    infoText: '#09090b',
    warningBg: '#fffbeb',
    warningBorder: '#fef08a',
    warningText: '#854d0e',
    criticalBg: '#fef2f2',
    criticalBorder: '#fecaca',
    criticalText: '#991b1b'
};

const escapeHtml = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value = '') => String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const buildLogoUrl = (frontendOrigin = '') => {
    const base = trimTrailingSlash(frontendOrigin);
    return base ? `${base}/images/logo.png` : DEFAULT_LOGO_URL;
};

const renderHtmlFooter = ({
    supportEmail = SUPPORT_EMAIL,
    supportNote = '',
    footerNote = '',
    dashboardUrl = ''
} = {}) => {
    const contactLine = supportNote || `Questions? Contact ${supportEmail}.`;
    return `
        <div style="border-top:1px solid ${COLORS.borderLight};padding-top:18px;color:${COLORS.faint};font-size:12px;line-height:1.6;">
            <p style="margin:0 0 6px;">${escapeHtml(contactLine)}</p>
            ${dashboardUrl ? `<p style="margin:0 0 6px;"><a href="${escapeHtml(dashboardUrl)}" style="color:${COLORS.ink};text-decoration:none;font-weight:600;">Go to dashboard &rarr;</a></p>` : ''}
            ${footerNote ? `<p style="margin:0 0 6px;">${escapeHtml(footerNote)}</p>` : ''}
            <p style="margin:8px 0 0;color:${COLORS.faint};font-size:11px;">DM Panda &bull; Instagram Automation</p>
        </div>
    `;
};

const renderParagraphs = (paragraphs = []) => paragraphs
    .filter((paragraph) => String(paragraph || '').trim())
    .map((paragraph) => (
        `<p style="margin:0 0 12px;color:${COLORS.body};font-size:14px;line-height:1.6;">${escapeHtml(paragraph)}</p>`
    ))
    .join('');

const renderList = (items = []) => {
    const safeItems = items.filter((item) => String(item || '').trim());
    if (!safeItems.length) return '';
    const renderedItems = safeItems
        .map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
        .join('');
    return `<ul style="margin:0 0 14px 18px;padding:0;color:${COLORS.body};font-size:13px;line-height:1.6;">${renderedItems}</ul>`;
};

const renderCallout = ({ tone = 'info', title = '', lines = [] } = {}) => {
    const palette = tone === 'critical'
        ? { bg: COLORS.criticalBg, border: COLORS.criticalBorder, text: COLORS.criticalText }
        : tone === 'warning'
            ? { bg: COLORS.warningBg, border: COLORS.warningBorder, text: COLORS.warningText }
            : { bg: COLORS.infoBg, border: COLORS.infoBorder, text: COLORS.infoText };
    const safeLines = lines.filter((line) => String(line || '').trim());
    if (!title && !safeLines.length) return '';
    return [
        `<div style="margin:0 0 16px;padding:12px 14px;background:${palette.bg};border:1px solid ${palette.border};border-radius:8px;">`,
        title ? `<p style="margin:0 0 4px;color:${palette.text};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>` : '',
        safeLines.map((line) => `<p style="margin:0 0 3px;color:${palette.text};font-size:13px;line-height:1.5;">${escapeHtml(line)}</p>`).join(''),
        '</div>'
    ].join('');
};

const renderSummary = (rows = []) => {
    const safeRows = rows.filter((row) => Array.isArray(row) && String(row[0] || '').trim() && String(row[1] || '').trim());
    if (!safeRows.length) return '';
    const renderedRows = safeRows.map(([label, value]) => (
        `<tr>
            <td style="padding:6px 0;color:${COLORS.subtle};font-size:13px;font-weight:500;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:6px 0;color:${COLORS.ink};font-size:13px;font-weight:600;vertical-align:top;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )).join('');
    return `
        <div style="margin:0 0 16px;padding:12px 16px;background:${COLORS.infoBg};border:1px solid ${COLORS.borderLight};border-radius:8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                ${renderedRows}
            </table>
        </div>
    `;
};

const renderPrimaryButton = (label = '', url = '') => {
    if (!String(label || '').trim() || !String(url || '').trim()) return '';
    return `
        <div style="margin:20px 0 16px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:${COLORS.primary};border-radius:7px;color:${COLORS.primaryText};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.01em;">
                ${escapeHtml(label)}
            </a>
        </div>
    `;
};

const renderSecondaryLinks = (links = []) => {
    const safeLinks = links.filter((link) => String(link?.label || '').trim() && String(link?.url || '').trim());
    if (!safeLinks.length) return '';
    return `
        <div style="margin:0 0 14px;">
            ${safeLinks.map((link) => (
                `<a href="${escapeHtml(link.url)}" style="display:inline-block;margin-right:14px;color:${COLORS.subtle};text-decoration:none;font-size:12px;font-weight:500;">${escapeHtml(link.label)} &rarr;</a>`
            )).join('')}
        </div>
    `;
};

const renderEmailLayout = ({
    title,
    preheader = DEFAULT_PREHEADER,
    eyebrow = DEFAULT_EYEBROW,
    greeting = '',
    intro = '',
    paragraphs = [],
    bullets = [],
    callouts = [],
    summaryRows = [],
    bodyHtml = '',
    ctaLabel = '',
    ctaUrl = '',
    secondaryLinks = [],
    footerNote = '',
    supportNote = '',
    frontendOrigin = '',
    supportEmail = SUPPORT_EMAIL
} = {}) => {
    const logoUrl = buildLogoUrl(frontendOrigin);
    const dashboardUrl = frontendOrigin ? `${trimTrailingSlash(frontendOrigin)}/dashboard` : '';
    const resolvedSupportNote = String(supportNote || '').trim();

    return `
<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title || BRAND_NAME)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.canvas};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding:22px 28px 16px;border-bottom:1px solid ${COLORS.borderLight};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${escapeHtml(logoUrl)}" alt="${BRAND_NAME}" width="28" height="28" style="display:block;border-radius:6px;object-fit:contain;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:15px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.01em;">${BRAND_NAME}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    ${eyebrow ? `
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:2px 8px;border-radius:5px;background:${COLORS.accentSoft};border:1px solid ${COLORS.border};color:${COLORS.subtle};font-size:11px;font-weight:600;letter-spacing:0.02em;">
                        ${escapeHtml(eyebrow)}
                      </span>
                    </td>` : ''}
                  </tr>
                </table>
                <h1 style="margin:16px 0 0;color:${COLORS.ink};font-size:18px;font-weight:700;line-height:1.35;letter-spacing:-0.015em;">
                  ${escapeHtml(title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 18px;">
                ${greeting ? `<p style="margin:0 0 10px;color:${COLORS.ink};font-size:14px;font-weight:600;">${escapeHtml(greeting)}</p>` : ''}
                ${intro ? `<p style="margin:0 0 14px;color:${COLORS.body};font-size:14px;line-height:1.6;">${escapeHtml(intro)}</p>` : ''}
                ${callouts.map((callout) => renderCallout(callout)).join('')}
                ${renderSummary(summaryRows)}
                ${renderParagraphs(paragraphs)}
                ${renderList(bullets)}
                ${bodyHtml ? `<div style="margin:0 0 14px;padding:12px 14px;background:${COLORS.infoBg};border:1px solid ${COLORS.border};border-radius:8px;color:${COLORS.body};font-size:13px;line-height:1.6;">${bodyHtml}</div>` : ''}
                ${renderPrimaryButton(ctaLabel, ctaUrl)}
                ${renderSecondaryLinks(secondaryLinks)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 22px;">
                ${renderHtmlFooter({
                    supportEmail,
                    supportNote: resolvedSupportNote,
                    footerNote,
                    dashboardUrl
                })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();
};

const buildPlainTextEmail = ({
    title,
    greeting = '',
    intro = '',
    paragraphs = [],
    bullets = [],
    summaryRows = [],
    ctaLabel = '',
    ctaUrl = '',
    footerNote = '',
    supportNote = '',
    bodyText = ''
} = {}) => {
    const lines = [
        BRAND_NAME,
        title || BRAND_NAME,
        ''
    ];
    if (greeting) lines.push(greeting, '');
    if (intro) lines.push(intro, '');
    summaryRows
        .filter((row) => Array.isArray(row) && row[0] && row[1])
        .forEach(([label, value]) => lines.push(`${label}: ${value}`));
    if (summaryRows.length) lines.push('');
    paragraphs
        .filter((paragraph) => String(paragraph || '').trim())
        .forEach((paragraph) => lines.push(String(paragraph).trim(), ''));
    bullets
        .filter((item) => String(item || '').trim())
        .forEach((item) => lines.push(`- ${String(item).trim()}`));
    if (bullets.length) lines.push('');
    if (bodyText) lines.push(String(bodyText).trim(), '');
    if (ctaLabel && ctaUrl) {
        lines.push(`${ctaLabel}: ${ctaUrl}`, '');
    }
    lines.push(supportNote || `Questions? Contact ${SUPPORT_EMAIL}.`);
    if (footerNote) lines.push(footerNote);
    lines.push('DM Panda');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const wrapAdminCampaignEmail = ({
    subject,
    content,
    format = 'html',
    frontendOrigin = process.env.FRONTEND_ORIGIN || ''
} = {}) => {
    const safeSubject = String(subject || '').trim() || 'DM Panda Update';
    const safeContent = String(content || '').trim();
    const isHtml = format === 'html';
    const bodyHtml = isHtml
        ? `<div style="margin:0 0 14px;color:${COLORS.body};font-size:14px;line-height:1.6;">${safeContent}</div>`
        : renderParagraphs(safeContent.split(/\r?\n\r?\n/));
    const plainTextSource = isHtml ? stripHtml(safeContent) : safeContent;
    return {
        html: renderEmailLayout({
            title: safeSubject,
            preheader: 'A message from the DM Panda team.',
            bodyHtml,
            frontendOrigin
        }),
        text: buildPlainTextEmail({
            title: safeSubject,
            bodyText: plainTextSource
        })
    };
};

module.exports = {
    SUPPORT_EMAIL,
    escapeHtml,
    stripHtml,
    renderCallout,
    renderSummary,
    renderEmailLayout,
    buildPlainTextEmail,
    wrapAdminCampaignEmail
};
