const PDFDocument = require('pdfkit');

const PAGE = {
    width: 595.28,
    height: 841.89,
    marginX: 34,
    top: 34,
    bottom: 44,
    gutter: 14,
    contentWidth: 527
};

const CARD = {
    full: { x: PAGE.marginX, width: PAGE.contentWidth },
    left: { x: PAGE.marginX, width: (PAGE.contentWidth - PAGE.gutter) / 2 },
    right: { x: PAGE.marginX + ((PAGE.contentWidth - PAGE.gutter) / 2) + PAGE.gutter, width: (PAGE.contentWidth - PAGE.gutter) / 2 }
};

const COLORS = {
    ink: '#172333',
    subtext: '#475467',
    muted: '#64748B',
    border: '#DCE1EB',
    panel: '#FFFFFF',
    panelMuted: '#F8FAFC',
    banner: '#FCFCFF'
};

const HEADER_META_WIDTH = 172;
const HEADER_TITLE_WIDTH = PAGE.contentWidth - HEADER_META_WIDTH - 18;
const FOOTER_META_WIDTH = 170;
const FOOTER_LINE_OFFSET = 10;

const formatMoney = (value, currency) => {
    const code = String(currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD';
    const amount = Number(value || 0);
    return `${code} ${amount.toLocaleString(code === 'INR' ? 'en-IN' : 'en-US', {
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
    const normalizedCurrency = String(currency || 'USD').toUpperCase();
    if (gatewaySurcharge <= 0 || normalizedCurrency !== 'INR') return 0;
    return roundCurrency((gatewaySurcharge * 18) / 118);
};

const formatSentenceMoney = (value, currency) => {
    const code = String(currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD';
    const amount = Number(value || 0).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${amount} ${code}`;
};

const buildNotesText = (transaction, gatewaySurcharge) => {
    const customNotes = String(transaction.notes || '').trim();
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
        lineWidth = 1
    } = options;

    doc.save();
    doc.lineWidth(lineWidth).strokeColor(stroke).fillColor(fill);
    doc.roundedRect(x, y, width, height, 18).fillAndStroke(fill, stroke);
    doc.restore();
};

const ROW_LABEL_LINE_HEIGHT = 11;
const ROW_GAP = 8;
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
        const valueSize = row.emphasis ? 10.1 : 9.4;
        const valueHeight = measureTextHeight(doc, row.value || 'N/A', valueWidth, valueFont, valueSize, ROW_VALUE_LINE_GAP);
        const rowHeight = Math.max(labelHeight, valueHeight, row.minHeight || 16);
        return total + rowHeight + (index === rows.length - 1 ? 0 : ROW_GAP);
    }, 0)
);

const drawKeyValueRows = (doc, rows, x, startY, labelWidth, valueWidth) => {
    let y = startY;

    rows.forEach((row, index) => {
        const labelLines = String(row.label || '').split('\n');
        const valueText = row.value || 'N/A';
        const valueFont = row.emphasis ? 'Helvetica-Bold' : 'Helvetica';
        const valueSize = row.emphasis ? 10.1 : 9.4;
        const labelHeight = (labelLines.length * ROW_LABEL_LINE_HEIGHT) - 1;
        const valueHeight = measureTextHeight(doc, valueText, valueWidth, valueFont, valueSize, ROW_VALUE_LINE_GAP);
        const rowHeight = Math.max(labelHeight, valueHeight, row.minHeight || 16);

        doc.font('Helvetica-Bold').fontSize(8.9).fillColor(COLORS.subtext);
        labelLines.forEach((line, labelIndex) => {
            drawText(doc, line, x, y + (labelIndex * ROW_LABEL_LINE_HEIGHT), { width: labelWidth });
        });

        doc.font(valueFont).fontSize(valueSize).fillColor(COLORS.ink);
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
        labelWidth = 96,
        padding = 14
    } = config;
    const valueWidth = width - (padding * 2) - labelWidth;
    const titleHeight = 16;
    const contentTop = y + padding + titleHeight + 10;
    const rowsHeight = measureRowsHeight(doc, rows, labelWidth, valueWidth);
    const height = (padding * 2) + titleHeight + 10 + rowsHeight;

    drawRect(doc, x, y, width, height, { fill, stroke: COLORS.border });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink);
    drawText(doc, title, x + padding, y + padding + 1);
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

    doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.ink);
    drawText(doc, 'DM Panda', PAGE.marginX, PAGE.top, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.ink);
    drawText(doc, 'Billing Receipt', PAGE.marginX, PAGE.top + 18, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica').fontSize(8.8).fillColor(COLORS.muted);
    drawText(doc, `Generated ${formatShortUtcDate(generatedAt)}`, PAGE.marginX, PAGE.top + 47, { width: HEADER_TITLE_WIDTH });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.subtext);
    drawText(doc, 'Receipt ID', metaX, PAGE.top + 2, { width: HEADER_META_WIDTH, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink);
    drawText(doc, receiptId || 'N/A', metaX, PAGE.top + 18, {
        width: HEADER_META_WIDTH,
        align: 'right',
        lineGap: 1
    });

    return PAGE.top + 72;
};

