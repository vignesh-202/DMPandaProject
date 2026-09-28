const SUPPORT_EMAIL = 'support@dmpanda.com';
const BRAND_NAME = 'DM Panda';
const DEFAULT_EYEBROW = 'DM Panda';
const DEFAULT_PREHEADER = 'Important update from DM Panda.';

const COLORS = {
    canvas: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    ink: '#0f172a',
    body: '#334155',
    muted: '#475569',
    subtle: '#64748b',
    faint: '#94a3b8',
    primary: '#0f172a',
    primaryText: '#ffffff',
    accent: '#0f172a',
    accentDark: '#1e293b',
    accentSoft: '#f1f5f9',
    infoBg: '#f8fafc',
    infoBorder: '#e2e8f0',
    infoText: '#0f172a',
    warningBg: '#fffbeb',
    warningBorder: '#fde68a',
    warningText: '#92400e',
    criticalBg: '#fef2f2',
    criticalBorder: '#fecdd3',
    criticalText: '#9f1239'
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
    return base ? `${base}/images/logo.png` : '';
};

const renderHtmlFooter = ({
    supportEmail = SUPPORT_EMAIL,
    supportNote = '',
    footerNote = '',
    dashboardUrl = ''
} = {}) => {
    const lines = [
        supportNote || `Need a hand? Contact ${supportEmail}.`,
        'You are receiving this email because you use DM Panda or recently interacted with your account settings, billing, or automation activity.'
    ];

    return `
        <div style="border-top:1px solid ${COLORS.borderLight};padding-top:20px;color:${COLORS.faint};font-size:12px;line-height:1.65;">
            <p style="margin:0 0 6px;">${escapeHtml(lines[0])}</p>
            <p style="margin:0 0 8px;">${escapeHtml(lines[1])}</p>
            ${dashboardUrl ? `<p style="margin:0 0 8px;"><a href="${escapeHtml(dashboardUrl)}" style="color:${COLORS.ink};text-decoration:underline;font-weight:600;">Open your DM Panda dashboard &rarr;</a></p>` : ''}
            ${footerNote ? `<p style="margin:0 0 8px;">${escapeHtml(footerNote)}</p>` : ''}
            <p style="margin:0;color:${COLORS.faint};">DM Panda &bull; Instagram automation & lead capture</p>
        </div>
    `;
};

const renderParagraphs = (paragraphs = []) => paragraphs
    .filter((paragraph) => String(paragraph || '').trim())
    .map((paragraph) => (
        `<p style="margin:0 0 14px;color:${COLORS.body};font-size:14px;line-height:1.65;">${escapeHtml(paragraph)}</p>`
    ))
    .join('');

const renderList = (items = []) => {
    const safeItems = items.filter((item) => String(item || '').trim());
    if (!safeItems.length) return '';
    const renderedItems = safeItems
        .map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`)
        .join('');
    return `<ul style="margin:0 0 16px 20px;padding:0;color:${COLORS.body};font-size:14px;line-height:1.65;">${renderedItems}</ul>`;
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
        `<div style="margin:0 0 18px;padding:14px 16px;background:${palette.bg};border:1px solid ${palette.border};border-radius:12px;">`,
        title ? `<p style="margin:0 0 6px;color:${palette.text};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>` : '',
        safeLines.map((line) => `<p style="margin:0 0 6px;color:${palette.text};font-size:13px;line-height:1.6;">${escapeHtml(line)}</p>`).join(''),
        '</div>'
    ].join('');
};

