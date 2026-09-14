const PDFDocument = require('pdfkit');

const PAGE = {
    width: 595.28,
    height: 841.89,
    marginX: 34,
    top: 30,
    bottom: 36,
    gutter: 14,
    contentWidth: 527
};

const CARD = {
    full: { x: PAGE.marginX, width: PAGE.contentWidth },
    left: { x: PAGE.marginX, width: (PAGE.contentWidth - PAGE.gutter) / 2 },
    right: { x: PAGE.marginX + ((PAGE.contentWidth - PAGE.gutter) / 2) + PAGE.gutter, width: (PAGE.contentWidth - PAGE.gutter) / 2 }
};

const COLORS = {
    ink: '#0F172A',
    subtext: '#475569',
    muted: '#64748B',
    border: '#E2E8F0',
    panel: '#FFFFFF',
    panelMuted: '#F8FAFC',
    banner: '#F8FAFC',
    accent: '#4F46E5',
    accentSoft: '#EEF2FF',
    success: '#059669'
};

const HEADER_META_WIDTH = 180;
const HEADER_TITLE_WIDTH = PAGE.contentWidth - HEADER_META_WIDTH - 18;
const FOOTER_META_WIDTH = 180;
const FOOTER_LINE_OFFSET = 8;

const formatMoney = (value, currency) => {
    const code = 'INR';
    const amount = Number(value || 0);
    return `${code} ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const formatShortUtcDate = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear()).slice(-2);

    return `${day}-${month}-${year}`;
};

const buildCoverageUntil = (createdAt, validityDays) => {
    if (!createdAt || !validityDays) return 'Unknown';
    const start = new Date(createdAt);
    if (Number.isNaN(start.getTime())) return 'Unknown';
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + Number(validityDays || 0) - 1);
    return formatShortUtcDate(end);
};

const normalizeStatus = (status) => String(status || 'success').trim().toUpperCase();

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const computeGatewayTax = (gatewaySurcharge, currency) => {
    const normalizedCurrency = 'INR';
    if (gatewaySurcharge <= 0 || normalizedCurrency !== 'INR') return 0;
    return roundCurrency((gatewaySurcharge * 18) / 118);
};

const formatSentenceMoney = (value, currency) => {
    const code = 'INR';
    const amount = Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${amount} ${code}`;
};

const buildNotesText = (transaction, gatewaySurcharge) => {
    let customNotes = String(transaction.notes || '').trim();
    // Clean out internal metadata markers like "Account: @username |" if present
    customNotes = customNotes.replace(/Account[s]?:\s*[@\w\d_.,\s-]+\s*(\|\s*)?/gi, '').trim();

    if (customNotes) return customNotes;

    if (gatewaySurcharge <= 0) {
        return 'No payment gateway surcharge was added to this subscription charge. The approved plan amount and the deducted amount are the same for this receipt.';
    }

    const billingLabel = String(transaction.billing_cycle || 'monthly').trim().toLowerCase() === 'yearly'
        ? 'Yearly'
        : 'Monthly';
    const surchargeText = formatSentenceMoney(gatewaySurcharge, transaction.currency);

    return `${billingLabel} subscription gateway surcharge ${surchargeText} was charged by Razorpay/payment method and is tracked separately from the approved plan amount. Gateway fee ${surchargeText} is recorded separately and does not change the approved plan amount.`;
};

const drawText = (doc, text, x, y, options = {}) => {
    doc.text(String(text || ''), x, y, options);
};

const drawRect = (doc, x, y, width, height, options = {}) => {
    const {
        fill = COLORS.panel,
        stroke = COLORS.border,
        lineWidth = 1,
        radius = 12
    } = options;

    doc.save();
    doc.lineWidth(lineWidth).strokeColor(stroke).fillColor(fill);
    doc.roundedRect(x, y, width, height, radius).fillAndStroke(fill, stroke);
    doc.restore();
};

const ROW_LABEL_LINE_HEIGHT = 11;
const ROW_GAP = 6;
const ROW_VALUE_LINE_GAP = 1;

const measureTextHeight = (doc, text, width, font, fontSize, lineGap = 0) => {
    doc.save();
    doc.font(font).fontSize(fontSize);
    const height = doc.heightOfString(String(text || ''), { width, lineGap });
    doc.restore();
    return height;
};

