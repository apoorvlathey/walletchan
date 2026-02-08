# BankrWallet Marketing Videos

Remotion-based video generation for BankrWallet promotional content.

This is a **standalone project** (not part of the pnpm workspace) to keep Remotion's heavy dependencies (Chromium, ffmpeg) isolated from the extension/website builds.

## Setup

```bash
cd marketing/video
pnpm install --ignore-workspace
```

> `--ignore-workspace` is required because this directory lives inside the monorepo but is intentionally excluded from `pnpm-workspace.yaml`. Without it, pnpm resolves to the workspace root and skips installing Remotion deps.

## Commands

```bash
# Open Remotion Studio (live preview at localhost:3000)
pnpm studio

# Render AIAgentsNeedWallets
pnpm render          # MP4
pnpm render:gif      # GIF

# Render V1Launch promo
pnpm render:v1       # MP4
pnpm render:v1:gif   # GIF
```

Output files go to `out/` (gitignored).

## Compositions

| ID | Description | Resolution | Duration |
|----|-------------|------------|----------|
| `AIAgentsNeedWallets` | Words pop in one by one with logo reveal | 1920x1080 | 5s @ 30fps |
| `V1Launch` | v1.0.0 launch promo — full feature showcase | 1080x1080 | 50s @ 30fps |

## V1Launch Scene Breakdown

| # | Scene | Frames | Time | Content |
|---|-------|--------|------|---------|
| 1 | Hook | 0-120 | 0-4s | "AI Agents Need Wallets" words pop in |
| 2 | Logo Reveal | 120-210 | 4-7s | BankrWallet icon + name + v1.0.0 badge |
| 3 | Agent Password | 210-330 | 7-11s | Mock UI: agent password card + permissions |
| 4 | Account Types | 330-450 | 11-15s | 3 account type cards (Bankr/PK/Seed) |
| 5 | Portfolio | 450-570 | 15-19s | Screenshot: portfolio + holdings view |
| 6 | Decoded TX | 570-720 | 19-24s | Screenshot: decoded transaction confirmation |
| 7 | Signatures | 720-840 | 24-28s | Screenshot: structured signature request |
| 8 | Transfers | 840-960 | 28-32s | Screenshot: token transfer + ENS badges |
| 9 | Montage | 960-1260 | 32-42s | Quick features: fullscreen, sidepanel, impersonate, multi-chain |
| 10 | CTA | 1260-1500 | 42-50s | v1.0.0 LIVE NOW + GitHub link |

**Notes:**
- Scenes 3-9 show a persistent BankrWallet watermark (bottom-right)
- Scenes 5-8 use actual extension screenshots (`public/*.png`)
- Scenes 3-4 use animated React mock UI components
- Audio: `8-bit-bg.mp3` at 50% volume, starts from frame 51 (skips silent intro)

## File Structure

```
src/
├── index.ts                          # Remotion entry point
├── Root.tsx                          # Composition registry
├── components/
│   ├── BankrLogo.tsx                 # Animated logo component
│   ├── FeatureLabel.tsx              # Scene title (top, red, uppercase)
│   ├── TextOverlay.tsx               # Caption overlay (TikTok-style centered)
│   └── SceneTransition.tsx           # Slide transition helper
├── compositions/
│   ├── AIAgentsNeedWallets/          # Original short video
│   └── V1Launch/
│       ├── index.tsx                 # Scene sequencer + audio + watermark
│       ├── scenes/                   # 10 scene components
│       └── ui-mocks/                 # React mock UI (agent password, accounts)
public/
├── bankrwallet-icon.png              # App icon
├── 8-bit-bg.mp3                      # Background music
├── Portfolio.png                     # Extension screenshot
├── TransactionRequest.png            # Extension screenshot
├── SignatureRequest.png              # Extension screenshot
└── TokenTransfer.png                 # Extension screenshot
```

## Design System

Matches the extension's Bauhaus design:
- **Font:** Outfit (via `@remotion/google-fonts`)
- **Colors:** Red `#D02020`, Blue `#1040C0`, Yellow `#F0C020`, Black `#121212`
- **Shadows:** Hard offset shadows (e.g. `8px 8px 0px 0px #121212`)
- **Borders:** Thick solid borders (`3px solid #121212`)
- **Animations:** Remotion `spring()` with various damping/stiffness configs
