const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'Frontend', 'public', 'images');

// 1. Welcome Message UI Card (1536x1024, Transparent RGBA)
// Showcases an automated Welcome greeting with interactive CTA buttons, verified sender badge, and follower touchpoint
function createWelcomeMessageSvg() {
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
      <stop offset="100%" stop-color="#222226" />
    </linearGradient>
  </defs>

  <!-- Ambient Glow Behind Device -->
  <circle cx="768" cy="500" r="320" fill="url(#btnGradient)" opacity="0.12" filter="blur(60px)" />

  <!-- Main Floating Chat Card Container -->
  <g filter="url(#shadow)">
    <!-- Device / Window Chassis -->
    <rect x="368" y="92" width="800" height="840" rx="36" fill="url(#cardBg)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" />
    
    <!-- Header Bar -->
    <rect x="368" y="92" width="800" height="96" rx="36" fill="rgba(255,255,255,0.02)" />
    <path d="M368 188 H1168" stroke="rgba(255,255,255,0.06)" stroke-width="1" />

    <!-- Avatar & Header Info -->
    <circle cx="430" cy="140" r="26" fill="url(#accentGlow)" />
    <!-- Panda / Brand Icon inside Avatar -->
    <circle cx="423" cy="135" r="4.5" fill="#ffffff" />
    <circle cx="437" cy="135" r="4.5" fill="#ffffff" />
    <path d="M424 146 Q430 151 436 146" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" />
    
    <text x="472" y="136" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">DM Panda Verified</text>
    <!-- Verified Badge -->
    <circle cx="664" cy="130" r="9" fill="#3b82f6" />
    <path d="M660 130 L663 133 L668 127" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    
    <text x="472" y="157" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#a1a1aa">Active now • Instagram Automation</text>

    <!-- Header Actions (Icons) -->
    <circle cx="1068" cy="140" r="16" fill="rgba(255,255,255,0.04)" />
    <circle cx="1116" cy="140" r="16" fill="rgba(255,255,255,0.04)" />
    <circle cx="1068" cy="140" r="3" fill="#ffffff" />
    <circle cx="1116" cy="140" r="3" fill="#ffffff" />

    <!-- Date Pill -->
    <rect x="716" y="216" width="104" height="28" rx="14" fill="rgba(255,255,255,0.05)" />
    <text x="768" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#71717a" text-anchor="middle">TODAY</text>

    <!-- Outgoing User Trigger Message -->
    <g transform="translate(688, 268)">
      <rect x="180" y="0" width="250" height="54" rx="24" fill="#374151" />
      <text x="305" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#ffffff" text-anchor="middle">Hey there! 👋</text>
    </g>

    <!-- Automated Welcome Message Bubble & Card -->
    <g transform="translate(418, 346)">
      <!-- Mini avatar beside message -->
      <circle cx="20" cy="20" r="16" fill="url(#accentGlow)" />
      
      <!-- Main Message Card -->
      <g transform="translate(48, 0)">
        <rect x="0" y="0" width="480" height="340" rx="26" fill="url(#bubbleBg)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        
        <!-- Welcome Header Banner -->
        <rect x="2" y="2" width="476" height="64" rx="24" fill="rgba(255,255,255,0.02)" />
        <rect x="24" y="20" width="130" height="26" rx="13" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.3)" stroke-width="1" />
        <text x="89" y="37" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#818cf8" text-anchor="middle">WELCOME MESSAGE</text>

        <!-- Greeting Text -->
        <text x="24" y="104" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Welcome to the family! 🎉</text>
        <text x="24" y="136" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">Thanks for connecting with us! We have exclusive</text>
        <text x="24" y="160" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">deals, tutorials, and instant answers ready for you.</text>
        <text x="24" y="184" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#d4d4d8">What would you like to explore first?</text>

        <!-- Action Button 1 (Primary) -->
        <g transform="translate(24, 212)">
          <rect x="0" y="0" width="432" height="48" rx="14" fill="url(#btnGradient)" />
          <text x="216" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">🛍️ Browse Product Catalog</text>
        </g>

        <!-- Action Button 2 (Secondary) -->
        <g transform="translate(24, 270)">
          <rect x="0" y="0" width="432" height="48" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
          <text x="216" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="600" fill="#e4e4e7" text-anchor="middle">🎁 Claim 15% Welcome Discount</text>
        </g>
      </g>
    </g>

    <!-- Quick Reply Chips Below Message -->
    <g transform="translate(466, 712)">
      <rect x="0" y="0" width="154" height="40" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <text x="77" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#a1a1aa" text-anchor="middle">✨ Latest Deals</text>

      <rect x="166" y="0" width="168" height="40" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <text x="250" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#a1a1aa" text-anchor="middle">💬 Talk to Support</text>

      <rect x="346" y="0" width="154" height="40" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <text x="423" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#a1a1aa" text-anchor="middle">📍 Store Location</text>
    </g>

    <!-- Footer Input Bar -->
    <g transform="translate(408, 830)">
      <rect x="0" y="0" width="720" height="52" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <circle cx="28" cy="26" r="15" fill="#3b82f6" />
      <text x="64" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#71717a">Message...</text>
      <!-- Mic / Photo icons -->
      <circle cx="650" cy="26" r="12" fill="rgba(255,255,255,0.06)" />
      <circle cx="686" cy="26" r="12" fill="rgba(255,255,255,0.06)" />
    </g>
  </g>
