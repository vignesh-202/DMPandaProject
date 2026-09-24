const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'Frontend', 'public', 'images');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Common SVG Primitives &amp; Design Tokens
// -------------------------------------------------------------
const COLORS = {
  bgDark: '#09090b',
  cardBgStart: '#18181b',
  cardBgEnd: '#09090b',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  accentPurple: '#8b5cf6',
  accentIndigo: '#6366f1',
  accentPink: '#ec4899',
  accentBlue: '#3b82f6',
  accentEmerald: '#10b981',
  bubbleUser: '#374151',
  bubbleBot: '#222226'
};

function renderChassisHeader(title = 'DM Panda Verified', subtitle = 'Active now • Instagram Automation') {
  return `
    <!-- Header Bar -->
    <rect x="368" y="92" width="800" height="96" rx="36" fill="rgba(255,255,255,0.02)" />
    <path d="M368 188 H1168" stroke="rgba(255,255,255,0.06)" stroke-width="1" />

    <!-- Avatar &amp; Brand Icon -->
    <circle cx="430" cy="140" r="26" fill="url(#accentGlow)" />
    <circle cx="423" cy="135" r="4.5" fill="#ffffff" />
    <circle cx="437" cy="135" r="4.5" fill="#ffffff" />
    <path d="M424 146 Q430 151 436 146" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" />
    
    <text x="472" y="136" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${title}</text>
    <!-- Verified Badge -->
    <circle cx="700" cy="130" r="9" fill="#3b82f6" />
    <path d="M696 130 L699 133 L704 127" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    
    <text x="472" y="157" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#a1a1aa">${subtitle}</text>

    <!-- Header Actions (Icons) -->
    <circle cx="1068" cy="140" r="16" fill="rgba(255,255,255,0.04)" />
    <circle cx="1116" cy="140" r="16" fill="rgba(255,255,255,0.04)" />
    <circle cx="1068" cy="140" r="3" fill="#ffffff" />
    <circle cx="1116" cy="140" r="3" fill="#ffffff" />

    <!-- Date Pill -->
    <rect x="716" y="212" width="104" height="28" rx="14" fill="rgba(255,255,255,0.05)" />
    <text x="768" y="231" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#71717a" text-anchor="middle">TODAY</text>
  `;
}

function wrapFeatureSvg(content) {
  return `
<svg width="1536" height="1024" viewBox="0 0 1536 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="200" y="40" width="1136" height="944" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#4f46e5" flood-opacity="0.15" />
    </filter>
    <linearGradient id="cardBg" x1="280" y1="90" x2="1256" y2="880" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="accentGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ec4899" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <linearGradient id="btnGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="bubbleBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#27272a" />
      <stop offset="100%" stop-color="#202024" />
    </linearGradient>
    <linearGradient id="instagramGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#833AB4" />
      <stop offset="50%" stop-color="#FD1D1D" />
      <stop offset="100%" stop-color="#FCAF45" />
    </linearGradient>
    <linearGradient id="successGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>

  <!-- Ambient Glow Behind Device -->
  <circle cx="768" cy="500" r="320" fill="url(#btnGradient)" opacity="0.12" filter="blur(60px)" />

  <!-- Main Floating Chat Card Container -->
  <g filter="url(#shadow)">
    <!-- Device / Window Chassis -->
    <rect x="368" y="92" width="800" height="840" rx="36" fill="url(#cardBg)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" />
    ${content}
  </g>
</svg>
  `.trim();
}

// -------------------------------------------------------------
// 23 Feature SVG Generators
// -------------------------------------------------------------

// 1. Inbox Menu
function svgInboxMenu() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('DM Panda Support', 'Persistent Menu Experience')}
    <!-- User prompt -->
    <g transform="translate(688, 260)">
      <rect x="180" y="0" width="250" height="52" rx="24" fill="#374151" />
      <text x="305" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="500" fill="#ffffff" text-anchor="middle">Show main menu 📋</text>
    </g>

    <!-- Bot menu container -->
    <g transform="translate(420, 334)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="470" height="420" rx="24" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="20" y="20" width="104" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="72" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">INBOX MENU</text>

        <text x="20" y="74" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Welcome! How can we help?</text>
        <text x="20" y="98" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">Select any item below for instant 24/7 answers:</text>

        <!-- Menu items -->
        <g transform="translate(20, 118)">
          <rect x="0" y="0" width="430" height="52" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff">📦 Track My Order</text>
          <path d="M395 26 L403 32 L395 38" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>
        <g transform="translate(20, 180)">
          <rect x="0" y="0" width="430" height="52" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff">🏷️ Browse Today's Discounts (30% Off)</text>
          <path d="M395 26 L403 32 L395 38" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>
        <g transform="translate(20, 242)">
          <rect x="0" y="0" width="430" height="52" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff">💬 Connect with Human Agent</text>
          <path d="M395 26 L403 32 L395 38" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>
        <g transform="translate(20, 304)">
          <rect x="0" y="0" width="430" height="52" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff">❓ Frequently Asked Questions</text>
          <path d="M395 26 L403 32 L395 38" stroke="#a1a1aa" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>
        <g transform="translate(20, 364)">
          <text x="215" y="24" font-family="-apple-system, sans-serif" font-size="12" font-weight="500" fill="#71717a" text-anchor="middle">Powered by DM Panda Instant Engine</text>
        </g>
      </g>
    </g>
  `);
}

// 2. Super Profile
function svgSuperProfile() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Super Profile', 'High-Converting Link-in-Bio')}
    
    <!-- Phone / Preview Card in center -->
    <g transform="translate(568, 220)">
      <rect x="0" y="0" width="400" height="660" rx="32" fill="#121214" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
      
      <!-- Top banner &amp; avatar -->
      <rect x="0" y="0" width="400" height="110" rx="32" fill="url(#btnGradient)" opacity="0.3" />
      <circle cx="200" cy="110" r="44" fill="#18181b" stroke="rgba(255,255,255,0.2)" stroke-width="3" />
      <circle cx="200" cy="110" r="38" fill="url(#accentGlow)" />
      
      <!-- Name &amp; Bio -->
      <text x="200" y="176" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">@dmpanda.official</text>
      <text x="200" y="198" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa" text-anchor="middle">The #1 Instagram DM &amp; Comment Automation</text>
      
      <!-- Links -->
      <g transform="translate(24, 226)">
        <rect x="0" y="0" width="352" height="54" rx="16" fill="url(#btnGradient)" />
        <text x="176" y="33" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">⚡ Start Free 14-Day Trial</text>
      </g>
      <g transform="translate(24, 292)">
        <rect x="0" y="0" width="352" height="54" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x="176" y="33" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">🛍️ Shop Viral Summer Collection</text>
      </g>
      <g transform="translate(24, 358)">
        <rect x="0" y="0" width="352" height="54" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x="176" y="33" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">🎙️ Watch Live Demo &amp; Webinar</text>
      </g>
      <g transform="translate(24, 424)">
        <rect x="0" y="0" width="352" height="54" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x="176" y="33" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">📞 Book a 1-on-1 Growth Call</text>
      </g>

      <!-- Analytics pill -->
      <g transform="translate(48, 510)">
        <rect x="0" y="0" width="304" height="60" rx="18" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.2)" />
        <text x="152" y="26" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#818cf8" text-anchor="middle">REAL-TIME TRAFFIC</text>
        <text x="152" y="47" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">🔥 12,480 Clicks Today</text>
      </g>
    </g>
  `);
}

