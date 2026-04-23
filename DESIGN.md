---
name: Ming
description: Warm, organic family translator — terracotta accents, jade states, cream foundation.
colors:
  background: "#f5eee6"
  surface: "rgba(255, 250, 246, 0.52)"
  surface-strong: "rgba(255, 248, 241, 0.68)"
  ink: "#241615"
  muted: "#6a544d"
  line: "rgba(255, 255, 255, 0.38)"
  primary: "#d95d39"
  primary-deep: "#a43d28"
  secondary: "#f1b858"
  secondary-deep: "#7a5200"
  tertiary: "#4c8c78"
  tertiary-deep: "#1e5847"
  error: "#8c2d1d"
typography:
  h1:
    fontFamily: Sora
    fontSize: 2.1rem
    fontWeight: 400
    lineHeight: 1
  h2:
    fontFamily: Sora
    fontSize: 2.5rem
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -0.03em
  body-md:
    fontFamily: Sora
    fontSize: 1.05rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Sora
    fontSize: 0.78rem
    fontWeight: 700
    letterSpacing: 0.08em
rounded:
  sm: 1.5rem
  md: 2rem
  pill: 999px
spacing:
  xs: 0.4rem
  sm: 0.8rem
  md: 1.2rem
  lg: 2rem
elevation:
  shadow: "0 8px 32px rgba(48, 23, 15, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.55)"
  blur: "blur(28px) saturate(160%)"
components:
  button-record:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: 999px
    size: 8rem
  button-record-active:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: 999px
    size: 8rem
  button-pill:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: 0.75rem 1.6rem
  button-pill-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 1.2rem
  status-recording:
    backgroundColor: "#fde8e1"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.pill}"
    padding: 0.35rem 0.7rem
  status-processing:
    backgroundColor: "#fdf3dc"
    textColor: "{colors.secondary-deep}"
    rounded: "{rounded.pill}"
    padding: 0.35rem 0.7rem
  status-ready:
    backgroundColor: "#ddf0ea"
    textColor: "{colors.tertiary-deep}"
    rounded: "{rounded.pill}"
    padding: 0.35rem 0.7rem
  status-error:
    backgroundColor: "#f7ddd9"
    textColor: "{colors.error}"
    rounded: "{rounded.pill}"
    padding: 0.35rem 0.7rem
---

## Overview

Warmth-first, distraction-free family translator. The UI evokes a handwritten letter on cream paper — soft light, terracotta ink, jade flourishes. Nothing competes for attention with the voice button at the center.

The palette is rooted in warm neutrals with a single dominant accent (terracotta) and two supporting tones (gold for processing, jade for success). Glassmorphism surfaces and floating orbs add subtle depth without heaviness.

## Colors

