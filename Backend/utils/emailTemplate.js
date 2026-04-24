const SUPPORT_EMAIL = 'support@dmpanda.com';
const BRAND_NAME = 'DM Panda';
const DEFAULT_EYEBROW = 'DM Panda';
const DEFAULT_PREHEADER = 'Important update from DM Panda.';

const COLORS = {
    canvas: '#f4f7fb',
    card: '#ffffff',
    border: '#dbe4f0',
    ink: '#0f172a',
    muted: '#475569',
    subtle: '#64748b',
    accent: '#f97316',
    accentDark: '#ea580c',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
    infoText: '#1d4ed8',
    warningBg: '#fff7ed',
    warningBorder: '#fdba74',
    warningText: '#c2410c',
    criticalBg: '#fff1f2',
    criticalBorder: '#fda4af',
    criticalText: '#be123c'
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

const renderParagraphs = (paragraphs = []) => paragraphs
    .filter((paragraph) => String(paragraph || '').trim())
    .map((paragraph) => (
        `<p style="margin:0 0 16px;color:${COLORS.muted};font-size:15px;line-height:1.75;">${escapeHtml(paragraph)}</p>`
    ))
    .join('');

const renderList = (items = []) => {
    const safeItems = items.filter((item) => String(item || '').trim());
    if (!safeItems.length) return '';
    const renderedItems = safeItems
        .map((item) => `<li style="margin:0 0 10px;">${escapeHtml(item)}</li>`)
        .join('');
    return `<ul style="margin:0 0 18px 20px;padding:0;color:${COLORS.muted};font-size:15px;line-height:1.7;">${renderedItems}</ul>`;
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
        `<div style="margin:0 0 20px;padding:16px 18px;background:${palette.bg};border:1px solid ${palette.border};border-radius:16px;">`,
        title ? `<p style="margin:0 0 8px;color:${palette.text};font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>` : '',
        safeLines.map((line) => `<p style="margin:0 0 10px;color:${palette.text};font-size:14px;line-height:1.7;">${escapeHtml(line)}</p>`).join(''),
        '</div>'
    ].join('');
};

const renderSummary = (rows = []) => {
    const safeRows = rows.filter((row) => Array.isArray(row) && String(row[0] || '').trim() && String(row[1] || '').trim());
    if (!safeRows.length) return '';
    const renderedRows = safeRows.map(([label, value]) => (
        `<tr>
            <td style="padding:10px 0;color:${COLORS.subtle};font-size:13px;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;color:${COLORS.ink};font-size:14px;font-weight:600;vertical-align:top;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )).join('');
    return `
        <div style="margin:0 0 22px;padding:18px 20px;background:#f8fafc;border:1px solid ${COLORS.border};border-radius:18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                ${renderedRows}
            </table>
        </div>
    `;
};

const renderPrimaryButton = (label = '', url = '') => {
    if (!String(label || '').trim() || !String(url || '').trim()) return '';
    return `
        <div style="margin:24px 0 14px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;background:${COLORS.accent};border-radius:14px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                ${escapeHtml(label)}
            </a>
        </div>
    `;
};

const renderSecondaryLinks = (links = []) => {
    const safeLinks = links.filter((link) => String(link?.label || '').trim() && String(link?.url || '').trim());
    if (!safeLinks.length) return '';
    return `
        <div style="margin:0 0 18px;">
            ${safeLinks.map((link) => (
                `<a href="${escapeHtml(link.url)}" style="display:inline-block;margin-right:16px;color:${COLORS.accentDark};text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(link.label)}</a>`
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
    const dashboardUrl = frontendOrigin ? `${trimTrailingSlash(frontendOrigin)}/dashboard` : '';
    const resolvedSupportNote = String(supportNote || '').trim()
        || `Need help? Contact ${supportEmail}.`;
    const footerLines = [
        escapeHtml(resolvedSupportNote),
        dashboardUrl
            ? `<div style="margin-top:8px;"><a href="${escapeHtml(dashboardUrl)}" style="color:${COLORS.accentDark};text-decoration:none;font-weight:700;">Open DM Panda dashboard</a></div>`
            : '',
        footerNote
            ? `<div style="margin-top:10px;">${escapeHtml(footerNote)}</div>`
            : '',
        `<div style="margin-top:12px;">DM Panda, Instagram automation and lead capture for growing teams.</div>`
    ].join('');

    return `
<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title || BRAND_NAME)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.canvas};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.canvas};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 58%,#334155 100%);">
                ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${BRAND_NAME}" width="56" height="56" style="display:block;border-radius:16px;background:#ffffff;padding:6px;object-fit:contain;" />` : ''}
                <p style="margin:18px 0 8px;color:#cbd5e1;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 34px;">
                ${greeting ? `<p style="margin:0 0 16px;color:${COLORS.ink};font-size:15px;font-weight:700;">${escapeHtml(greeting)}</p>` : ''}
                ${intro ? `<p style="margin:0 0 18px;color:${COLORS.ink};font-size:16px;line-height:1.7;">${escapeHtml(intro)}</p>` : ''}
                ${callouts.map((callout) => renderCallout(callout)).join('')}
                ${renderSummary(summaryRows)}
                ${renderParagraphs(paragraphs)}
                ${renderList(bullets)}
                ${bodyHtml}
                ${renderPrimaryButton(ctaLabel, ctaUrl)}
                ${renderSecondaryLinks(secondaryLinks)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="border-top:1px solid ${COLORS.border};padding-top:18px;color:${COLORS.subtle};font-size:13px;line-height:1.7;">
                  ${footerLines}
                </div>
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
    lines.push(supportNote || `Need help? Contact ${SUPPORT_EMAIL}.`);
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