// 3. Conversation Starters
function svgConversationStarter() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('DM Panda Concierge', 'Interactive Conversation Starters')}
    
    <g transform="translate(488, 260)">
      <circle cx="280" cy="50" r="44" fill="url(#accentGlow)" />
      <text x="280" y="120" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle">Ask DM Panda</text>
      <text x="280" y="146" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa" text-anchor="middle">Choose an inquiry to get instant automated answers:</text>
      
      <!-- Starter Buttons -->
      <g transform="translate(30, 180)">
        <rect x="0" y="0" width="500" height="58" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        <text x="24" y="35" font-family="-apple-system, sans-serif" font-size="16" font-weight="600" fill="#ffffff">💰 How much does the Pro Plan cost?</text>
        <path d="M465 29 L473 35 L465 41" stroke="#818cf8" stroke-width="2" fill="none" />
      </g>
      <g transform="translate(30, 252)">
        <rect x="0" y="0" width="500" height="58" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        <text x="24" y="35" font-family="-apple-system, sans-serif" font-size="16" font-weight="600" fill="#ffffff">🚀 Does this work for Instagram Reels &amp; Stories?</text>
        <path d="M465 29 L473 35 L465 41" stroke="#818cf8" stroke-width="2" fill="none" />
      </g>
      <g transform="translate(30, 324)">
        <rect x="0" y="0" width="500" height="58" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        <text x="24" y="35" font-family="-apple-system, sans-serif" font-size="16" font-weight="600" fill="#ffffff">🛡️ Is it 100% compliant with Meta Terms?</text>
        <path d="M465 29 L473 35 L465 41" stroke="#818cf8" stroke-width="2" fill="none" />
      </g>
      <g transform="translate(30, 396)">
        <rect x="0" y="0" width="500" height="58" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        <text x="24" y="35" font-family="-apple-system, sans-serif" font-size="16" font-weight="600" fill="#ffffff">🎁 Send me the Free Automation Cheatsheet</text>
        <path d="M465 29 L473 35 L465 41" stroke="#818cf8" stroke-width="2" fill="none" />
      </g>

      <g transform="translate(140, 485)">
        <rect x="0" y="0" width="280" height="34" rx="17" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)" />
        <text x="140" y="22" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#34d399" text-anchor="middle">✓ 0.4s Instant Automated Response</text>
      </g>
    </g>
  `);
}

// 4. Follow-Gated DMs
function svgFollowGated() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Follow Gate Engine', 'Convert Commenters into Loyal Followers')}
    
    <g transform="translate(420, 260)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="420" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        
        <rect x="24" y="20" width="130" height="26" rx="13" fill="rgba(236,72,153,0.18)" stroke="rgba(236,72,153,0.3)" />
        <text x="89" y="37" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#f472b6" text-anchor="middle">🔒 LOCKED CONTENT</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#ffffff">One quick step before your download!</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">You must be a follower of our page to receive the</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">exclusive 50% Black Friday VIP Promo Code.</text>

        <!-- Lock Illustration / Status -->
        <g transform="translate(24, 160)">
          <rect x="0" y="0" width="432" height="84" rx="18" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.06)" />
          <circle cx="44" cy="42" r="22" fill="rgba(236,72,153,0.15)" />
          <text x="44" y="49" font-family="-apple-system, sans-serif" font-size="20" text-anchor="middle">🔒</text>
          <text x="82" y="36" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Follow Verification Active</text>
          <text x="82" y="58" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">DM Panda checks Instagram API in real time</text>
        </g>

        <!-- Action CTA -->
        <g transform="translate(24, 268)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Follow @dmpanda &amp; Unlock VIP Code</text>
        </g>
        <g transform="translate(24, 332)">
          <rect x="0" y="0" width="432" height="48" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="30" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#d4d4d8" text-anchor="middle">I'm Already Following (Verify Now)</text>
        </g>
      </g>
    </g>
  `);
}

// 5. Global Keyword Triggers
function svgGlobalTriggers() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Global Trigger Engine', 'Account-Wide Keyword Recognition')}
    
    <g transform="translate(420, 240)">
      <!-- Trigger Source Banner -->
      <rect x="0" y="0" width="696" height="76" rx="20" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.25)" />
      <text x="24" y="34" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#818cf8">GLOBAL KEYWORD ACTIVE: "DEAL"</text>
      <text x="24" y="58" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Triggers from any Post, Reel, Story, or incoming DM message</text>
      <rect x="560" y="20" width="112" height="34" rx="17" fill="url(#btnGradient)" />
      <text x="616" y="42" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">ACTIVE NOW</text>

      <!-- Trigger incoming -->
      <g transform="translate(268, 100)">
        <rect x="180" y="0" width="250" height="52" rx="24" fill="#374151" />
        <text x="305" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="600" fill="#ffffff" text-anchor="middle">DEAL 🔥</text>
      </g>

      <!-- Instant Response -->
      <g transform="translate(0, 174)">
        <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
        <g transform="translate(48, 0)">
          <rect x="0" y="0" width="480" height="300" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
          <text x="24" y="44" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">You triggered the Secret VIP Deal! 🎉</text>
          <text x="24" y="74" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Because you commented "DEAL", here is your private link</text>
          <text x="24" y="98" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">for 40% off sitewide. Valid for the next 24 hours.</text>

          <g transform="translate(24, 134)">
            <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
            <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Claim 40% Discount Code</text>
          </g>
          <g transform="translate(24, 200)">
            <rect x="0" y="0" width="432" height="48" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
            <text x="216" y="30" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#d4d4d8" text-anchor="middle">View Terms &amp; Conditions</text>
          </g>
        </g>
      </g>
    </g>
  `);
}

// 6. Text Template
function svgTextTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Text Template Engine', 'Lightning-Fast Direct Messages')}
    
    <g transform="translate(688, 270)">
      <rect x="180" y="0" width="250" height="52" rx="24" fill="#374151" />
      <text x="305" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="500" fill="#ffffff" text-anchor="middle">What time do you open? ⏰</text>
    </g>

    <g transform="translate(420, 350)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="220" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="110" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="79" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">TEXT TEMPLATE</text>

        <text x="24" y="78" font-family="-apple-system, sans-serif" font-size="18" font-weight="600" fill="#ffffff">Hey Alex! We are open Monday to Friday,</text>
        <text x="24" y="104" font-family="-apple-system, sans-serif" font-size="18" font-weight="600" fill="#ffffff">9:00 AM to 7:00 PM EST. 🕒</text>
        <text x="24" y="142" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#a1a1aa">Our customer care team is also available 24/7 right</text>
        <text x="24" y="166" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#a1a1aa">here in your Instagram DMs.</text>
      </g>
    </g>
  `);
}

// 7. Carousel Template
function svgCarouselTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Carousel Template', 'Multi-Card Product Showcase')}
    
    <g transform="translate(400, 240)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      
      <!-- Horizontal Carousel Cards -->
      <g transform="translate(48, 0)">
        <!-- Card 1 -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="280" height="460" rx="24" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
          <rect x="0" y="0" width="280" height="180" rx="24" fill="url(#btnGradient)" opacity="0.6" />
          <circle cx="140" cy="90" r="40" fill="rgba(255,255,255,0.2)" />
          <text x="140" y="98" font-family="-apple-system, sans-serif" font-size="28" text-anchor="middle">👟</text>
          
          <text x="20" y="215" font-family="-apple-system, sans-serif" font-size="17" font-weight="700" fill="#ffffff">Air Max Pulse Edition</text>
          <text x="20" y="238" font-family="-apple-system, sans-serif" font-size="14" font-weight="500" fill="#34d399">$129.00 USD (In Stock)</text>
          <text x="20" y="270" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Ultra-light cushioning built</text>
          <text x="20" y="290" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">for all-day street comfort.</text>

          <g transform="translate(20, 330)">
            <rect x="0" y="0" width="240" height="46" rx="14" fill="url(#btnGradient)" />
            <text x="120" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">Buy Now ($129)</text>
          </g>
          <g transform="translate(20, 388)">
            <rect x="0" y="0" width="240" height="42" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
            <text x="120" y="26" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8" text-anchor="middle">Select Colorways</text>
          </g>
        </g>

        <!-- Card 2 (Peek) -->
        <g transform="translate(300, 0)">
          <rect x="0" y="0" width="280" height="460" rx="24" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
          <rect x="0" y="0" width="280" height="180" rx="24" fill="url(#instagramGrad)" opacity="0.6" />
          <circle cx="140" cy="90" r="40" fill="rgba(255,255,255,0.2)" />
          <text x="140" y="98" font-family="-apple-system, sans-serif" font-size="28" text-anchor="middle">🎧</text>
          
          <text x="20" y="215" font-family="-apple-system, sans-serif" font-size="17" font-weight="700" fill="#ffffff">Aero Pro Wireless</text>
          <text x="20" y="238" font-family="-apple-system, sans-serif" font-size="14" font-weight="500" fill="#34d399">$199.00 USD</text>
          <text x="20" y="270" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Active noise cancellation</text>
          <text x="20" y="290" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">with 40h battery life.</text>

          <g transform="translate(20, 330)">
            <rect x="0" y="0" width="240" height="46" rx="14" fill="url(#btnGradient)" />
            <text x="120" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">Buy Now ($199)</text>
          </g>
          <g transform="translate(20, 388)">
            <rect x="0" y="0" width="240" height="42" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
            <text x="120" y="26" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8" text-anchor="middle">View Specs</text>
          </g>
        </g>
      </g>
    </g>
  `);
}

// 8. Button Template
function svgButtonTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Button Template', 'High-Converting Action Buttons')}
    
    <g transform="translate(420, 270)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="400" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="124" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="86" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">BUTTON TEMPLATE</text>

        <text x="24" y="78" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Your Exclusive 2025 Toolkit 🚀</text>
        <text x="24" y="108" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">We put together our top 3 resources to scale your</text>
        <text x="24" y="132" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Instagram account 10x faster this quarter.</text>

        <!-- 3 Buttons -->
        <g transform="translate(24, 164)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">📥 Download Automation Guide (PDF)</text>
        </g>
        <g transform="translate(24, 228)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">📺 Watch 15-Minute Video Tutorial</text>
        </g>
        <g transform="translate(24, 292)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">💬 Speak with Growth Specialist</text>
        </g>
      </g>
    </g>
  `);
}