</svg>
  `.trim();
}

// 2. Share Template UI Card (1536x1024, Transparent RGBA)
// Showcases an automated Instagram Post / Reel share card delivered directly inside DM
function createShareTemplateSvg() {
  return `
<svg width="1536" height="1024" viewBox="0 0 1536 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadowShare" x="200" y="40" width="1136" height="944" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#ec4899" flood-opacity="0.15" />
    </filter>
    <linearGradient id="cardBgShare" x1="280" y1="90" x2="1256" y2="880" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="igGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f09433" />
      <stop offset="25%" stop-color="#e6683c" />
      <stop offset="50%" stop-color="#dc2743" />
      <stop offset="75%" stop-color="#cc2366" />
      <stop offset="100%" stop-color="#bc1888" />
    </linearGradient>
    <linearGradient id="btnGradientShare" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="postThumbGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
  </defs>

  <!-- Ambient Glow Behind Device -->
  <circle cx="768" cy="500" r="320" fill="url(#igGradient)" opacity="0.10" filter="blur(60px)" />

  <g filter="url(#shadowShare)">
    <!-- Device / Window Chassis -->
    <rect x="368" y="92" width="800" height="840" rx="36" fill="url(#cardBgShare)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" />
    
    <!-- Header Bar -->
    <rect x="368" y="92" width="800" height="96" rx="36" fill="rgba(255,255,255,0.02)" />
    <path d="M368 188 H1168" stroke="rgba(255,255,255,0.06)" stroke-width="1" />

    <!-- Avatar & Header Info -->
    <circle cx="430" cy="140" r="26" fill="url(#igGradient)" />
    <circle cx="423" cy="135" r="4.5" fill="#ffffff" />
    <circle cx="437" cy="135" r="4.5" fill="#ffffff" />
    <path d="M424 146 Q430 151 436 146" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" />
    
    <text x="472" y="136" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Creator Studio</text>
    <circle cx="628" cy="130" r="9" fill="#3b82f6" />
    <path d="M624 130 L627 133 L632 127" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <text x="472" y="157" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#a1a1aa">Automated Content Delivery</text>

    <!-- Date Pill -->
    <rect x="716" y="216" width="104" height="28" rx="14" fill="rgba(255,255,255,0.05)" />
    <text x="768" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#71717a" text-anchor="middle">TODAY</text>

    <!-- Trigger Comment Notification -->
    <g transform="translate(488, 268)">
      <rect x="0" y="0" width="560" height="46" rx="23" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <text x="280" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#a1a1aa" text-anchor="middle">Replied to your keyword: <tspan fill="#ec4899" font-weight="700">"REEL"</tspan></text>
    </g>

    <!-- Embedded Share Post / Reel Card -->
    <g transform="translate(468, 336)">
      <rect x="0" y="0" width="600" height="460" rx="26" fill="#202024" stroke="rgba(255,255,255,0.09)" stroke-width="1" />
      
      <!-- Post Thumbnail Header Image -->
      <g transform="translate(2, 2)">
        <rect x="0" y="0" width="596" height="260" rx="24" fill="url(#postThumbGradient)" />
        
        <!-- Mountain / Landscape Mock Artwork inside Thumbnail -->
        <path d="M0 200 L140 100 L260 170 L390 80 L520 180 L596 140 V260 H0 Z" fill="#4338ca" opacity="0.6" />
        <path d="M80 260 L240 160 L380 240 L480 170 L596 240 V260 H0 Z" fill="#6366f1" opacity="0.7" />
        
        <!-- Post Type Badge: REEL -->
        <rect x="20" y="20" width="76" height="28" rx="8" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <polygon points="34,28 34,40 44,34" fill="#ffffff" />
        <text x="52" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff">REEL</text>
        
        <!-- View count badge -->
        <rect x="500" y="20" width="76" height="28" rx="8" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <text x="538" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#e4e4e7" text-anchor="middle">👁️ 84.5K</text>
      </g>

      <!-- Post Card Details -->
      <text x="28" y="304" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="700" fill="#ffffff">Viral Reel Blueprint: 0 to 100k Followers</text>
      <text x="28" y="332" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">Here is the exact step-by-step breakdown you requested! 🚀</text>

      <!-- CTA Button 1: View Post -->
      <g transform="translate(28, 360)">
        <rect x="0" y="0" width="544" height="42" rx="12" fill="url(#btnGradientShare)" />
        <text x="272" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">🎬 Watch Full Reel on Instagram</text>
      </g>

      <!-- CTA Button 2: Download Free PDF -->
      <g transform="translate(28, 410)">
        <rect x="0" y="0" width="544" height="38" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <text x="272" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#e4e4e7" text-anchor="middle">📥 Download Free Guide PDF</text>
      </g>
    </g>

    <!-- Footer Input Bar -->
    <g transform="translate(408, 830)">
      <rect x="0" y="0" width="720" height="52" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <circle cx="28" cy="26" r="15" fill="#ec4899" />
      <text x="64" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#71717a">Message...</text>
      <circle cx="650" cy="26" r="12" fill="rgba(255,255,255,0.06)" />
      <circle cx="686" cy="26" r="12" fill="rgba(255,255,255,0.06)" />
    </g>
  </g>
