const DISPOSABLE_DOMAINS = new Set([
    "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net",
    "throwawaymail.com", "mailinator.com", "guerrillamail.com", "guerrillamail.org",
    "yopmail.com", "yopmail.fr", "yopmail.net",
    "10minutemail.com", "10minutemail.net", "10minmail.com",
    "sharklasers.com", "getnada.com", "getnada.cc",
    "dispostable.com", "grr.la", "guerillamail.com",
    "mailnesia.com", "maildrop.cc", "mailsac.com",
    "mohmal.com", "fakeinbox.com", "tempinbox.com",
    "trashmail.com", "trashmail.net", "trashmail.org",
    // ... add more if needed
]);

const isValidEmail = (email) => {
    return /^[\w\.\-\+]+@[\w\.-]+\.\w+$/.test(email);
};

const normalizeEmail = (email) => {
    email = email.toLowerCase().trim();
    if (!email.includes('@')) return email;

    let [local, domain] = email.split('@');
    if (['gmail.com', 'googlemail.com'].includes(domain)) {
        local = local.split('+')[0].replace(/\./g, '');
    }
    return `${local}@${domain}`;
};

const isDisposableEmail = (email) => {
    const domain = email.split('@')[1].toLowerCase();
    return DISPOSABLE_DOMAINS.has(domain);
};

module.exports = {
    isValidEmail,
    normalizeEmail,
    isDisposableEmail
};