const measureRowsHeight = (doc, rows, labelWidth, valueWidth) => (
    rows.reduce((total, row, index) => {
        const labelLines = String(row.label || '').split('\n');
        const labelHeight = (labelLines.length * ROW_LABEL_LINE_HEIGHT) - 1;
        const valueFont = row.emphasis ? 'Helvetica-Bold' : 'Helvetica';
        const valueSize = row.emphasis ? 9.5 : 8.8;
        const valueHeight = measureTextHeight(doc, row.value || 'N/A', valueWidth, valueFont, valueSize, ROW_VALUE_LINE_GAP);
        const rowHeight = Math.max(labelHeight, valueHeight, row.minHeight || 14);
        return total + rowHeight + (index === rows.length - 1 ? 0 : ROW_GAP);
    }, 0)
);

const drawKeyValueRows = (doc, rows, x, startY, labelWidth, valueWidth) => {
    let y = startY;

    rows.forEach((row, index) => {
        const labelLines = String(row.label || '').split('\n');
        const valueText = row.value || 'N/A';
        const valueFont = row.emphasis ? 'Helvetica-Bold' : 'Helvetica';
        const valueSize = row.emphasis ? 9.5 : 8.8;
        const valueColor = row.color || (row.emphasis ? COLORS.ink : COLORS.ink);
        const labelHeight = (labelLines.length * ROW_LABEL_LINE_HEIGHT) - 1;
        const valueHeight = measureTextHeight(doc, valueText, valueWidth, valueFont, valueSize, ROW_VALUE_LINE_GAP);
        const rowHeight = Math.max(labelHeight, valueHeight, row.minHeight || 14);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.subtext);
        labelLines.forEach((line, labelIndex) => {
            drawText(doc, line, x, y + (labelIndex * ROW_LABEL_LINE_HEIGHT), { width: labelWidth });
        });

        doc.font(valueFont).fontSize(valueSize).fillColor(valueColor);
        drawText(doc, valueText, x + labelWidth, y, { width: valueWidth, lineGap: ROW_VALUE_LINE_GAP });

        y += rowHeight + (index === rows.length - 1 ? 0 : ROW_GAP);
    });

    return y;
};

const drawSectionCard = (doc, config) => {
    const {
        x,
        y,
        width,
        title,
        rows,
        fill = COLORS.panel,
        labelWidth = 100,
        padding = 12
    } = config;
    const valueWidth = width - (padding * 2) - labelWidth;
    const titleHeight = 14;
    const contentTop = y + padding + titleHeight + 8;
    const rowsHeight = measureRowsHeight(doc, rows, labelWidth, valueWidth);
    const height = (padding * 2) + titleHeight + 8 + rowsHeight;

    drawRect(doc, x, y, width, height, { fill, stroke: COLORS.border, radius: 12 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink);
    drawText(doc, title, x + padding, y + padding);
    drawKeyValueRows(doc, rows, x + padding, contentTop, labelWidth, valueWidth);

    return {
        x,
        y,
        width,
        height,
        bottom: y + height
    };
};

const startReceiptPage = (doc) => {
    doc.rect(0, 0, PAGE.width, PAGE.height).fill('#FFFFFF');
};

const drawReceiptHeader = (doc, { generatedAt, receiptId }) => {
    const metaX = PAGE.width - PAGE.marginX - HEADER_META_WIDTH;

    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.ink);
    drawText(doc, 'DM Panda', PAGE.marginX, PAGE.top, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink);
    drawText(doc, 'Billing Receipt', PAGE.marginX, PAGE.top + 17, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
    drawText(doc, `Generated ${formatShortUtcDate(generatedAt)}`, PAGE.marginX, PAGE.top + 43, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.subtext);
    drawText(doc, 'Receipt ID', metaX, PAGE.top + 2, { width: HEADER_META_WIDTH, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink);
    drawText(doc, receiptId || 'N/A', metaX, PAGE.top + 16, {
        width: HEADER_META_WIDTH,
        align: 'right',
        lineGap: 1
    });

    return PAGE.top + 64;
};

const drawReceiptFooter = (doc, { generatedAt, receiptId }) => {
    const footerY = PAGE.height - PAGE.bottom;
    const metaX = PAGE.width - PAGE.marginX - FOOTER_META_WIDTH;

    doc.strokeColor(COLORS.border)
        .lineWidth(1)
        .moveTo(PAGE.marginX, footerY)
        .lineTo(PAGE.width - PAGE.marginX, footerY)
        .stroke();

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink);
    drawText(doc, 'DM Panda receipt', PAGE.marginX, footerY + FOOTER_LINE_OFFSET);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.subtext);
    drawText(doc, `Generated ${formatShortUtcDate(generatedAt)}`, PAGE.marginX, footerY + FOOTER_LINE_OFFSET + 12);
    drawText(doc, receiptId || 'N/A', metaX, footerY + FOOTER_LINE_OFFSET, {
        width: FOOTER_META_WIDTH,
        align: 'right'
    });
};