- **background (#f5eee6):** Warm cream — the paper. Every surface reads against this.
- **surface (rgba 52%):** Semi-transparent warm white. Cards, panels, topbar — always layered over the mesh background via glassmorphism.
- **surface-strong (rgba 68%):** Slightly more opaque variant for active/selected segments and inner containers.
- **ink (#241615):** Deep brown-black for all primary text. Not pure black — stays warm.
- **muted (#6a544d):** Warm mid-brown for secondary text, captions, metadata.
- **line (rgba white 38%):** White at low opacity. Gives glass surfaces a bright top-edge highlight rather than a warm border.
- **primary (#d95d39):** Terracotta. The sole interaction color — record button, CTAs, active states.
- **primary-deep (#a43d28):** Darker terracotta for pressed/hover states and error-adjacent status text.
- **secondary (#f1b858):** Warm gold for the "processing" state only. Never used for interaction.
- **secondary-deep (#7a5200):** Gold text on gold backgrounds. Darkened for WCAG AA contrast.
- **tertiary (#4c8c78):** Jade green for "ready / success" state only. Calm, resolved.
- **tertiary-deep (#1e5847):** Jade text on jade backgrounds.
- **error (#8c2d1d):** Deep terracotta-red for error state text. Distinct from primary.

## Typography

Sora is the sole typeface — modern, humanist, legible at every size. Fallback stack: `"Avenir Next", "Segoe UI", sans-serif`.

- **h1** is the panel headline (language label): large, light-weight (400), tight leading.
- **h2** is the translated text inside split panes: slightly larger, condensed letter-spacing (-0.03em), almost compressed.
- **body-md** is transcript text, instructions, and all prose.
- **label** is the eyebrow tag above panels and status pills: small caps, wide tracking (0.08em), bold.

Font sizes scale responsively with `clamp()` in implementation — token values represent desktop maximums.

## Layout

Single-column, centered, max-width ~28rem on mobile and ~38rem on tablet+.

Vertical rhythm: `spacing.xs` (0.4rem) between tight elements, `spacing.sm` (0.8rem) for component gaps, `spacing.md` (1.2rem) for card padding, `spacing.lg` (2rem) for section separation.

Two layout modes:
- **Walkie mode**: Single hero card with centered record button. One active panel below.
- **Split mode**: Two mirrored panes stacked vertically; bottom pane rotates 180° for face-to-face use.

## Elevation & Depth

All elevation uses a single warm compound shadow: `0 8px 32px rgba(48, 23, 15, 0.1)` plus an inset highlight `inset 0 1px 0 rgba(255, 255, 255, 0.55)`.

Surfaces use `backdrop-filter: blur(28px) saturate(160%)` (glassmorphism) rather than opaque fills. Three floating orbs in the background give the canvas soft ambient color:
- **Orb A** (26rem, top-left): terracotta → gold gradient.
- **Orb B** (28rem, bottom-right): jade.
- **Orb C** (20rem, center): warm amber gold.

No hard shadows. No dark overlays. Depth comes from blur and inset highlights, not darkness.

## Shapes

- **Cards and panes**: `rounded.md` (2rem) — generous, friendly, thumb-safe.
- **Topbar**: `rounded.sm` (1.5rem) — slightly tighter, more structural.
- **All interactive pills**: `rounded.pill` (999px) — fully rounded. Record button, status badges, segmented controls, mode toggles.

Never use sharp corners (0px). The minimum border-radius for any interactive element is `rounded.sm`.

## Components

### button-record
The primary action. 8rem circle, terracotta gradient fill, white icon. Emits a permanent low-opacity halo (`idlePulse` at 4s) at rest. Pulses with a heartbeat animation (1.4s) while recording, surrounded by two expanding `ringPulse` rings (2.2s). Pressed state uses `button-record-active` (primary-deep background).

### button-pill
Secondary actions, direction toggles, mode switches. Fully rounded, terracotta fill, white text. Hover/active darkens to primary-deep. Padding: 0.75rem vertical, 1.6rem horizontal.

### card
The container for transcription + translation output. Glassmorphism surface (`surface` token + `blur` elevation). Border: `1px solid line` (white highlight). Bottom-border receives a tinted accent (terracotta for ES output, gold for ZH output) to signal direction at a glance.

### status-*
Four contextual states rendered as small inline pills. Each uses a tinted background and matching deep text color:
- `status-recording` — faint terracotta (recording in progress)
- `status-processing` — faint gold (translating, synthesizing)
- `status-ready` — faint jade (response ready, audio playable)
- `status-error` — faint error-red (failure, retry available)

Status pills always use `label` typography with `rounded.pill` shape.

## Animations

All transforms use a spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`.

- **idlePulse** (4s, infinite): faint terracotta halo rings expanding from the record button at rest.
- **heartbeat** (1.4s, infinite): scale 1 → 1.06 → 1 during active recording.
- **ringPulse** (2.2s, infinite): two concentric rings expanding and fading during recording.
- **cardReveal**: card entrance — scale 0.97 + translateY(10px) → natural, opacity 0 → 1.
- **riseIn**: panel entrance — scale 0.98 + translateY(20px) → natural, opacity 0 → 1.

Respect `prefers-reduced-motion: reduce` — strip all keyframe animations, retain only opacity transitions.

## Do's and Don'ts

**Do:**
- Use `primary` exclusively for interactive affordances (record, play, tap actions).
- Use `secondary` and `tertiary` exclusively for status communication — never for decorative or structural elements.
- Apply `backdrop-filter: blur(28px) saturate(160%)` to all floating surfaces (cards, topbar).
- Use white-rgba for `line` — it reads as a glass highlight, not a divider.
- Use `clamp()` for all font sizes to maintain readability from 320px to 1440px without breakpoint hacks.

**Don't:**
- Don't use pure black (`#000000`) or pure white (`#ffffff`) as backgrounds. Always use the warm-tinted tokens.
- Don't introduce a fourth accent color. The palette is intentionally constrained to terracotta / gold / jade.
- Don't add box-shadows with cool (blue/grey) tones. All shadows use warm brown-red bases.
- Don't use font-weight 300 or lighter. The minimum readable weight on these cream backgrounds is 400.
- Don't use hard borders (`2px+`) — prefer `1px solid line` or no border with shadow.
- Don't use solid opaque backgrounds for cards — always layer over the mesh with glassmorphism.