// 9. Media Template
function svgMediaTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Media Template', 'Rich Image &amp; Video Attachments')}
    
    <g transform="translate(420, 240)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="490" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        
        <!-- Media Image Mock -->
        <rect x="12" y="12" width="456" height="260" rx="20" fill="url(#instagramGrad)" opacity="0.85" />
        <circle cx="240" cy="142" r="36" fill="rgba(0,0,0,0.4)" />
        <polygon points="234,130 252,142 234,154" fill="#ffffff" />
        
        <rect x="24" y="24" width="100" height="26" rx="13" fill="rgba(0,0,0,0.5)" />
        <text x="74" y="41" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">HD MEDIA</text>

        <text x="24" y="305" font-family="-apple-system, sans-serif" font-size="18" font-weight="700" fill="#ffffff">Summer Drop 2025 Lookbook</text>
        <text x="24" y="332" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">High-res video preview and official catalog delivered</text>
        <text x="24" y="352" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">instantly in your Instagram chat.</text>

        <g transform="translate(24, 380)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">View Full Interactive Catalog</text>
        </g>
      </g>
    </g>
  `);
}

// 10. Quick Replies Template
function svgQuickRepliesTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Quick Replies', 'Frictionless Interactive Pills')}
    
    <g transform="translate(420, 260)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="260" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="120" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="84" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">QUICK REPLIES</text>

        <text x="24" y="78" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">What is your primary goal?</text>
        <text x="24" y="108" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Tap a choice below so we can tailor the right</text>
        <text x="24" y="132" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">automation workflow for your brand:</text>
      </g>
    </g>

    <!-- Floating Quick Reply Pills -->
    <g transform="translate(468, 540)">
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="220" height="46" rx="23" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="110" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">🚀 Boost Followers</text>
      </g>
      <g transform="translate(230, 0)">
        <rect x="0" y="0" width="210" height="46" rx="23" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="105" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">💸 Drive Sales</text>
      </g>
      <g transform="translate(0, 56)">
        <rect x="0" y="0" width="230" height="46" rx="23" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="115" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">💬 24/7 Support Bot</text>
      </g>
      <g transform="translate(240, 56)">
        <rect x="0" y="0" width="200" height="46" rx="23" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="100" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">🎁 Viral Giveaway</text>
      </g>
    </g>
  `);
}

// 11. Share Template
function svgShareTemplate() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Share Template', 'Native Post &amp; Reel Embeds in DM')}
    
    <g transform="translate(420, 240)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="490" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        
        <rect x="24" y="20" width="130" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="89" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">POST EMBED IN DM</text>

        <!-- Instagram Post Preview Card -->
        <g transform="translate(24, 60)">
          <rect x="0" y="0" width="432" height="310" rx="20" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.1)" />
          <rect x="10" y="10" width="412" height="190" rx="14" fill="url(#btnGradient)" opacity="0.7" />
          <circle cx="216" cy="105" r="32" fill="rgba(255,255,255,0.2)" />
          <text x="216" y="113" font-family="-apple-system, sans-serif" font-size="24" text-anchor="middle">📸</text>

          <text x="20" y="235" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">5 Secrets to Scale Instagram to 100k</text>
          <text x="20" y="260" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Shared from your official profile feed • 48.2k Likes</text>
        </g>

        <g transform="translate(24, 400)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">View Post on Instagram</text>
        </g>
      </g>
    </g>
  `);
}

// 12. Welcome Message
function svgWelcomeMessage() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Welcome Message', 'Automated First-Touch Experience')}
    
    <g transform="translate(688, 260)">
      <rect x="180" y="0" width="250" height="52" rx="24" fill="#374151" />
      <text x="305" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="500" fill="#ffffff" text-anchor="middle">Hey there! 👋</text>
    </g>

    <g transform="translate(420, 336)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="380" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="140" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="94" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">WELCOME MESSAGE</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Welcome to the family! 🎉</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Thanks for reaching out! We have exclusive</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">deals, video guides, and instant help ready for you.</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">🎁 Claim 20% Welcome Coupon</text>
        </g>
        <g transform="translate(24, 236)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">🛍️ Browse Best Sellers</text>
        </g>
        <g transform="translate(24, 300)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">💬 Talk to Support</text>
        </g>
      </g>
    </g>
  `);
}

// 13. Post Comment Automation
function svgPostCommentReply() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Post Comment Engine', 'Turn Comments into Automated DMs')}
    
    <!-- Comment trigger box -->
    <g transform="translate(420, 240)">
      <rect x="0" y="0" width="696" height="96" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="48" cy="48" r="22" fill="#374151" />
      <text x="48" y="55" font-family="-apple-system, sans-serif" font-size="18" text-anchor="middle">👤</text>
      <text x="86" y="42" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">sarah_growth commented:</text>
      <text x="86" y="66" font-family="-apple-system, sans-serif" font-size="15" font-weight="500" fill="#818cf8">"Send me the link to this toolkit!"</text>
      <rect x="548" y="32" width="124" height="32" rx="16" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" />
      <text x="610" y="52" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#34d399" text-anchor="middle">TRIGGERED</text>
    </g>

    <!-- Instant DM Card -->
    <g transform="translate(420, 360)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="320" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="130" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="89" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">PRIVATE AUTO DM</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Hey Sarah! Here's the toolkit link 🔗</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">You asked for the link on our recent post.</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Click below for instant free access:</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Open 2025 Growth Toolkit</text>
        </g>
        <g transform="translate(24, 236)">
          <rect x="0" y="0" width="432" height="48" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="30" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#d4d4d8" text-anchor="middle">Reply with Questions</text>
        </g>
      </g>
    </g>
  `);
}

// 14. Post Share Automation
function svgPostShareAutomation() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Post Share Engine', 'Reward Followers Who Share Your Posts')}
    
    <!-- User shares post to DM -->
    <g transform="translate(640, 240)">
      <rect x="0" y="0" width="370" height="200" rx="22" fill="#374151" />
      <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8">Shared a post with you:</text>
      <rect x="16" y="50" width="338" height="130" rx="14" fill="#1f2937" />
      <rect x="24" y="58" width="80" height="114" rx="10" fill="url(#btnGradient)" opacity="0.6" />
      <text x="120" y="90" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Official Giveaway Post</text>
      <text x="120" y="115" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#9ca3af">@dmpanda.official</text>
      <text x="120" y="145" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#34d399">Shared via Instagram DM</text>
    </g>

    <!-- Instant automated reply -->
    <g transform="translate(420, 460)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="230" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <text x="24" y="44" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Thank you for sharing our post! 🎉</text>
        <text x="24" y="74" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">We spotted your share! You are now officially</text>
        <text x="24" y="98" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">entered into our $500 monthly giveaway.</text>

        <g transform="translate(24, 134)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">View Your Giveaway Entry #4829</text>
        </g>
      </g>
    </g>
  `);
}

