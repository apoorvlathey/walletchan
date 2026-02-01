# BankrWallet Landing Page - Product Requirements Document

**Domain**: bankrwallet.app  
**Design System**: Bauhaus (see STYLING.md)  
**Status**: Planning

---

## Overview

A funky, bold landing page that showcases BankrWallet—the browser extension that brings your Bankr terminal wallet into any dapp. The website follows our Bauhaus design system with geometric shapes, primary colors (Red, Blue, Yellow), hard shadows, and constructivist typography.

**Vibe**: Retro-futuristic, Constructivist, Bold, Playful yet Professional, "Wallets should be fun"

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS (matching STYLING.md tokens)
- **Font**: Outfit (Google Fonts) - `Outfit:wght@400;500;700;900`
- **Icons**: Lucide React
- **Animations**: Framer Motion (for geometric compositions, scroll reveals)
- **Charts**: Lightweight Charts (TradingView) or Recharts for token price
- **Hosting**: Vercel

---

## Design Tokens (Reference)

```css
/* Colors */
--background: #f0f0f0;
--foreground: #121212;
--primary-red: #d02020;
--primary-blue: #1040c0;
--primary-yellow: #f0c020;
--border: #121212;
--muted: #e0e0e0;
```

---

## Page Sections

### 1. Navigation Bar

**Background**: Off-white (`#F0F0F0`)  
**Border**: `border-b-4 border-black`

**Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  [●▲■] BANKRWALLET          Features  Token  Install     [CTA] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

- **Logo**: Animated mascot GIF (`bankrwallet-animated.gif`) + "BANKRWALLET" text in uppercase, font-black
- **Nav Links**: Features | Token | Install | Tweets (uppercase, font-bold, tracking-wider)
- **CTA Button**: "Add to Chrome" - Red primary button with hard shadow

**Mobile**: Hamburger menu with slide-out drawer (black background, white text)

---

### 2. Hero Section

**Layout**: Split asymmetric layout (60/40 on desktop, stacked on mobile)  
**Left Side**: Off-white background  
**Right Side**: Blue (`#1040C0`) color block with geometric composition

```
┌─────────────────────────────────────────────────────────────────┐
│                                          │     ◯               │
│  PULL YOUR BANKR                         │       ▢             │
│  WALLET INTO                             │    △                │
│  ANY DAPP                                │                     │
│                                          │   [Mascot GIF       │
│  Like MetaMask, but powered by AI.       │    animated,        │
│  Transaction execution through the       │    breathing]       │
│  Bankr API. No seed phrases needed.      │                     │
│                                          │                     │
│  [ADD TO CHROME]  [VIEW ON GITHUB]       │                     │
│                                          │                     │
│  Works on: Chrome · Brave · Arc          │                     │
└─────────────────────────────────────────────────────────────────┘
```

**Typography**:

- Headline: `text-5xl sm:text-6xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9]`
- Subtext: `text-lg sm:text-xl font-medium text-gray-700 max-w-md`

**Buttons**:

- Primary: "Add to Chrome" (Red, shadow-[8px_8px_0px_0px_black])
- Secondary: "View on GitHub" (Outline, white bg)

**Geometric Composition (Right Panel)**:

- Large circle (Yellow, 40% opacity, top-right)
- Rotated square (Red, 30% opacity, bottom-left)
- Animated mascot centered with pulsing glow effect

**Animation**:

- Mascot "breathes" (subtle scale animation)
- Geometric shapes float/rotate slowly
- Text reveals on scroll (staggered)

---

### 3. Stats Bar

**Background**: Yellow (`#F0C020`)  
**Border**: `border-y-4 border-black`

```
┌─────────────────────────────────────────────────────────────────┐
│    ◯              │      ▢             │      △              │
│   4+              │     50+            │    100%             │
│  CHAINS           │   TRANSACTIONS     │  OPEN-SOURCE        │
│  SUPPORTED        │   PER DAY          │                     │
└─────────────────────────────────────────────────────────────────┘
```

**Layout**: 3-column grid with `divide-x-4 divide-black`

**Each Stat**:

- Geometric shape icon (circle/square/triangle) in alternating colors
- Large number: `text-4xl lg:text-6xl font-black`
- Label: `text-sm uppercase tracking-widest font-bold`

**Animation**: Numbers count up on scroll into view

---

### 4. Features Section

**Background**: Off-white (`#F0F0F0`)  
**Section Title**: "FEATURES" (Red text, geometric underline)