const drawReceiptFooter = (doc, { generatedAt, receiptId }) => {
    const footerY = PAGE.height - PAGE.bottom;
    const metaX = PAGE.width - PAGE.marginX - FOOTER_META_WIDTH;

    doc.strokeColor(COLORS.ink)
        .lineWidth(1)
        .moveTo(PAGE.marginX, footerY)
        .lineTo(PAGE.width - PAGE.marginX, footerY)
        .stroke();

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.ink);
    drawText(doc, 'DM Panda receipt', PAGE.marginX, footerY + FOOTER_LINE_OFFSET);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.subtext);
    drawText(doc, `Generated ${formatShortUtcDate(generatedAt)}`, PAGE.marginX, footerY + FOOTER_LINE_OFFSET + 14);
    drawText(doc, receiptId || 'N/A', metaX, footerY + FOOTER_LINE_OFFSET, {
        width: FOOTER_META_WIDTH,
        align: 'right'
    });

    return footerY;
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
    drawRect(doc, CARD.full.x, bannerY, CARD.full.width, 74, { fill: COLORS.banner, stroke: COLORS.border });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink);
    drawText(doc, 'Total deducted', CARD.full.x + 16, bannerY + 18);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.ink);
    drawText(doc, formatMoney(totalDeducted, transaction.currency), CARD.full.x + 16, bannerY + 34);
    doc.font('Helvetica').fontSize(8.9).fillColor(COLORS.subtext);
    drawText(
        doc,
        'This is the amount charged by Razorpay to the customer payment method.',
        CARD.full.x + 16,
        bannerY + 55,
        { width: CARD.full.width - 32 }
    );

    const transactionRows = [
        { label: 'Transaction ID', value: transaction.id },
        { label: 'Transaction date', value: formatShortUtcDate(transaction.created_at) },
        { label: 'Plan', value: transaction.plan_name || 'Plan' },
        { label: 'Billing cycle', value: String(transaction.billing_cycle || 'monthly').replace(/^./, (v) => v.toUpperCase()) },
        { label: 'Coverage until', value: coverageUntil },
        { label: 'Status', value: normalizeStatus(transaction.status) }
    ];

    const customerRows = [
        { label: 'Customer', value: user?.name || user?.email || 'DM Panda user' },
        { label: 'Email', value: user?.email || 'N/A' },
        { label: 'Provider', value: transaction.payment_provider || 'RAZORPAY' },
        { label: 'Gateway payment ID', value: transaction.razorpay_payment_id || 'N/A' },
        { label: 'Gateway order ID', value: transaction.razorpay_order_id || 'N/A' },
        { label: 'Support', value: 'support@dmpanda.com' }
    ];

    const detailsY = bannerY + 92;
    const leftDetails = drawSectionCard(doc, {
        x: CARD.left.x,
        y: detailsY,
        width: CARD.left.width,
        title: 'Transaction Details',
        rows: transactionRows
    });
    const rightDetails = drawSectionCard(doc, {
        x: CARD.right.x,
        y: detailsY,
        width: CARD.right.width,
        title: 'Customer Details',
        rows: customerRows,
        labelWidth: 80
    });

    const summaryRows = [
        { label: 'Plan amount', value: formatMoney(transaction.base_amount, transaction.currency) },
        { label: 'Discount', value: transaction.discount_amount > 0 ? formatMoney(transaction.discount_amount, transaction.currency) : 'None' },
        { label: 'Coupon\ncode', value: transaction.coupon_code || 'Not applied' },
        { label: 'Coupon\nbenefit', value: couponBenefit },
        { label: 'Approved\nsubscription\ntotal', value: formatMoney(approvedPlanTotal, transaction.currency), emphasis: true, minHeight: 22 },
        { label: 'Customer\nsurcharge', value: customerSurcharge, minHeight: 20 },
        { label: 'Total\ndeducted', value: formatMoney(totalDeducted, transaction.currency), emphasis: true, minHeight: 20 }
    ];

    const chargeRows = [
        { label: 'Charged\namount', value: formatMoney(totalDeducted, transaction.currency), emphasis: true, minHeight: 20 },
        { label: 'Gateway fee', value: gatewaySurcharge > 0 ? formatMoney(gatewaySurcharge, transaction.currency) : 'None' },
        { label: 'Gateway tax', value: gatewayTax > 0 ? formatMoney(gatewayTax, transaction.currency) : 'None' },
        { label: 'Customer\nsurcharge', value: customerSurcharge, minHeight: 20 },
        { label: 'Approved\nplan total', value: formatMoney(approvedPlanTotal, transaction.currency), minHeight: 20 }
    ];

    const financialY = Math.max(leftDetails.bottom, rightDetails.bottom) + 16;
    const leftSummary = drawSectionCard(doc, {
        x: CARD.left.x,
        y: financialY,
        width: CARD.left.width,
        title: 'Bill Summary',
        rows: summaryRows,
        fill: COLORS.panelMuted,
        labelWidth: 78
    });
    const rightCharges = drawSectionCard(doc, {
        x: CARD.right.x,
        y: financialY,
        width: CARD.right.width,
        title: 'Razorpay Charges',
        rows: chargeRows,
        labelWidth: 72
    });

    const notesY = Math.max(leftSummary.bottom, rightCharges.bottom) + 16;
    const footerY = PAGE.height - PAGE.bottom;
    const notesHeight = Math.max(
        104,
        16 + 18 + 14 + measureTextHeight(doc, notes, CARD.full.width - 32, 'Helvetica', 9, 3) + 16
    );
    const notesFitsOnFirstPage = notesY + notesHeight <= footerY - 18;

    if (notesFitsOnFirstPage) {
        drawRect(doc, CARD.full.x, notesY, CARD.full.width, notesHeight, { fill: COLORS.panel, stroke: COLORS.border });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink);
        drawText(doc, 'Notes', CARD.full.x + 16, notesY + 18);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.subtext);
        drawText(doc, notes, CARD.full.x + 16, notesY + 50, { width: CARD.full.width - 32, lineGap: 3 });
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
        Math.max(104, nextPageFooterY - nextNotesY - 18)
    );

    drawRect(doc, CARD.full.x, nextNotesY, CARD.full.width, nextNotesHeight, { fill: COLORS.panel, stroke: COLORS.border });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink);
    drawText(doc, 'Notes', CARD.full.x + 16, nextNotesY + 18);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.subtext);
    drawText(doc, notes, CARD.full.x + 16, nextNotesY + 50, {
        width: CARD.full.width - 32,
        height: nextNotesHeight - 64,
        lineGap: 3
    });
    drawReceiptFooter(doc, { generatedAt, receiptId: transaction.id });

    return doc;
};

module.exports = {
    buildTransactionReceipt
};