// 15. Reel Comment Automation
function svgReelCommentReply() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Reel Comment Engine', 'Convert Viral Reels into Revenue')}
    
    <!-- Reel Comment Event -->
    <g transform="translate(420, 240)">
      <rect x="0" y="0" width="696" height="106" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="52" cy="53" r="24" fill="url(#instagramGrad)" />
      <text x="52" y="60" font-family="-apple-system, sans-serif" font-size="18" text-anchor="middle">🎬</text>
      <text x="96" y="44" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Viral Reel • 1.2M Views</text>
      <text x="96" y="70" font-family="-apple-system, sans-serif" font-size="15" font-weight="500" fill="#f472b6">Commented: "LINK PLEASE!"</text>
      <rect x="548" y="36" width="124" height="34" rx="17" fill="url(#btnGradient)" />
      <text x="610" y="58" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">AUTO SENT</text>
    </g>

    <!-- Instant DM -->
    <g transform="translate(420, 370)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="310" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="140" height="24" rx="12" fill="rgba(236,72,153,0.2)" />
        <text x="94" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#f472b6" text-anchor="middle">REEL AUTO RESPONSE</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Here is the exact link from the Reel! 🎥</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Thanks for checking out our viral Reel! Tap below</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">to grab the template shown in the video:</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Get The Viral Reel Template</text>
        </g>
        <g transform="translate(24, 236)">
          <rect x="0" y="0" width="432" height="48" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="30" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#d4d4d8" text-anchor="middle">Watch Step-by-Step Breakdown</text>
        </g>
      </g>
    </g>
  `);
}

// 16. Reel Share Automation
function svgReelShareAutomation() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Reel Share Engine', 'Instant DM on Shared Reels')}
    
    <g transform="translate(640, 240)">
      <rect x="0" y="0" width="370" height="200" rx="22" fill="#374151" />
      <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8">Shared a Reel with you:</text>
      <rect x="16" y="50" width="338" height="130" rx="14" fill="#1f2937" />
      <rect x="24" y="58" width="70" height="114" rx="10" fill="url(#instagramGrad)" opacity="0.7" />
      <circle cx="59" cy="115" r="18" fill="rgba(0,0,0,0.4)" />
      <polygon points="56,108 66,115 56,122" fill="#ffffff" />
      <text x="110" y="90" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Scale to $10k/mo With DMs</text>
      <text x="110" y="115" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#9ca3af">@dmpanda.official</text>
      <text x="110" y="145" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#818cf8">Direct Share</text>
    </g>

    <g transform="translate(420, 460)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="230" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <text x="24" y="44" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Loved that Reel? Here's the blueprint! 💡</text>
        <text x="24" y="74" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Since you shared our Reel, we unlocked the full</text>
        <text x="24" y="98" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">source code &amp; workflow template for you.</text>

        <g transform="translate(24, 134)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Download Blueprint Free</text>
        </g>
      </g>
    </g>
  `);
}

// 17. Sponsored Ad Comment Automation
function svgSponsoredAdCommentReply() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Sponsored Ad Engine', 'Turn Expensive Ad Comments into Sales')}
    
    <g transform="translate(420, 240)">
      <rect x="0" y="0" width="696" height="106" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="52" cy="53" r="24" fill="#3b82f6" />
      <text x="52" y="60" font-family="-apple-system, sans-serif" font-size="16" text-anchor="middle">📢</text>
      <text x="96" y="44" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Meta Sponsored Ad Campaign</text>
      <text x="96" y="70" font-family="-apple-system, sans-serif" font-size="15" font-weight="500" fill="#60a5fa">Prospect Commented: "How do I sign up?"</text>
      <rect x="548" y="36" width="124" height="34" rx="17" fill="url(#successGrad)" />
      <text x="610" y="58" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">LEAD CAPTURED</text>
    </g>

    <g transform="translate(420, 370)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="310" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="130" height="24" rx="12" fill="rgba(59,130,246,0.2)" />
        <text x="89" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#60a5fa" text-anchor="middle">SPONSORED AD DM</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Here is your fast-track sign up link! ⚡</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">We saw your comment on our ad. Enjoy a special</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">ad-exclusive bonus when you start today:</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Claim Ad Special &amp; Sign Up</text>
        </g>
        <g transform="translate(24, 236)">
          <rect x="0" y="0" width="432" height="48" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          <text x="216" y="30" font-family="-apple-system, sans-serif" font-size="15" font-weight="600" fill="#d4d4d8" text-anchor="middle">Chat With a Product Specialist</text>
        </g>
      </g>
    </g>
  `);
}

// 18. Public Comment Replies
function svgCommentAutoReply() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Public Comment Reply', 'Boost Social Proof on Every Post')}
    
    <g transform="translate(420, 240)">
      <!-- Comment thread simulation -->
      <rect x="0" y="0" width="696" height="340" rx="26" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      
      <!-- User's comment -->
      <g transform="translate(28, 28)">
        <circle cx="24" cy="24" r="20" fill="#4b5563" />
        <text x="24" y="30" font-family="-apple-system, sans-serif" font-size="14" text-anchor="middle">👤</text>
        <text x="60" y="20" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">emily_designs</text>
        <text x="175" y="20" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#71717a">2m ago</text>
        <text x="60" y="44" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#e4e4e7">"Can you send me the discount code please?"</text>
      </g>

      <!-- Connecting line -->
      <path d="M52 80 V130 H80" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none" />

      <!-- Bot's public reply -->
      <g transform="translate(90, 110)">
        <rect x="0" y="0" width="570" height="96" rx="20" fill="url(#bubbleBg)" stroke="rgba(99,102,241,0.3)" />
        <circle cx="28" cy="28" r="18" fill="url(#accentGlow)" />
        <text x="56" y="24" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">dmpanda.official</text>
        <!-- Verified -->
        <circle cx="185" cy="20" r="7" fill="#3b82f6" />
        <text x="56" y="52" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">"Just sent you a private DM with the code, Emily! Check your requests! 💌"</text>
        <rect x="440" y="14" width="110" height="24" rx="12" fill="rgba(16,185,129,0.15)" />
        <text x="495" y="30" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#34d399" text-anchor="middle">PUBLIC REPLY</text>
      </g>

      <!-- Result metric -->
      <g transform="translate(28, 240)">
        <rect x="0" y="0" width="640" height="64" rx="16" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.2)" />
        <text x="24" y="28" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#818cf8">ALGORITHM MULTIPLIER</text>
        <text x="24" y="50" font-family="-apple-system, sans-serif" font-size="14" font-weight="500" fill="#ffffff">Doubles comment volume, triggering Instagram's explore feed recommendation.</text>
      </g>
    </g>
  `);
}

// 19. Abusive Comment Moderation
function svgCommentModeration() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Comment Moderation', 'AI-Powered Spam &amp; Hate Speech Protection')}
    
    <g transform="translate(420, 240)">
      <rect x="0" y="0" width="696" height="420" rx="26" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      
      <!-- Status pill -->
      <g transform="translate(28, 28)">
        <rect x="0" y="0" width="180" height="34" rx="17" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" />
        <circle cx="18" cy="17" r="6" fill="#10b981" />
        <text x="32" y="22" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#34d399">PROTECTION ACTIVE</text>
      </g>

      <!-- Clean comments list -->
      <g transform="translate(28, 80)">
        <rect x="0" y="0" width="640" height="68" rx="16" fill="rgba(16,185,129,0.06)" stroke="rgba(16,185,129,0.2)" />
        <text x="20" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff">@mark_creator:</text>
        <text x="130" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">"Love this product, best purchase this year!"</text>
        <text x="20" y="52" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#34d399">✓ Approved &amp; Visible on Post</text>
      </g>

      <!-- Flagged comment (Blocked) -->
      <g transform="translate(28, 160)">
        <rect x="0" y="0" width="640" height="78" rx="16" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.25)" />
        <text x="20" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#f87171">@spambot_3910 [FLAGGED]:</text>
        <text x="20" y="50" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#fca5a5">"Invest $100 and earn $5000 fast click bio link..."</text>
        <rect x="490" y="20" width="130" height="28" rx="14" fill="#ef4444" />
        <text x="555" y="38" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">AUTO-HIDDEN</text>
        <text x="20" y="70" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#f87171">Blocked in 0.2s • Spam keyword matched</text>
      </g>

      <!-- Stats -->
      <g transform="translate(28, 260)">
        <rect x="0" y="0" width="640" height="120" rx="18" fill="rgba(0,0,0,0.3)" />
        <g transform="translate(40, 24)">
          <text x="0" y="24" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">99.8%</text>
          <text x="0" y="48" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Cleanliness Score</text>
        </g>
        <g transform="translate(240, 24)">
          <text x="0" y="24" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">1,420</text>
          <text x="0" y="48" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Spam Comments Blocked</text>
        </g>
        <g transform="translate(440, 24)">
          <text x="0" y="24" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">0.18s</text>
          <text x="0" y="48" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a1a1aa">Avg Response Speed</text>
        </g>
      </g>
    </g>
  `);
}

// 20. Story Mention Automation
function svgStoryMentionReply() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Story Mention Engine', 'Turn Brand Shoutouts into Customers')}
    
    <!-- User mentions your brand in Story -->
    <g transform="translate(420, 240)">
      <rect x="0" y="0" width="696" height="110" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="55" cy="55" r="26" fill="url(#instagramGrad)" />
      <text x="55" y="62" font-family="-apple-system, sans-serif" font-size="20" text-anchor="middle">⭐</text>
      <text x="100" y="44" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">jessica_style mentioned you in their Story</text>
      <text x="100" y="72" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">"Obsessed with my new jacket from @dmpanda.official! ✨"</text>
      <rect x="548" y="38" width="124" height="34" rx="17" fill="url(#btnGradient)" />
      <text x="610" y="60" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">INSTANT DM</text>
    </g>

    <!-- Automated DM response -->
    <g transform="translate(420, 376)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="300" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="140" height="24" rx="12" fill="rgba(99,102,241,0.2)" />
        <text x="94" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#818cf8" text-anchor="middle">STORY SHOUTOUT DM</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Jessica, thank you for the shoutout! ❤️</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">We loved your story! As a token of our appreciation,</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">here is a $15 gift voucher for your next order:</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Claim $15 Gift Voucher (SHOUT15)</text>
        </g>
      </g>
    </g>
  `);
}