**Layout**: 3-column grid on desktop, 1-column on mobile

```
┌─────────────────────────────────────────────────────────────────┐
│                         FEATURES                                 │
│                         ─────────                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ◯            │  │ ▢            │  │ △            │          │
│  │              │  │              │  │              │          │
│  │ AI-POWERED   │  │ SIDE PANEL   │  │ MULTI-CHAIN  │          │
│  │ TRANSACTIONS │  │ MODE         │  │ SUPPORT      │          │
│  │              │  │              │  │              │          │
│  │ Execute via  │  │ Keep wallet  │  │ Base, ETH,   │          │
│  │ Bankr API    │  │ visible, no  │  │ Polygon,     │          │
│  │ prompts      │  │ popups!      │  │ Unichain     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PER-TAB      │  │ SECURE       │  │ EIP-6963     │          │
│  │ CHAINS       │  │ STORAGE      │  │ COMPATIBLE   │          │
│  │              │  │              │  │              │          │
│  │ Different    │  │ AES-256-GCM  │  │ Works with   │          │
│  │ chains in    │  │ encryption   │  │ all modern   │          │
│  │ diff tabs    │  │ for API key  │  │ dapps        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Feature Cards**:

- White background
- `border-4 border-black shadow-[8px_8px_0px_0px_black]`
- Small geometric shape decorator in top-right corner (8x8px)
- Icon in bordered box
- Title: uppercase, font-bold
- Description: font-medium, text-gray-700
- `hover:-translate-y-2 transition-transform duration-200`

**Features to Highlight**:

1. **AI-Powered Transactions** - Execute transactions through Bankr API prompts
2. **Side Panel Mode** - Keep wallet visible while browsing, no annoying popups
3. **Multi-Chain Support** - Base, Ethereum, Polygon, Unichain (show chain icons)
4. **Per-Tab Chain State** - Different chains in different browser tabs
5. **Secure Storage** - AES-256-GCM encryption with PBKDF2 (600k iterations)
6. **EIP-6963 Compatible** - Works alongside other wallets with modern dapp discovery
7. **Transaction History** - Track recent transactions with status updates
8. **Browser Notifications** - Get notified when transactions complete

---

### 5. $BNKRW Token Section

**Background**: Blue (`#1040C0`)  
**Text**: White

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     $BNKRW                                                      │
│     ───────                                                     │
│                                                                 │
│     THE COMMUNITY TOKEN                                         │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │                                                            ││
│  │                    [PRICE CHART]                           ││
│  │              (from GeckoTerminal API)                      ││
│  │                                                            ││
│  │    Current Price: $0.00042                                 ││
│  │    24h Change: +12.5%                                      ││
│  │    Market Cap: $420K                                       ││
│  │                                                            ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│     │ DEXSCREENER │  │ GECKOTERMINAL│  │ BUY ON BASE │         │
│     └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                 │
│     Contract: 0x... [Copy]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Chart Component**:

- Fetch data from GeckoTerminal API: `https://api.geckoterminal.com/api/v2/networks/base/pools/{pool_address}/ohlcv`
- Style: Yellow line on dark background
- Hard border: `border-4 border-black`
- Time range selector: 1H | 24H | 7D | 30D

**Token Stats Row**:

- Current Price (large, font-black)
- 24h Change (green/red based on direction)
- Market Cap

**Action Buttons**:

- DexScreener (Yellow button)
- GeckoTerminal (Yellow button)
- Buy on Base (Red button, primary CTA)

**Token Address**: Truncated with copy button

---

### 6. How It Works / Installation Guide

**Background**: Off-white (`#F0F0F0`)  
**Section Title**: "GET STARTED IN 60 SECONDS"

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│               GET STARTED IN 60 SECONDS                         │
│               ─────────────────────────                         │
│                                                                 │
│   ┌───┐         ┌───┐         ┌───┐         ┌───┐             │
│   │ 1 │─────────│ 2 │─────────│ 3 │─────────│ 4 │             │
│   └───┘         └───┘         └───┘         └───┘             │
│                                                                 │
│  DOWNLOAD      ENABLE DEV     LOAD THE      ENTER API          │
│  EXTENSION     MODE           EXTENSION     KEY                │
│                                                                 │
│  [Screenshot]  [Screenshot]   [Screenshot]  [Screenshot]       │
│                                                                 │
│  Get the       Toggle on      Click "Load   Get your key       │
│  latest        Developer      unpacked"     from bankr.bot     │
│  release       mode in        and select    and you're         │
│  from GitHub   extensions     the folder    ready!             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Step Cards Layout**: 4-column on desktop, 2x2 on tablet, stacked on mobile