const formatLinkedAccountsDisplay = (rawText) => {
    const clean = String(rawText || '').trim();
    if (!clean || clean.toLowerCase() === 'linked to account') {
        return 'Instagram Subscription';
    }
    // If it's a comma-separated list or single username
    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return 'Instagram Subscription';
    return parts.map(p => p.startsWith('@') ? p : `@${p}`).join(', ');
};

const buildTransactionReceipt = ({ transaction, user }) => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true
    });

    const generatedAt = new Date();
    const approvedPlanTotal = Number(
        transaction.approved_plan_total
        ?? (Number(transaction.base_amount || 0) - Number(transaction.discount_amount || 0))
        ?? 0
    );
    const gatewaySurcharge = Number(transaction.gateway_surcharge || 0);
    const gatewayTax = computeGatewayTax(gatewaySurcharge, transaction.currency);
    const totalDeducted = Number(transaction.final_amount || 0);
    const coverageUntil = buildCoverageUntil(transaction.created_at, transaction.validity_days);
    const notes = buildNotesText(transaction, gatewaySurcharge);
    const couponBenefit = Number(transaction.discount_amount || 0) > 0
        ? formatMoney(transaction.discount_amount, transaction.currency)
        : 'None';
    const customerSurcharge = gatewaySurcharge > 0
        ? formatMoney(gatewaySurcharge, transaction.currency)
        : 'None';

    doc.info.Title = `DM Panda Receipt ${transaction.id || ''}`;
    doc.info.Author = 'DM Panda';

    startReceiptPage(doc);
    const bannerY = drawReceiptHeader(doc, { generatedAt, receiptId: transaction.id });
    
    // Total Deducted Banner
    drawRect(doc, CARD.full.x, bannerY, CARD.full.width, 62, { fill: COLORS.banner, stroke: COLORS.border, radius: 12 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.subtext);
    drawText(doc, 'Total deducted', CARD.full.x + 14, bannerY + 12);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink);
    drawText(doc, formatMoney(totalDeducted, transaction.currency), CARD.full.x + 14, bannerY + 26);
    doc.font('Helvetica').fontSize(8.2).fillColor(COLORS.muted);
    drawText(
        doc,
        'This is the amount charged by Razorpay to the customer payment method.',
        CARD.full.x + 14,
        bannerY + 46,
        { width: CARD.full.width - 28 }
    );

    const linkedIgAccountText = formatLinkedAccountsDisplay(
        transaction.linked_ig_accounts || transaction.ig_account_name || user?.ig_username
    );
    const isMultipleAccounts = linkedIgAccountText.includes(',');
    const accountLabel = isMultipleAccounts ? 'Instagram Accounts' : 'Instagram Account';

    const transactionRows = [
        { label: 'Transaction ID', value: transaction.id },
        { label: 'Transaction date', value: formatShortUtcDate(transaction.created_at) },
        { label: 'Plan', value: transaction.plan_name || 'Plan', emphasis: true },
        { label: accountLabel, value: linkedIgAccountText, emphasis: true },
        { label: 'Billing cycle', value: String(transaction.billing_cycle || 'monthly').replace(/^./, (v) => v.toUpperCase()) },
        { label: 'Coverage until', value: coverageUntil },
        { label: 'Status', value: normalizeStatus(transaction.status), color: COLORS.success, emphasis: true }
    ];

    const customerRows = [
        { label: 'Customer', value: user?.name || user?.email || 'DM Panda user' },
        { label: 'Email', value: user?.email || 'N/A' },
        { label: 'Payment provider', value: transaction.payment_provider || 'RAZORPAY' },
        { label: 'Gateway payment ID', value: transaction.razorpay_payment_id || 'N/A' },
        { label: 'Gateway order ID', value: transaction.razorpay_order_id || 'N/A' },
        { label: 'Support email', value: 'support@dmpanda.com' }
    ];

    const detailsY = bannerY + 74;
    const leftDetails = drawSectionCard(doc, {
        x: CARD.left.x,
        y: detailsY,
        width: CARD.left.width,
        title: 'Transaction Details',
        rows: transactionRows,
        labelWidth: 98
    });
    const rightDetails = drawSectionCard(doc, {
        x: CARD.right.x,
        y: detailsY,
        width: CARD.right.width,
        title: 'Customer Details',
        rows: customerRows,
        labelWidth: 98
    });

    const summaryRows = [
        { label: 'Plan amount', value: formatMoney(transaction.base_amount, transaction.currency) },
        { label: 'Discount', value: transaction.discount_amount > 0 ? formatMoney(transaction.discount_amount, transaction.currency) : 'None' },
        { label: 'Coupon code', value: transaction.coupon_code || 'Not applied' },
        { label: 'Coupon benefit', value: couponBenefit },
        { label: 'Approved total', value: formatMoney(approvedPlanTotal, transaction.currency), emphasis: true },
        { label: 'Gateway surcharge', value: customerSurcharge },
        { label: 'Total deducted', value: formatMoney(totalDeducted, transaction.currency), emphasis: true }
    ];

    const chargeRows = [
        { label: 'Charged amount', value: formatMoney(totalDeducted, transaction.currency), emphasis: true },
        { label: 'Gateway fee', value: gatewaySurcharge > 0 ? formatMoney(gatewaySurcharge, transaction.currency) : 'None' },
        { label: 'Gateway tax', value: gatewayTax > 0 ? formatMoney(gatewayTax, transaction.currency) : 'None' },
        { label: 'Customer surcharge', value: customerSurcharge },
        { label: 'Approved plan total', value: formatMoney(approvedPlanTotal, transaction.currency) }
    ];

    const financialY = Math.max(leftDetails.bottom, rightDetails.bottom) + 12;
    const leftSummary = drawSectionCard(doc, {
        x: CARD.left.x,
        y: financialY,
        width: CARD.left.width,
        title: 'Bill Summary',
        rows: summaryRows,
        fill: COLORS.panelMuted,
        labelWidth: 98
    });
    const rightCharges = drawSectionCard(doc, {
        x: CARD.right.x,
        y: financialY,
        width: CARD.right.width,
        title: 'Razorpay Charges',
        rows: chargeRows,
        labelWidth: 98
    });

    const notesY = Math.max(leftSummary.bottom, rightCharges.bottom) + 12;
    const footerY = PAGE.height - PAGE.bottom;
    const notesTextHeight = measureTextHeight(doc, notes, CARD.full.width - 28, 'Helvetica', 8.5, 2);
    const notesHeight = Math.max(54, 12 + 14 + 6 + notesTextHeight + 12);
    const notesFitsOnFirstPage = notesY + notesHeight <= footerY - 14;

    if (notesFitsOnFirstPage) {
        drawRect(doc, CARD.full.x, notesY, CARD.full.width, notesHeight, { fill: COLORS.panel, stroke: COLORS.border, radius: 12 });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink);
        drawText(doc, 'Notes', CARD.full.x + 14, notesY + 12);
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.subtext);
        drawText(doc, notes, CARD.full.x + 14, notesY + 32, { width: CARD.full.width - 28, lineGap: 2 });
        drawReceiptFooter(doc, { generatedAt, receiptId: transaction.id });
        return doc;
    }

    drawReceiptFooter(doc, { generatedAt, receiptId: transaction.id });

    doc.addPage({ size: 'A4', margin: 0 });
    startReceiptPage(doc);
    const nextBannerY = drawReceiptHeader(doc, { generatedAt, receiptId: transaction.id });
    const nextNotesY = nextBannerY;
    const nextPageFooterY = PAGE.height - PAGE.bottom;
    const nextNotesHeight = Math.min(
        notesHeight,
        Math.max(64, nextPageFooterY - nextNotesY - 14)
    );

    drawRect(doc, CARD.full.x, nextNotesY, CARD.full.width, nextNotesHeight, { fill: COLORS.panel, stroke: COLORS.border, radius: 12 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink);
    drawText(doc, 'Notes', CARD.full.x + 14, nextNotesY + 12);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.subtext);
    drawText(doc, notes, CARD.full.x + 14, nextNotesY + 32, {
        width: CARD.full.width - 28,
        height: nextNotesHeight - 44,
        lineGap: 2
    });
    drawReceiptFooter(doc, { generatedAt, receiptId: transaction.id });

    return doc;
};

module.exports = {
    buildTransactionReceipt
};