// 21. Story Reply Automation
function svgStoryReplyAutomation() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Story Reply Engine', 'Convert Story Viewers into Real Conversations')}
    
    <g transform="translate(640, 240)">
      <rect x="0" y="0" width="370" height="190" rx="22" fill="#374151" />
      <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8">Replied to your Story:</text>
      <rect x="16" y="46" width="338" height="124" rx="14" fill="#1f2937" />
      <rect x="24" y="54" width="60" height="108" rx="8" fill="url(#instagramGrad)" opacity="0.8" />
      <text x="96" y="85" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">"Where can I buy this?"</text>
      <text x="96" y="112" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#9ca3af">Story Sticker Poll / DM</text>
      <text x="96" y="140" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#34d399">Active 24h Story</text>
    </g>

    <g transform="translate(420, 456)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="240" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <text x="24" y="44" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Right here! Tap to explore 🛍️</text>
        <text x="24" y="74" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Hey! Thanks for replying to our Story. The items</text>
        <text x="24" y="98" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">featured are in limited stock with free shipping:</text>

        <g transform="translate(24, 134)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Shop Story Collection (Free Shipping)</text>
        </g>
      </g>
    </g>
  `);
}

// 22. Instagram Live Automation
function svgLiveAutomation() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Instagram Live Engine', 'Real-Time Live Stream Sales Automation')}
    
    <g transform="translate(420, 240)">
      <!-- Simulated Live Broadcast Frame -->
      <rect x="0" y="0" width="696" height="150" rx="26" fill="#1e1b4b" stroke="rgba(129,140,248,0.3)" />
      
      <!-- Live badge -->
      <rect x="24" y="24" width="70" height="28" rx="6" fill="#ef4444" />
      <text x="59" y="43" font-family="-apple-system, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">LIVE</text>
      <text x="108" y="43" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff">8,420 Viewers</text>
      
      <!-- Host CTA -->
      <text x="24" y="85" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Host: "Type 'LIVE50' in the chat right now to get our exclusive 50% discount link!"</text>
      
      <!-- Live chat pill -->
      <g transform="translate(24, 102)">
        <rect x="0" y="0" width="280" height="34" rx="17" fill="rgba(255,255,255,0.08)" />
        <text x="14" y="22" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#a5b4fc">@charlie: "LIVE50"</text>
        <circle cx="250" cy="17" r="5" fill="#34d399" />
      </g>
      <rect x="520" y="96" width="150" height="34" rx="17" fill="url(#btnGradient)" />
      <text x="595" y="118" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">DM SENT TO VIEWER</text>
    </g>

    <!-- Viewer's DM inbox receipt -->
    <g transform="translate(420, 420)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="280" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        <rect x="24" y="20" width="130" height="24" rx="12" fill="rgba(239,68,68,0.2)" />
        <text x="89" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#f87171" text-anchor="middle">LIVE STREAM DM</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">You unlocked the 50% Live Promo! 🔥</text>
        <text x="24" y="110" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Because you commented LIVE50 while watching the stream,</text>
        <text x="24" y="134" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">your special bundle discount has been activated:</text>

        <g transform="translate(24, 172)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Claim 50% Live Deal ($49 instead of $99)</text>
        </g>
      </g>
    </g>
  `);
}

// 23. Suggest More
function svgSuggestMore() {
  return wrapFeatureSvg(`
    ${renderChassisHeader('Suggest More', 'Intelligent Upsells &amp; Product Recommendations')}
    
    <g transform="translate(420, 240)">
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="490" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" />
        
        <rect x="24" y="20" width="120" height="24" rx="12" fill="rgba(16,185,129,0.2)" />
        <text x="84" y="36" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#34d399" text-anchor="middle">RECOMMENDED</text>

        <text x="24" y="80" font-family="-apple-system, sans-serif" font-size="19" font-weight="700" fill="#ffffff">You might also love these! ✨</text>
        <text x="24" y="108" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Based on your recent interest in our summer collection,</text>
        <text x="24" y="132" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">here are complementary accessories with bundle savings:</text>

        <!-- Suggested Item 1 -->
        <g transform="translate(24, 160)">
          <rect x="0" y="0" width="432" height="84" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <rect x="12" y="12" width="60" height="60" rx="12" fill="url(#btnGradient)" opacity="0.6" />
          <text x="42" y="47" font-family="-apple-system, sans-serif" font-size="20" text-anchor="middle">🕶️</text>
          <text x="86" y="38" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Polarized UV Sunglasses</text>
          <text x="86" y="60" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#34d399">$39 (Save 25% with Bundle)</text>
          <rect x="330" y="24" width="88" height="36" rx="14" fill="url(#btnGradient)" />
          <text x="374" y="46" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">+ Add</text>
        </g>

        <!-- Suggested Item 2 -->
        <g transform="translate(24, 258)">
          <rect x="0" y="0" width="432" height="84" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <rect x="12" y="12" width="60" height="60" rx="12" fill="url(#instagramGrad)" opacity="0.6" />
          <text x="42" y="47" font-family="-apple-system, sans-serif" font-size="20" text-anchor="middle">🧢</text>
          <text x="86" y="38" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Classic Vintage Baseball Cap</text>
          <text x="86" y="60" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#34d399">$29 (Save 20%)</text>
          <rect x="330" y="24" width="88" height="36" rx="14" fill="url(#btnGradient)" />
          <text x="374" y="46" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">+ Add</text>
        </g>

        <!-- Master CTA -->
        <g transform="translate(24, 360)">
          <rect x="0" y="0" width="432" height="52" rx="16" fill="url(#btnGradient)" />
          <text x="216" y="32" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">Checkout With Bundle Savings ($68)</text>
        </g>
      </g>
    </g>
  `);
}