**Step Numbers**:

- Geometric shapes (alternating circle/square)
- Rotated 45° with counter-rotated inner number
- Colors cycle: Red → Blue → Yellow → Red

**Connecting Line**: Dashed line between steps (hidden on mobile)

**Screenshots**:

- Use existing screenshots from `.github/usage/` and `.github/installation/`
- Screenshots have `border-4 border-black shadow-[8px_8px_0px_0px_black]`
- Grayscale by default, color on hover

**Steps**:

1. **Download** - Get the latest release from GitHub Releases
2. **Enable Developer Mode** - Toggle in chrome://extensions (show screenshot)
3. **Load Extension** - Click "Load unpacked" and select folder
4. **Enter API Key** - Get from bankr.bot/api, enter wallet address, create password

**CTA at bottom**: "Download Latest Release" (Red button linking to GitHub releases)

---

### 7. Screenshot Gallery / Product Showcase

**Background**: Red (`#D02020`)  
**Text**: White

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    SEE IT IN ACTION                             │
│                    ─────────────────                            │
│                                                                 │
│     ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│     │            │  │            │  │            │            │
│     │  Unlock    │  │  Homepage  │  │  Settings  │            │
│     │  Screen    │  │            │  │            │            │
│     │            │  │            │  │            │            │
│     └────────────┘  └────────────┘  └────────────┘            │
│                                                                 │
│                    ┌─────────────────────┐                     │
│                    │                     │                     │
│                    │   Transaction       │                     │
│                    │   Request           │                     │
│                    │                     │                     │
│                    └─────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Gallery Style**:

- Screenshots with thick black borders
- Hard shadows
- Slight rotation (-2° to 2°) for dynamic feel
- Hover: straighten + scale up slightly
- Mobile: horizontal scroll carousel

**Screenshots to Include**:

1. `password-page.png` - Unlock screen
2. `homepage-new.png` - Main wallet view
3. `settings.png` - Settings page
4. `tx-request.png` - Transaction confirmation (featured larger)

---

### 8. What People Are Saying (Tweet Grid)

**Background**: Off-white (`#F0F0F0`)  
**Section Title**: "WHAT PEOPLE ARE SAYING"

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│               WHAT PEOPLE ARE SAYING                            │
│               ──────────────────────                            │
│                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ @user1       │  │ @threadguy   │  │ @user3       │        │
│   │ This wallet  │  │ The design   │  │ Finally a    │        │
│   │ is fire 🔥   │  │ is sick!     │  │ good wallet  │        │
│   │              │  │              │  │              │        │
│   │ [♥ 42 🔁 12] │  │ [♥ 156 🔁 38]│  │ [♥ 89 🔁 21] │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ @bankrbot    │  │ @user5       │  │ @polygon     │        │
│   │ Reply tweet  │  │ Love the     │  │ Reply tweet  │        │
│   │              │  │ Bauhaus UI   │  │              │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│                    [SEE MORE ON X →]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tweet Card Design**:

- White background, `border-4 border-black`, `shadow-[4px_4px_0px_0px_black]`
- Profile picture: `rounded-full grayscale` (color on hover)
- Username: font-bold
- Tweet text: font-medium
- Engagement: likes/retweets with X (Twitter) icons
- Small geometric decorator in corner (cycling colors)
- Clicking opens tweet in new tab

**Layout**:

- Masonry-style grid (3 columns desktop, 2 tablet, 1 mobile)
- Staggered card heights based on content

**Data Source**:

- Curated list of tweet IDs
- Can use Twitter embed or custom styled cards
- Fallback: Screenshot images of tweets

**Notable Tweets to Include**:

- ThreadGuy's stream mention
- Bankrbot official replies
- Polygon reply
- BoredElonMusk engagement
- Community love for the design

---

### 9. Roadmap / Ship Log