const renderSummary = (rows = []) => {
    const safeRows = rows.filter((row) => Array.isArray(row) && String(row[0] || '').trim() && String(row[1] || '').trim());
    if (!safeRows.length) return '';
    const renderedRows = safeRows.map(([label, value]) => (
        `<tr>
            <td style="padding:8px 0;color:${COLORS.subtle};font-size:13px;font-weight:500;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;color:${COLORS.ink};font-size:13px;font-weight:600;vertical-align:top;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )).join('');
    return `
        <div style="margin:0 0 20px;padding:14px 18px;background:${COLORS.infoBg};border:1px solid ${COLORS.border};border-radius:12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                ${renderedRows}
            </table>
        </div>
    `;
};

const renderPrimaryButton = (label = '', url = '') => {
    if (!String(label || '').trim() || !String(url || '').trim()) return '';
    return `
        <div style="margin:24px 0 16px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:${COLORS.primary};border-radius:8px;color:${COLORS.primaryText};text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">
                ${escapeHtml(label)}
            </a>
        </div>
    `;
};

const renderSecondaryLinks = (links = []) => {
    const safeLinks = links.filter((link) => String(link?.label || '').trim() && String(link?.url || '').trim());
    if (!safeLinks.length) return '';
    return `
        <div style="margin:0 0 16px;">
            ${safeLinks.map((link) => (
                `<a href="${escapeHtml(link.url)}" style="display:inline-block;margin-right:16px;color:${COLORS.subtle};text-decoration:underline;font-size:13px;font-weight:600;">${escapeHtml(link.label)}</a>`
            )).join('')}
        </div>
    `;
};

const renderEmailLayout = ({
    title,
    preheader = DEFAULT_PREHEADER,
    eyebrow = DEFAULT_EYEBROW,
    greeting = 'Hello,',
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
    const logoMarkup = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${BRAND_NAME}" width="38" height="38" style="display:block;border-radius:8px;object-fit:contain;" />`
        : `<span style="font-size:16px;font-weight:800;color:${COLORS.ink};letter-spacing:-0.02em;">DM Panda</span>`;
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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.04);">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${COLORS.borderLight};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      ${logoMarkup}
                    </td>
                    ${eyebrow ? `
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                        ${escapeHtml(eyebrow)}
                      </span>
                    </td>` : ''}
                  </tr>
                </table>
                <h1 style="margin:18px 0 0;color:${COLORS.ink};font-size:21px;font-weight:700;line-height:1.3;letter-spacing:-0.015em;">
                  ${escapeHtml(title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 20px;">
                ${greeting ? `<p style="margin:0 0 12px;color:${COLORS.ink};font-size:14px;font-weight:600;">${escapeHtml(greeting)}</p>` : ''}
                ${intro ? `<p style="margin:0 0 18px;color:${COLORS.body};font-size:14px;line-height:1.65;">${escapeHtml(intro)}</p>` : ''}
                ${callouts.map((callout) => renderCallout(callout)).join('')}
                ${renderSummary(summaryRows)}
                ${renderParagraphs(paragraphs)}
                ${renderList(bullets)}
                ${bodyHtml ? `<div style="margin:0 0 16px;padding:16px 18px;background:${COLORS.infoBg};border:1px solid ${COLORS.border};border-radius:12px;color:${COLORS.body};font-size:14px;line-height:1.65;">${bodyHtml}</div>` : ''}
                ${renderPrimaryButton(ctaLabel, ctaUrl)}
                ${renderSecondaryLinks(secondaryLinks)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
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
    greeting = 'Hello,',
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
    lines.push(supportNote || `Need a hand? Contact ${SUPPORT_EMAIL}.`);
    lines.push('You are receiving this email because you use DM Panda or recently interacted with your account settings, billing, or automation activity.');
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
    const safeSubject = String(subject || '').trim() || 'DM Panda update';
    const safeContent = String(content || '').trim();
    const isHtml = format === 'html';
    const bodyHtml = isHtml
        ? `<div style="margin:0 0 18px;color:${COLORS.muted};font-size:15px;line-height:1.75;">${safeContent}</div>`
        : renderParagraphs(safeContent.split(/\r?\n\r?\n/));
    const plainTextSource = isHtml ? stripHtml(safeContent) : safeContent;
    return {
        html: renderEmailLayout({
            title: safeSubject,
            preheader: 'A DM Panda campaign update for your account.',
            greeting: 'Hello,',
            intro: 'You are receiving this email because your account matches a campaign audience selected by the DM Panda team.',
            bodyHtml,
            footerNote: 'This message was sent from the DM Panda admin campaign tool.',
            frontendOrigin
        }),
        text: buildPlainTextEmail({
            title: safeSubject,
            greeting: 'Hello,',
            intro: 'You are receiving this email because your account matches a campaign audience selected by the DM Panda team.',
            bodyText: plainTextSource,
            footerNote: 'This message was sent from the DM Panda admin campaign tool.'
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
