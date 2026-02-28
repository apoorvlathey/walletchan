# WalletChan Rebrand Announcement Video — Script

**Format**: Twitter/X video
**Resolution**: 1080x1080 (square, optimal for Twitter feed)
**Duration**: ~40 seconds
**FPS**: 30
**Music**: 8-bit-bg.mp3 (same as V1 video, for brand continuity)

---

## Scene Breakdown

### Scene 1 — The Old Guard (0-3s, frames 0-90)

**Visual**: BankrWallet logo (silhouette/dark tint) centered on screen. Subtle geometric shapes in the background (Bauhaus circles, diamonds) in muted/desaturated colors.

**Text**: None initially. The logo sits still for a beat, then...

**Animation**: Logo begins to dissolve/shatter — particles drift away, or a glitch effect tears it apart. Screen goes momentarily dark.

**Audio**: Music fades in softly. A subtle "whoosh" or glitch sound on dissolve.

---

### Scene 2 — The Reveal (3-7s, frames 90-210)

**Visual**: From the darkness, the new WalletChan mascot/logo springs in with a bold entrance (spring animation, scaling from 0 to full size with overshoot). Geometric shapes return in full saturated Bauhaus colors (red, blue, yellow).

**Text**: **"WalletChan"** appears below the logo with a typewriter or stamp effect. A subtle glow or flash on arrival.

**Animation**: Logo lands with a satisfying bounce. Bauhaus shapes animate into position around it — circle slides in from right, diamond rotates in from left.

**Audio**: Upbeat 8-bit music kicks in fully. A satisfying "pop" or chime on logo landing.

---

### Scene 3 — The Promise (7-12s, frames 210-360)

**Visual**: Logo shrinks to top-left corner (watermark position). Center stage shows key messaging.

**Text sequence** (each line appears with a punchy animation):
1. **"New Name"** (white text)
2. **"Same Vision"** (yellow text, bold)
3. **"THE WALLET FOR AI ERA"** (red accent, mirroring homepage tagline)

**Animation**: Text lines slide/pop in one by one with 1-second intervals. Each line has a slight spring overshoot.

---

### Scene 4 — Feature Showcase (12-28s, frames 360-840)

**Visual**: Rapid-fire feature showcase, reiterating V1 capabilities so new viewers associate them with WalletChan. Uses the same Bauhaus card style as V1 — thick borders, hard shadows, primary colors.

**Section header** (12-13s, frames 360-390):
- **"Everything You Love. Now WalletChan."** pops in center, then clears.

**Feature cards** (each ~2s, slide in → hold → slide out):

1. **Agent Password** (13-15s, frames 390-450)
   - Mock UI card showing granular AI permissions (send tokens ✓, approve contracts ✗)
   - Label: **"Agent Password"**
   - Subtitle: "Let AI transact with guardrails"

2. **3 Account Types** (15-17s, frames 450-510)
   - Three cards side by side: Bankr API / Private Key / Seed Phrase
   - Label: **"Multi-Wallet"**
   - Subtitle: "Your keys, your way"

3. **Decoded Transactions** (17-19s, frames 510-570)
   - Screenshot or mock of human-readable tx confirmation (function name, params)
   - Label: **"Decoded Transactions"**
   - Subtitle: "Know what you're signing"

4. **Signature Requests** (19-21s, frames 570-630)
   - Mock of structured EIP-712 signature display
   - Label: **"Typed Signatures"**
   - Subtitle: "Human-readable signing"

5. **5 Chains** (21-23s, frames 630-690)
   - Chain icons pop in sequentially: Base, Ethereum, MegaETH, Polygon, Unichain
   - Label: **"5 Chains Supported"**
   - Subtitle: "Base · ETH · MegaETH · Polygon · Unichain"

6. **Sidepanel + Full-Screen** (23-25s, frames 690-750)
   - Split visual: left shows sidepanel docked to browser, right shows full-screen expand
   - Label: **"Sidepanel & Full-Screen"**
   - Subtitle: "For humans and AI agents"

7. **Impersonate Mode** (25-27s, frames 750-810)
   - Address input box with "View-Only" badge
   - Label: **"Impersonate Any Address"**
   - Subtitle: "View-only mode for any wallet"

8. **Portfolio & Transfers** (27-28s, frames 810-840)
   - Quick flash: portfolio view + token transfer with ENS badges
   - Label: **"Portfolio · Transfers · History"**

**Animation**: Each card slides in from right with spring animation, holds, slides out left. Fast but readable. Bauhaus geometric accents (circles, diamonds) punctuate transitions.

---

### Scene 5 — Token: Same Value, New Name (28-33s, frames 840-990)

**Visual**: $WCHAN token display. Split into two beats.

**Beat 1 — The Wrap** (28-30.5s, frames 840-915):
- **"$BNKRW → $WCHAN"** (with arrow animation, BNKRW morphs into WCHAN)
- **"1:1 Wrapper. Same Market Cap."**
- Emphasis: this isn't a new token launch — it's the same value, just wrapped

**Beat 2 — The Upgrade** (30.5-33s, frames 915-990):
- **"Stake $WCHAN"**
- **"Earn WETH + WCHAN Yield"**
- **"stake.walletchan.com"**

**Animation**: BNKRW text transforms/morphs into WCHAN. Then the staking yield text pops in with a subtle glow on "WETH + WCHAN".

---

### Scene 6 — Migrate CTA (33-36s, frames 990-1080)

**Visual**: Clean, focused call to action.

**Text**:
- **"Migrate Now"** (large, bold)
- **"migrate.walletchan.com"**

**Animation**: URL pulses gently. Simple and direct.

---

### Scene 7 — Closing (36-40s, frames 1080-1200)

**Visual**: WalletChan mascot centered, full size with floating animation. Bauhaus geometric shapes frame it.

**Text**:
- **"WalletChan"** (large)
- **"v2 Live on Chrome Web Store"** (smaller, below name)
- **"walletchan.com"** (bottom)

**Animation**: Everything settles into place. Mascot has subtle floating animation (like the homepage). Gentle hold to end.

**Audio**: Music fades out.

---

## Tone & Messaging Notes

- **Confident, not apologetic** — this is an evolution, not a pivot
- **Fast-paced** — Twitter attention spans are short. Every frame should earn its place
- **Trust signal** — "Same Vision" is the anchor phrase. The features section reinforces that nothing is lost
- **Bauhaus aesthetic throughout** — thick borders, hard shadows, primary colors, geometric shapes. Visual continuity with the existing brand

## Assets

| Asset | Status | Source |
|-------|--------|--------|
| Old BankrWallet logo (silhouette) | Ready | `packages/shared/assets/bankrwallet-icon.png` |
| WalletChan mascot (static) | Ready | `apps/website/public/images/walletchan-icon-nobg.png` |
| WalletChan mascot (animated) | Ready | `apps/website/public/images/walletchan-animated.gif` (has whitish bg — may need bg removal or compositing) |
| Chain icons (Base, ETH, etc.) | Ready | `packages/shared/assets/` |
| 8-bit background music | Ready | `marketing/video/public/8-bit-bg.mp3` |
| Dissolve/shatter SFX | Needed | Short glitch/whoosh sound |
| Pop/chime SFX | Needed | For logo reveal |

## Open Questions

1. **Animated mascot bg** — `walletchan-animated.gif` has a whitish background. Use static `walletchan-icon-nobg.png` for most scenes and animated gif only for closing (where we can composite over matching bg)? Or do we have a transparent version?
2. **Sound effects** — source from freesound.org or generate? Any preferences?