**Background**: Yellow (`#F0C020`)  
**Text**: Black

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        SHIP LOG                                 │
│                        ────────                                 │
│                                                                 │
│   ┌─────┐                                                       │
│   │ ▣ ─┼──► v0.1.0 - Initial Release                           │
│   └─────┘   • Transaction execution                             │
│             • Multi-chain support                               │
│             • Side panel mode                                   │
│                                                                 │
│   ┌─────┐                                                       │
│   │ ○ ─┼──► v0.2.0 - Coming Soon                               │
│   └─────┘   • Token holdings view                               │
│             • Chat interface for Bankr prompts                  │
│             • Custom themes                                     │
│                                                                 │
│   ┌─────┐                                                       │
│   │ △ ─┼──► Future                                             │
│   └─────┘   • WalletConnect integration                         │
│             • Governance voting                                 │
│             • In-wallet swaps                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Timeline Style**:

- Vertical timeline with geometric markers
- Filled shapes = completed
- Outline shapes = upcoming
- Each version links to GitHub release

---

### 10. Community / Links Section

**Background**: Off-white (`#F0F0F0`)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    JOIN THE COMMUNITY                           │
│                    ─────────────────                            │
│                                                                 │
│        ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│        │    𝕏     │    │   ◆      │    │    ★     │           │
│        │ TWITTER  │    │ GITHUB   │    │ BANKR.BOT│           │
│        └──────────┘    └──────────┘    └──────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Social Cards**:

- Large icon buttons
- Hard shadows, thick borders
- Hover: lift effect + color change

**Links**:

- Twitter/X: @apoorveth
- GitHub: Repository link
- Bankr.bot: Get API key
- Discord: (if created)

---

### 11. Final CTA Section

**Background**: Blue (`#1040C0`)  
**Decorations**: Large geometric shapes at 30% opacity in corners

```
┌─────────────────────────────────────────────────────────────────┐
│  ◯                                                         △   │
│                                                                 │
│              READY TO MAKE WALLETS                             │
│              FUN AGAIN?                                        │
│                                                                 │
│              [ADD TO CHROME - IT'S FREE]                       │
│                                                                 │
│                      ▢                                    ◯    │
└─────────────────────────────────────────────────────────────────┘
```

**Typography**:

- Headline: `text-4xl sm:text-6xl lg:text-7xl font-black uppercase text-white`
- Tagline: "Make wallets fun again™"

**CTA Button**:

- Yellow background, black text
- Extra large: `px-12 py-6 text-2xl`
- `shadow-[8px_8px_0px_0px_black]`

---

### 12. Footer

**Background**: Near-black (`#121212`)  
**Text**: White/Gray

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [●▲■] BANKRWALLET                                             │
│                                                                 │
│  Pull your Bankr wallet out of the           Links:            │
│  terminal and into your browser.             • GitHub          │
│                                              • Twitter         │
│  Contract: 0x... [Copy]                      • Bankr.bot       │
│                                              • Privacy Policy  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Built by @apoorveth                      © 2025 BankrWallet   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements**:

- Logo + tagline
- Token contract address with copy
- Navigation links
- Social icons (X logo)
- Copyright
- "Built by @apoorveth" with link to X profile

---

## Interactive Elements & Animations

### Scroll Animations (Framer Motion)

- Sections fade in from bottom on scroll
- Stats count up when visible
- Cards stagger in
- Geometric shapes parallax effect

### Hover Effects

- Buttons: Press down effect (translate + shadow removal)
- Cards: Lift up (-translate-y-2)
- Images: Grayscale to color
- Links: Underline animation

### Micro-interactions

- Copy button: Checkmark animation on success
- Navigation: Active state indicator (geometric shape)
- Mobile menu: Slide-in with geometric pattern overlay

### Mascot Animation

- Subtle "breathing" effect (scale 1 → 1.02 → 1)
- Blinks occasionally
- Reacts to scroll position (looks in scroll direction)

---

## Responsive Breakpoints

| Breakpoint | Width      | Layout Changes                                      |
| ---------- | ---------- | --------------------------------------------------- |
| Mobile     | < 640px    | Single column, stacked sections, hamburger nav      |
| Tablet     | 640-1024px | 2-column grids, reduced type scale                  |
| Desktop    | > 1024px   | Full layouts, maximum type scale, side-by-side hero |

---

## SEO & Meta

```html
<title>BankrWallet - Pull Your Bankr Bot Into Any Dapp</title>
<meta
  name="description"
  content="Browser extension that brings your Bankr terminal wallet to any dapp. AI-powered transactions, multi-chain support, no seed phrases needed."
/>

<!-- Open Graph -->
<meta property="og:title" content="BankrWallet" />
<meta
  property="og:description"
  content="Pull your Bankr wallet into any dapp, like MetaMask!"
/>
<meta property="og:image" content="https://bankrwallet.app/og-image.png" />
<meta property="og:url" content="https://bankrwallet.app" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@apoorveth" />
<meta name="twitter:image" content="https://bankrwallet.app/twitter-card.png" />
```