</svg>
  `.trim();
}

// 3. Instagram Live Automation UI Card (1536x1024, Transparent RGBA)
// Showcases an active live stream broadcast with real-time comment trigger and automated DM notification banner
function createLiveAutomationSvg() {
  return `
<svg width="1536" height="1024" viewBox="0 0 1536 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadowLive" x="200" y="40" width="1136" height="944" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#ef4444" flood-opacity="0.15" />
    </filter>
    <linearGradient id="cardBgLive" x1="280" y1="90" x2="1256" y2="880" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="liveVideoGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="40%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="liveBadgeGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="100%" stop-color="#dc2626" />
    </linearGradient>
    <linearGradient id="bannerGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
  </defs>

  <!-- Ambient Glow Behind Device -->
  <circle cx="768" cy="500" r="320" fill="url(#liveBadgeGradient)" opacity="0.10" filter="blur(60px)" />

  <g filter="url(#shadowLive)">
    <!-- Device / Window Chassis -->
    <rect x="368" y="92" width="800" height="840" rx="36" fill="url(#cardBgLive)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" />
    
    <!-- Live Video Viewport -->
    <rect x="372" y="96" width="792" height="832" rx="32" fill="url(#liveVideoGradient)" />

    <!-- Top Live Stream Header -->
    <g transform="translate(408, 130)">
      <!-- Profile Avatar -->
      <circle cx="26" cy="26" r="24" fill="url(#bannerGlow)" />
      <circle cx="21" cy="22" r="4" fill="#ffffff" />
      <circle cx="31" cy="22" r="4" fill="#ffffff" />
      <path d="M22 31 Q26 35 30 31" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
      
      <text x="64" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#ffffff">CreatorLive</text>
      <text x="64" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="rgba(255,255,255,0.7)">Live Q&amp;A Session</text>

      <!-- LIVE Badge -->
      <rect x="540" y="12" width="72" height="28" rx="6" fill="url(#liveBadgeGradient)" />
      <text x="576" y="31" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">LIVE</text>

      <!-- Viewer Count Badge -->
      <rect x="622" y="12" width="88" height="28" rx="6" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      <text x="666" y="31" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">👁️ 3,420</text>
    </g>

    <!-- INCOMING AUTOMATION NOTIFICATION POPUP (The Automation Core Action) -->
    <g transform="translate(428, 204)">
      <rect x="0" y="0" width="680" height="84" rx="20" fill="rgba(24,24,27,0.92)" stroke="rgba(99,102,241,0.4)" stroke-width="1.5" />
      <circle cx="42" cy="42" r="22" fill="url(#bannerGlow)" />
      <!-- Paper Airplane Icon -->
      <path d="M34 42 L50 34 L44 50 L40 43 Z" fill="#ffffff" />
      
      <text x="80" y="36" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Instant DM Dispatched! ⚡</text>
      <text x="80" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="400" fill="#a1a1aa">Automated VIP link sent to <tspan fill="#818cf8" font-weight="600">@sarah_design</tspan> for comment "LINK"</text>

      <rect x="560" y="24" width="96" height="36" rx="10" fill="url(#bannerGlow)" />
      <text x="608" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">SENT</text>
    </g>

    <!-- Flowing Live Comments Stream -->
    <g transform="translate(418, 510)">
      <!-- Comment 1 -->
      <g transform="translate(0, 0)">
        <circle cx="20" cy="20" r="16" fill="#3b82f6" />
        <text x="48" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">alex_m</text>
        <text x="108" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="400" fill="#e4e4e7">This presentation is incredible! 🔥</text>
      </g>

      <!-- Comment 2: Trigger Keyword -->
      <g transform="translate(0, 50)">
        <circle cx="20" cy="20" r="16" fill="#ec4899" />
        <rect x="44" y="0" width="460" height="42" rx="12" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" stroke-width="1" />
        <text x="56" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">sarah_design</text>
        <text x="160" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#a5b4fc">LINK</text>
        <rect x="420" y="8" width="72" height="26" rx="6" fill="#10b981" />
        <text x="456" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">TRIGGER</text>
      </g>

      <!-- Comment 3 -->
      <g transform="translate(0, 110)">
        <circle cx="20" cy="20" r="16" fill="#f59e0b" />
        <text x="48" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">dev_rahul</text>
        <text x="130" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="400" fill="#e4e4e7">Need this automation for my shop!</text>
      </g>

      <!-- Comment 4 -->
      <g transform="translate(0, 160)">
        <circle cx="20" cy="20" r="16" fill="#10b981" />
        <text x="48" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">emma_style</text>
        <text x="142" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#a5b4fc">LINK please! 🙌</text>
      </g>
    </g>

    <!-- Floating Reaction Hearts on Right Side -->
    <g transform="translate(1080, 540)">
      <circle cx="24" cy="180" r="22" fill="#ef4444" opacity="0.9" />
      <path d="M16 178 Q24 170 32 178 Q24 190 24 190 Z" fill="#ffffff" />
      
      <circle cx="10" cy="110" r="18" fill="#ec4899" opacity="0.8" />
      <path d="M4 108 Q10 102 16 108 Q10 118 10 118 Z" fill="#ffffff" />

      <circle cx="34" cy="50" r="14" fill="#a855f7" opacity="0.7" />
    </g>

    <!-- Footer Comment Input -->
    <g transform="translate(408, 836)">
      <rect x="0" y="0" width="580" height="52" rx="26" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <text x="24" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="rgba(255,255,255,0.6)">Comment as dm_panda...</text>
      <circle cx="620" cy="26" r="22" fill="rgba(255,255,255,0.1)" />
      <circle cx="674" cy="26" r="22" fill="#ef4444" />
      <text x="674" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" fill="#ffffff" text-anchor="middle">❤️</text>
    </g>
  </g>