// -------------------------------------------------------------
// 10 Unified Blog Artwork SVG Generators (1200x675 16:9)
// -------------------------------------------------------------
function wrapBlogSvg(topicBadge, mainTitle, subtitle, visualIllustration) {
  return `
<svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1200" y2="675" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="50%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="glowPurple" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#833AB4" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="accentPink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#8B5CF6" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9" />
    </linearGradient>
    <filter id="cardShadow" x="-20" y="-10" width="110%" height="120%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6" />
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#4f46e5" flood-opacity="0.2" />
    </filter>
    <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Deep Canvas Background -->
  <rect width="1200" height="675" fill="url(#bgGrad)" />
  <rect width="1200" height="675" fill="url(#gridPattern)" />

  <!-- Radial Glow Blooms -->
  <circle cx="200" cy="150" r="300" fill="url(#glowPurple)" opacity="0.18" filter="blur(80px)" />
  <circle cx="1000" cy="500" r="350" fill="url(#accentPink)" opacity="0.15" filter="blur(90px)" />

  <!-- Top Brand Navigation / Header in Art -->
  <g transform="translate(80, 50)">
    <circle cx="20" cy="20" r="18" fill="url(#accentPink)" />
    <!-- Mini Panda icon inside -->
    <circle cx="16" cy="17" r="3" fill="#ffffff" />
    <circle cx="24" cy="17" r="3" fill="#ffffff" />
    <path d="M16 23 Q20 26 24 23" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none" />
    
    <text x="50" y="26" font-family="-apple-system, sans-serif" font-size="18" font-weight="800" fill="#ffffff" letter-spacing="1">DM PANDA</text>
    <text x="160" y="26" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#818cf8">EDITORIAL GUIDE</text>
  </g>

  <!-- Left Content Column -->
  <g transform="translate(80, 150)">
    <!-- Topic Pill -->
    <rect x="0" y="0" width="220" height="36" rx="18" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1" />
    <text x="110" y="23" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#818cf8" text-anchor="middle" letter-spacing="0.5">${topicBadge}</text>

    <!-- Main Title Lines -->
    <text x="0" y="85" font-family="-apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${mainTitle[0]}</text>
    <text x="0" y="140" font-family="-apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${mainTitle[1] || ''}</text>
    ${mainTitle[2] ? `<text x="0" y="195" font-family="-apple-system, sans-serif" font-size="44" font-weight="800" fill="url(#accentPink)" letter-spacing="-0.5">${mainTitle[2]}</text>` : ''}

    <!-- Subtitle / Meta -->
    <text x="0" y="260" font-family="-apple-system, sans-serif" font-size="18" font-weight="400" fill="#94a3b8">${subtitle}</text>

    <!-- Stat/Highlight Badge -->
    <g transform="translate(0, 310)">
      <rect x="0" y="0" width="280" height="54" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <circle cx="28" cy="27" r="10" fill="#10b981" />
      <path d="M24 27 L27 30 L32 24" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
      <text x="48" y="32" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff">100% Meta Compliant • 2025</text>
    </g>
  </g>

  <!-- Right Visual Feature Showcase -->
  <g transform="translate(680, 110)">
    ${visualIllustration}
  </g>
</svg>
  `.trim();
}