---

## Assets Required

### Existing (from repo)

- `bankrwallet-animated.gif` - Animated mascot
- `bankrwallet-icon.png` - Static icon
- `.github/usage/*.png` - Extension screenshots
- `.github/installation/developer-mode.png` - Install screenshot
- `public/chainIcons/*.svg` - Chain logos

### To Create

- `og-image.png` - Open Graph image (1200x630)
- `twitter-card.png` - Twitter card image
- Hero illustration / geometric composition
- Favicon set
- Chain icons composite image

---

## API Integrations

### GeckoTerminal API

**Endpoint**: `https://api.geckoterminal.com/api/v2/`

```typescript
// Get pool OHLCV data
GET /networks/base/pools/{pool_address}/ohlcv/day?limit=30

// Get token info
GET /networks/base/tokens/{token_address}

// Response includes:
// - price_usd
// - price_change_percentage (24h)
// - market_cap_usd
// - volume_usd
```

**Update Frequency**: Refresh every 60 seconds or on user interaction

### Twitter/X Embeds

Option A: Use Twitter's oEmbed API for official embeds
Option B: Custom styled cards with curated tweet data (requires manual updates)

---

## Performance Targets

- **Lighthouse Score**: 90+ on all metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Core Web Vitals**: All green

### Optimizations

- Next.js Image optimization
- Font subsetting (Outfit weights: 400, 500, 700, 900 only)
- Lazy load below-fold sections
- Static generation where possible
- CDN for assets

---

## Development Phases

### Phase 1: Core Landing Page

- [ ] Project setup (Next.js, Tailwind, Framer Motion)
- [ ] Design tokens implementation
- [ ] Navigation + Footer
- [ ] Hero section with geometric composition
- [ ] Features grid
- [ ] Installation guide
- [ ] Final CTA

### Phase 2: Dynamic Content

- [ ] $BNKRW token section with live chart
- [ ] GeckoTerminal API integration
- [ ] Tweet grid section
- [ ] Screenshot gallery

### Phase 3: Polish

- [ ] Scroll animations
- [ ] Mascot micro-interactions
- [ ] Mobile optimization
- [ ] SEO + meta tags
- [ ] Performance optimization

### Phase 4: Launch

- [ ] Domain setup (bankrwallet.app)
- [ ] Vercel deployment
- [ ] Analytics integration
- [ ] Final QA

---

## File Structure

```
website/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── components/
│       ├── Navigation.tsx
│       ├── Hero.tsx
│       ├── StatsBar.tsx
│       ├── Features.tsx
│       ├── TokenSection.tsx
│       ├── InstallGuide.tsx
│       ├── Screenshots.tsx
│       ├── TweetGrid.tsx
│       ├── Roadmap.tsx
│       ├── Community.tsx
│       ├── FinalCTA.tsx
│       ├── Footer.tsx
│       └── ui/
│           ├── Button.tsx
│           ├── Card.tsx
│           ├── GeometricShape.tsx
│           └── PriceChart.tsx
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── lib/
│   ├── geckoterminal.ts
│   └── constants.ts
├── tailwind.config.ts
└── next.config.js
```

---

## Notes & Considerations

1. **Bauhaus Purity**: Every element must feel intentionally geometric. No soft shadows, no rounded corners (except perfect circles), no gradients.

2. **Color Discipline**: Stick to the 5-color palette. If more colors are needed, use opacity variations of primaries.

3. **Typography Contrast**: Headlines should feel MASSIVE compared to body text. This creates the poster-like feel.

4. **Hard Shadows Everywhere**: The 4px/8px offset shadows are non-negotiable. They create the constructivist depth.

5. **Playful but Professional**: The design should feel fun (it's a "wallets should be fun" brand) while still conveying technical competence.

6. **Mobile First**: Many users will visit from X/Twitter links on mobile. The experience must be excellent on small screens.

7. **Token Section Sensitivity**: Token price can be volatile. Consider showing chart with neutral framing, not "moon" language.

---

## References

- STYLING.md - Full Bauhaus design system
- README.md - Feature list and installation
- IMPLEMENTATION.md - Technical architecture
- TODO.md - Roadmap and marketing ideas