</svg>
  `.trim();
}

async function renderGraphics() {
  console.log('Rendering unified, professional vector UI graphics...');

  const graphics = [
    {
      name: 'welcome_message',
      svg: createWelcomeMessageSvg()
    },
    {
      name: 'share_template',
      svg: createShareTemplateSvg()
    },
    {
      name: 'live_automation',
      svg: createLiveAutomationSvg()
    }
  ];

  for (const item of graphics) {
    const pngPath = path.join(OUTPUT_DIR, `${item.name}.png`);
    const webpPath = path.join(OUTPUT_DIR, `${item.name}.webp`);

    console.log(`Rendering ${item.name}.png (1536x1024 RGBA)...`);
    await sharp(Buffer.from(item.svg))
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(pngPath);

    console.log(`Rendering ${item.name}.webp (WebP Q82)...`);
    await sharp(pngPath)
      .webp({ quality: 82, effort: 6 })
      .toFile(webpPath);

    const pngStat = fs.statSync(pngPath);
    const webpStat = fs.statSync(webpPath);
    console.log(`  ✓ ${item.name}.png: ${(pngStat.size / 1024).toFixed(0)}KB | ${item.name}.webp: ${(webpStat.size / 1024).toFixed(0)}KB`);
  }

  console.log('\nAll feature graphics rendered and optimized successfully!');
}

renderGraphics().catch(console.error);
