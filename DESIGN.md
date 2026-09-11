# Design System — Website Creation App

## Philosophy
Restrained, confident, high-craft. Generous whitespace. Strong hierarchy. One clear accent color. Feels expensive and intentional, never busy or generic. Prioritize clarity for creative work.

## Forbidden (Anti-Slop)
- Inter, Roboto, Open Sans, system-ui as primary fonts
- Purple-to-indigo or multi-color gradients
- Three identical feature cards in a row
- Heavy glassmorphism everywhere
- Centered everything by default
- Fake browser chrome / decorative emoji icons
- More than 2 font families

## Colors
- background: #0A0A0B (or soft off-white #FAFAF9 for light mode)
- surface: #141415 / #FFFFFF
- surface-elevated: slightly lighter/darker
- text-primary: near-white or near-black
- text-secondary: muted
- accent: one strong color (e.g. #3B82F6 or a custom warm/cool tone) — use ONLY for primary actions and key highlights
- border: subtle low-contrast
- success / warning / danger: restrained

## Typography
- Display / Headings: distinctive geometric or high-quality sans (or elegant serif for marketing pages) — e.g. Geist, Satoshi, or a carefully chosen pair
- Body: clean readable sans
- Scale (example): 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60
- Line heights: tighter for headings, 1.5–1.7 for body
- Max 2 families total

## Spacing
Base unit: 4px or 8px.  
All padding/margins/gaps must use the scale: 4, 8, 12, 16, 24, 32, 48, 64, 96…  
Start with too much whitespace and only tighten when necessary.

## Radii & Elevation
- Radii: 6px / 8px / 12px / 16px (consistent)
- Shadows: very subtle, layered elevation only where needed (cards, popovers, modals)
- Prefer borders + background contrast over heavy shadows

## Motion
- Micro: 120–180ms
- Standard: 250–350ms
- Easing: ease-out or custom cubic-bezier(0.16, 1, 0.3, 1)
- Prefer opacity + transform. Avoid bounce/overshoot unless deliberate.

## Components (high-level rules)
- Buttons: solid primary (accent), secondary (subtle), ghost. Clear hover/focus/active.
- Cards: clean, consistent padding, subtle border or elevation.
- Inputs: clear focus ring using accent, good contrast.
- Canvas/Editor: maximum focus on the content being created; chrome stays quiet.
- Template cards: strong thumbnail hierarchy, minimal text overlay.

## Layout Principles
- Clear visual hierarchy on every screen
- Consistent left/right margins and vertical rhythm
- Dashboard: scannable list or grid with breathing room
- Editor: toolbars and panels secondary to the canvas