// 1. blog_auto_reply_comments
function svgBlogAutoReplyComments() {
  const visual = `
    <g filter="url(#cardShadow)">
      <!-- Main Glass Card -->
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      
      <!-- Card header -->
      <rect x="24" y="64" width="140" height="28" rx="14" fill="rgba(129,140,248,0.2)" />
      <text x="94" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#818cf8" text-anchor="middle">COMMENT AUTO-REPLY</text>

      <!-- Post Comment Simulation -->
      <g transform="translate(24, 110)">
        <rect x="0" y="0" width="392" height="80" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
        <circle cx="34" cy="40" r="18" fill="#3b82f6" />
        <text x="34" y="46" font-family="-apple-system, sans-serif" font-size="14" text-anchor="middle">💬</text>
        <text x="64" y="34" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff">User comments: "PRICE"</text>
        <text x="64" y="56" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#94a3b8">Instant trigger detected</text>
      </g>

      <!-- Connecting Flow Arrow -->
      <g transform="translate(200, 204)">
        <circle cx="20" cy="16" r="18" fill="url(#accentPink)" />
        <path d="M20 9 V23 M15 18 L20 23 L25 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>

      <!-- Private DM Delivered Card -->
      <g transform="translate(24, 250)">
        <rect x="0" y="0" width="392" height="130" rx="20" fill="url(#bubbleBg)" stroke="rgba(99,102,241,0.3)" />
        <rect x="18" y="16" width="90" height="22" rx="11" fill="rgba(16,185,129,0.2)" />
        <text x="63" y="31" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#34d399" text-anchor="middle">DM DELIVERED</text>
        <text x="18" y="64" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Here is the 25% coupon code! 🎉</text>
        <text x="18" y="90" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">Sent privately in under 0.4 seconds.</text>
        <rect x="18" y="104" width="356" height="34" rx="10" fill="url(#btnGradient)" />
        <text x="196" y="126" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">Claim Discount ($49)</text>
      </g>

      <!-- Speed Badge -->
      <g transform="translate(24, 420)">
        <rect x="0" y="0" width="392" height="50" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" />
        <text x="196" y="30" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="#34d399" text-anchor="middle">⚡ 0.38s Average Delivery Time</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'COMMENT AUTOMATION',
    ['How to Auto-Reply', 'to Instagram Comments', 'In 2025'],
    'Convert post engagement into qualified leads and direct sales.',
    visual
  );
}

// 2. blog_dm_automation_guide
function svgBlogDmAutomationGuide() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="170" height="28" rx="14" fill="rgba(129,140,248,0.2)" />
      <text x="109" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#818cf8" text-anchor="middle">END-TO-END FLYWHEEL</text>

      <!-- Blueprint nodes -->
      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="180" height="80" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff">1. Engagement</text>
        <text x="20" y="55" font-family="-apple-system, sans-serif" font-size="12" font-weight="400" fill="#94a3b8">Post, Reel, Story</text>
      </g>
      <g transform="translate(216, 115)">
        <rect x="0" y="0" width="200" height="80" rx="16" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#818cf8">2. Keyword Trigger</text>
        <text x="20" y="55" font-family="-apple-system, sans-serif" font-size="12" font-weight="400" fill="#c7d2fe">AI Intent Matching</text>
      </g>
      <g transform="translate(24, 215)">
        <rect x="0" y="0" width="180" height="80" rx="16" fill="rgba(236,72,153,0.15)" stroke="rgba(236,72,153,0.3)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#f472b6">3. Follow Gate</text>
        <text x="20" y="55" font-family="-apple-system, sans-serif" font-size="12" font-weight="400" fill="#fbcfe8">Growth Verification</text>
      </g>
      <g transform="translate(216, 215)">
        <rect x="0" y="0" width="200" height="80" rx="16" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#34d399">4. Conversion DM</text>
        <text x="20" y="55" font-family="-apple-system, sans-serif" font-size="12" font-weight="400" fill="#a7f3d0">Interactive Checkout</text>
      </g>

      <g transform="translate(24, 320)">
        <rect x="0" y="0" width="392" height="150" rx="20" fill="url(#btnGradient)" />
        <text x="196" y="44" font-family="-apple-system, sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">COMPLETE PLAYBOOK</text>
        <text x="196" y="74" font-family="-apple-system, sans-serif" font-size="15" font-weight="400" fill="#e0e7ff" text-anchor="middle">From zero to 10,000 automated leads</text>
        <rect x="56" y="94" width="280" height="38" rx="12" fill="#ffffff" />
        <text x="196" y="118" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#4f46e5" text-anchor="middle">Read Full Architecture</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'DEFINITIVE GUIDE',
    ['Instagram DM', 'Automation Guide', 'Beginner to Pro'],
    'The complete playbook for building automated conversation funnels.',
    visual
  );
}

// 3. blog_story_mention_auto_reply
function svgBlogStoryMention() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="160" height="28" rx="14" fill="rgba(236,72,153,0.2)" />
      <text x="104" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#f472b6" text-anchor="middle">STORY SHOUTOUT VIP</text>

      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="392" height="180" rx="20" fill="url(#instagramGrad)" opacity="0.8" />
        <circle cx="196" cy="80" r="38" fill="rgba(0,0,0,0.4)" />
        <text x="196" y="90" font-family="-apple-system, sans-serif" font-size="30" text-anchor="middle">📸</text>
        <rect x="96" y="130" width="200" height="32" rx="16" fill="rgba(0,0,0,0.6)" />
        <text x="196" y="151" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">@mention detected!</text>
      </g>

      <g transform="translate(24, 315)">
        <rect x="0" y="0" width="392" height="160" rx="20" fill="url(#bubbleBg)" stroke="rgba(99,102,241,0.3)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Instant Thank-You Delivery 💌</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">"Thank you for sharing our brand on your story!</text>
        <text x="20" y="80" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">Here is an exclusive $20 gift voucher for you."</text>
        <rect x="20" y="100" width="352" height="42" rx="12" fill="url(#btnGradient)" />
        <text x="196" y="126" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">Redeem $20 Gift Card</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'STORY AUTOMATION',
    ['How to Auto-Reply', 'to Story Mentions', 'Turn Shoutouts to Leads'],
    'Reward every customer shoutout automatically with personalized gifts.',
    visual
  );
}

// 4. blog_auto_reply_templates
function svgBlogAutoReplyTemplates() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="150" height="28" rx="14" fill="rgba(129,140,248,0.2)" />
      <text x="99" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#818cf8" text-anchor="middle">15 PROVEN TEMPLATES</text>

      <!-- Cascading cards -->
      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="392" height="90" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Template #1: Flash Sale Drop</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#94a3b8">Interactive countdown + single-tap coupon claim</text>
      </g>
      <g transform="translate(24, 220)">
        <rect x="0" y="0" width="392" height="90" rx="16" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.25)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#818cf8">Template #2: Lead Magnet Delivery</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#c7d2fe">Instant PDF file attachment + email capture</text>
      </g>
      <g transform="translate(24, 325)">
        <rect x="0" y="0" width="392" height="90" rx="16" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.25)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#34d399">Template #3: Quiz &amp; Recommendation</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a7f3d0">Multi-step quick reply diagnostic funnel</text>
      </g>

      <g transform="translate(24, 430)">
        <rect x="0" y="0" width="392" height="48" rx="14" fill="url(#btnGradient)" />
        <text x="196" y="29" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">Copy All 15 Templates (Free)</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'TEMPLATES &amp; SCRIPTS',
    ['15 High-Converting', 'Instagram Auto-Reply', 'Templates for 2025'],
    'Plug-and-play DM and comment templates that maximize click-throughs.',
    visual
  );
}

// 5. blog_comment_lead_generation
function svgBlogCommentLeadGen() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="160" height="28" rx="14" fill="rgba(16,185,129,0.2)" />
      <text x="104" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#34d399" text-anchor="middle">COMMENT SALES FUNNEL</text>

      <!-- Funnel stages -->
      <g transform="translate(24, 115)">
        <polygon points="0,0 392,0 340,65 52,65" fill="rgba(99,102,241,0.25)" />
        <text x="196" y="38" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">10,000 Post Comments</text>
      </g>
      <g transform="translate(24, 185)">
        <polygon points="52,0 340,0 290,65 102,65" fill="rgba(139,92,246,0.3)" />
        <text x="196" y="38" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">8,400 Auto DMs Delivered</text>
      </g>
      <g transform="translate(24, 255)">
        <polygon points="102,0 290,0 240,65 152,65" fill="rgba(236,72,153,0.35)" />
        <text x="196" y="38" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">4,200 Link Clicks</text>
      </g>
      <g transform="translate(24, 325)">
        <rect x="152" y="0" width="88" height="60" rx="14" fill="url(#successGrad)" />
        <text x="196" y="36" font-family="-apple-system, sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle">$48.5k</text>
      </g>

      <g transform="translate(24, 410)">
        <rect x="0" y="0" width="392" height="64" rx="16" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.08)" />
        <text x="196" y="28" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">42% Conversion Rate</text>
        <text x="196" y="48" font-family="-apple-system, sans-serif" font-size="12" font-weight="400" fill="#94a3b8" text-anchor="middle">vs 1.8% typical link-in-bio benchmarks</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'LEAD GENERATION',
    ['Instagram Comment', 'Lead Generation', 'Turn Posts into Funnels'],
    'How top digital brands convert comment traffic into paying customers.',
    visual
  );
}

// 6. blog_comment_moderation
function svgBlogCommentModeration() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="160" height="28" rx="14" fill="rgba(239,68,68,0.2)" />
      <text x="104" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#f87171" text-anchor="middle">BRAND SHIELD 24/7</text>

      <!-- Security Shield Art -->
      <g transform="translate(140, 115)">
        <circle cx="80" cy="80" r="70" fill="url(#btnGradient)" opacity="0.3" filter="blur(20px)" />
        <polygon points="80,10 140,40 140,110 80,150 20,110 20,40" fill="url(#btnGradient)" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
        <path d="M60 80 L75 95 L105 65" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </g>

      <!-- Protection stats -->
      <g transform="translate(24, 290)">
        <rect x="0" y="0" width="392" height="80" rx="16" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.2)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#f87171">Spam &amp; Phishing Interception</text>
        <text x="20" y="56" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#fca5a5">Over 1,200 offensive links auto-deleted monthly</text>
      </g>
      <g transform="translate(24, 385)">
        <rect x="0" y="0" width="392" height="80" rx="16" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" />
        <text x="20" y="32" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#34d399">Zero Impact on Good Engagement</text>
        <text x="20" y="56" font-family="-apple-system, sans-serif" font-size="13" font-weight="400" fill="#a7f3d0">Real community conversations stay 100% visible</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'COMMUNITY SAFETY',
    ['Moderate Comments', 'Automatically', 'Stop Spam &amp; Phishing'],
    'Keep your feed pristine and protect your community 24/7 on autopilot.',
    visual
  );
}

// 7. blog_reel_comment_automation
function svgBlogReelComment() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="160" height="28" rx="14" fill="rgba(236,72,153,0.2)" />
      <text x="104" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#f472b6" text-anchor="middle">VIRAL REEL CONVERSION</text>

      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="392" height="190" rx="20" fill="url(#instagramGrad)" />
        <rect x="16" y="16" width="70" height="26" rx="13" fill="rgba(0,0,0,0.6)" />
        <text x="51" y="33" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">REEL</text>
        
        <circle cx="196" cy="95" r="32" fill="rgba(0,0,0,0.4)" />
        <polygon points="192,85 206,95 192,105" fill="#ffffff" />
        
        <text x="24" y="150" font-family="-apple-system, sans-serif" font-size="20" font-weight="800" fill="#ffffff">1,400,000 Views</text>
        <text x="24" y="172" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="#fbcfe8">Comment "TEMPLATE" to get resources</text>
      </g>

      <g transform="translate(24, 325)">
        <rect x="0" y="0" width="392" height="145" rx="20" fill="url(#bubbleBg)" stroke="rgba(99,102,241,0.3)" />
        <text x="20" y="36" font-family="-apple-system, sans-serif" font-size="17" font-weight="700" fill="#ffffff">Automated DM Delivered Instantly ⚡</text>
        <text x="20" y="62" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">Every single commenter receives the link</text>
        <text x="20" y="82" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">with zero manual effort required.</text>
        <rect x="20" y="98" width="352" height="36" rx="10" fill="url(#btnGradient)" />
        <text x="196" y="121" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">View Reel Growth Case Study</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'VIRAL VIRALITY',
    ['Reel Comment', 'Automation Secrets', 'Views into Revenue'],
    'How to capture tens of thousands of leads when a Reel goes viral.',
    visual
  );
}

// 8. blog_live_automation
function svgBlogLiveAutomation() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="140" height="28" rx="14" fill="rgba(239,68,68,0.2)" />
      <text x="94" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#f87171" text-anchor="middle">LIVE STREAM SALES</text>

      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="392" height="180" rx="20" fill="#1e1b4b" stroke="rgba(129,140,248,0.3)" />
        <rect x="18" y="18" width="60" height="26" rx="6" fill="#ef4444" />
        <text x="48" y="35" font-family="-apple-system, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">LIVE</text>
        <text x="90" y="35" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="#ffffff">5,200 Watching</text>

        <text x="18" y="80" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Comment "DROP" for link</text>
        <g transform="translate(18, 100)">
          <rect x="0" y="0" width="220" height="30" rx="15" fill="rgba(255,255,255,0.08)" />
          <text x="12" y="20" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="#c7d2fe">@david: DROP 🔥</text>
        </g>
        <rect x="260" y="100" width="114" height="30" rx="15" fill="url(#btnGradient)" />
        <text x="317" y="20" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">DM SENT</text>
      </g>

      <g transform="translate(24, 315)">
        <rect x="0" y="0" width="392" height="155" rx="20" fill="url(#bubbleBg)" stroke="rgba(16,185,129,0.3)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Zero Viewer Dropoff ⚡</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">Viewers never leave your live broadcast.</text>
        <text x="20" y="80" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">Checkout link lands right in their DM inbox.</text>
        <rect x="20" y="102" width="352" height="38" rx="10" fill="url(#btnGradient)" />
        <text x="196" y="126" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">Explore Live Stream Bot Flow</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'LIVE BROADCAST',
    ['Instagram Live', 'Automation Guide', 'Capture Leads Live'],
    'Broadcast seamlessly without typing links manually into the live chat.',
    visual
  );
}

// 9. blog_super_profile
function svgBlogSuperProfile() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="150" height="28" rx="14" fill="rgba(99,102,241,0.2)" />
      <text x="99" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#818cf8" text-anchor="middle">SUPER PROFILE BIO</text>

      <!-- Mini phone simulation -->
      <g transform="translate(100, 110)">
        <rect x="0" y="0" width="240" height="360" rx="28" fill="#111827" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
        <circle cx="120" cy="50" r="26" fill="url(#accentPink)" />
        <text x="120" y="92" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">@brand.official</text>
        <text x="120" y="108" font-family="-apple-system, sans-serif" font-size="10" font-weight="400" fill="#9ca3af" text-anchor="middle">High-Converting Hub</text>

        <!-- Links -->
        <g transform="translate(16, 126)">
          <rect x="0" y="0" width="208" height="34" rx="10" fill="url(#btnGradient)" />
          <text x="104" y="21" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">⚡ VIP Early Access</text>
        </g>
        <g transform="translate(16, 170)">
          <rect x="0" y="0" width="208" height="34" rx="10" fill="rgba(255,255,255,0.06)" />
          <text x="104" y="21" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">🛍️ Shop Viral Drop</text>
        </g>
        <g transform="translate(16, 214)">
          <rect x="0" y="0" width="208" height="34" rx="10" fill="rgba(255,255,255,0.06)" />
          <text x="104" y="21" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">📞 Book Growth Call</text>
        </g>

        <!-- Click metric -->
        <g transform="translate(24, 270)">
          <rect x="0" y="0" width="192" height="42" rx="10" fill="rgba(16,185,129,0.15)" />
          <text x="96" y="26" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#34d399" text-anchor="middle">🔥 14.8k Clicks / Month</text>
        </g>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'LINK IN BIO REVOLUTION',
    ['What Is a Super', 'Profile? Link in Bio', 'That Actually Converts'],
    'Replace basic link trees with high-converting, analytics-rich portals.',
    visual
  );
}

// 10. blog_giveaway_auto_dm
function svgBlogGiveawayAutoDm() {
  const visual = `
    <g filter="url(#cardShadow)">
      <rect x="0" y="40" width="440" height="460" rx="30" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <rect x="24" y="64" width="170" height="28" rx="14" fill="rgba(245,158,11,0.2)" />
      <text x="109" y="82" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#fbbf24" text-anchor="middle">VIRAL GIVEAWAY ENGINE</text>

      <!-- Giveaway card -->
      <g transform="translate(24, 115)">
        <rect x="0" y="0" width="392" height="180" rx="20" fill="url(#instagramGrad)" />
        <circle cx="196" cy="75" r="34" fill="rgba(0,0,0,0.4)" />
        <text x="196" y="85" font-family="-apple-system, sans-serif" font-size="30" text-anchor="middle">🎁</text>
        <text x="196" y="135" font-family="-apple-system, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">$1,000 SHOPPING SPREE</text>
        <text x="196" y="158" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="#fef3c7" text-anchor="middle">Comment "WIN" to Enter Instantly</text>
      </g>

      <g transform="translate(24, 315)">
        <rect x="0" y="0" width="392" height="155" rx="20" fill="url(#bubbleBg)" stroke="rgba(245,158,11,0.3)" />
        <text x="20" y="34" font-family="-apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Verified Entry + Follow Gate 🎟️</text>
        <text x="20" y="60" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">1. Verifies user is following your profile</text>
        <text x="20" y="80" font-family="-apple-system, sans-serif" font-size="14" font-weight="400" fill="#d4d4d8">2. Issues unique raffle ticket number via DM</text>
        <rect x="20" y="102" width="352" height="38" rx="10" fill="url(#btnGradient)" />
        <text x="196" y="126" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">Get Complete Giveaway Template</text>
      </g>
    </g>
  `;
  return wrapBlogSvg(
    'VIRAL GROWTH HACK',
    ['How to Run Instagram', 'Giveaways with Auto DMs', 'Viral Rules &amp; Setup'],
    '10x your followers and engagement legally with verified auto-entry DMs.',
    visual
  );
}

// -------------------------------------------------------------
// Render Engine Execution
// -------------------------------------------------------------
async function renderAsset(filenameBase, svgString, isBlog = false) {
  const pngPath = path.join(OUTPUT_DIR, `${filenameBase}.png`);
  const webpPath = path.join(OUTPUT_DIR, `${filenameBase}.webp`);

  const width = isBlog ? 1200 : 1536;
  const height = isBlog ? 675 : 1024;

  const svgBuffer = Buffer.from(svgString);

  // 1. Lossless / Sharp PNG
  await sharp(svgBuffer, { density: 150 })
    .resize(width, height)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(pngPath);

  // 2. High-performance WebP
  await sharp(svgBuffer, { density: 150 })
    .resize(width, height)
    .webp({ quality: 85, effort: 6 })
    .toFile(webpPath);

  const pngStat = fs.statSync(pngPath);
  const webpStat = fs.statSync(webpPath);
  console.log(`  ✓ ${filenameBase}.png (${Math.round(pngStat.size/1024)}KB) | .webp (${Math.round(webpStat.size/1024)}KB)`);
}

async function run() {
  console.log('====================================================');
  console.log('Starting Unified Professional Image Generation Suite');
  console.log('====================================================\n');

  // --- 1. Features (23 Assets, 1536x1024 Transparent RGBA) ---
  console.log('Rendering 23 Features in unified 1536x1024 transparent RGBA chassis:');
  const featuresList = [
    { name: 'inbox_menu', fn: svgInboxMenu },
    { name: 'super_profile', fn: svgSuperProfile },
    { name: 'conversation_starter', fn: svgConversationStarter },
    { name: 'follow_gated_dm', fn: svgFollowGated },
    { name: 'global_triggers', fn: svgGlobalTriggers },
    { name: 'text_template', fn: svgTextTemplate },
    { name: 'carousel_template', fn: svgCarouselTemplate },
    { name: 'button_template', fn: svgButtonTemplate },
    { name: 'media_template', fn: svgMediaTemplate },
    { name: 'quick_replies_template', fn: svgQuickRepliesTemplate },
    { name: 'share_template', fn: svgShareTemplate },
    { name: 'welcome_message', fn: svgWelcomeMessage },
    { name: 'post_comment_dm_reply', fn: svgPostCommentReply },
    { name: 'post_share_automation', fn: svgPostShareAutomation },
    { name: 'reel_comment_dm_reply', fn: svgReelCommentReply },
    { name: 'reel_share_automation', fn: svgReelShareAutomation },
    { name: 'sponsored_ad_comment_reply', fn: svgSponsoredAdCommentReply },
    { name: 'comment_auto_reply', fn: svgCommentAutoReply },
    { name: 'comment_moderation', fn: svgCommentModeration },
    { name: 'story_mention_dm_reply', fn: svgStoryMentionReply },
    { name: 'story_reply_dm_reply', fn: svgStoryReplyAutomation },
    { name: 'live_automation', fn: svgLiveAutomation },
    { name: 'suggest_more', fn: svgSuggestMore }
  ];

  for (const item of featuresList) {
    await renderAsset(item.name, item.fn(), false);
  }

  // --- 2. Blogs (10 Assets, 1200x675 16:9 Editorial Luxury Artwork) ---
  console.log('\nRendering 10 Blog Hero Covers in unified 1200x675 16:9 SaaS artwork:');
  const blogsList = [
    { name: 'blog_auto_reply_comments', fn: svgBlogAutoReplyComments },
    { name: 'blog_dm_automation_guide', fn: svgBlogDmAutomationGuide },
    { name: 'blog_story_mention_auto_reply', fn: svgBlogStoryMention },
    { name: 'blog_auto_reply_templates', fn: svgBlogAutoReplyTemplates },
    { name: 'blog_comment_lead_generation', fn: svgBlogCommentLeadGen },
    { name: 'blog_comment_moderation', fn: svgBlogCommentModeration },
    { name: 'blog_reel_comment_automation', fn: svgBlogReelComment },
    { name: 'blog_live_automation', fn: svgBlogLiveAutomation },
    { name: 'blog_super_profile', fn: svgBlogSuperProfile },
    { name: 'blog_giveaway_auto_dm', fn: svgBlogGiveawayAutoDm }
  ];

  for (const item of blogsList) {
    await renderAsset(item.name, item.fn(), true);
  }

  console.log('\n====================================================');
  console.log('All 33 assets generated and synchronized successfully!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('Fatal generation error:', err);
  process.exit(1);
});
