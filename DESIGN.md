---
name: Glider
description: A quiet control room for your voice shortcuts; dictate, listen and rewrite, all on your own computer.
colors:
  logo-primary: "#c58af2"
  logo-primary-light: "#d8b4f8"
  wing-from: "#e4a6e9"
  wing-to: "#b56ff0"
  wing-from-light: "#e2b8f2"
  wing-to-light: "#bb8cf5"
  voice-speak: "#b56ff0"
  voice-listen: "#e4a6e9"
  voice-speak-light: "#9d62e2"
  voice-listen-light: "#e3a8ec"
  accent-ink: "#d4a3f7"
  accent-ink-light: "#8442c4"
  on-accent: "#1e0b2b"
  tagline: "#bf9ff0"
  tagline-light: "#7a4cc0"
  ground: "#141112"
  background: "#1b1718"
  card: "#221d1f"
  raised: "#2e282a"
  text: "#f3eeef"
  ink-2: "#f3eeefa3"
  ink-3: "#9a9395"
  line-strong: "#f3eeef38"
  line: "#f3eeef17"
  wash: "#f3eeef0d"
  ground-light: "#ebe7e6"
  background-light: "#f8f6f5"
  card-light: "#fdfbfa"
  raised-light: "#e1dbd9"
  text-light: "#1a1617"
  ink-2-light: "#1a1617a3"
  ink-3-light: "#6b6567"
  line-strong-light: "#1a161738"
  line-light: "#1a161717"
  wash-light: "#1a16170d"
  plum-light: "#382731"
  moss: "#86c9a4"
  moss-light: "#2f7d5b"
  warning: "#fbbf24"
  warning-light: "#b45309"
  error: "#f87171"
  error-light: "#dc2626"
typography:
  display:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  onboarding-title:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.3
  card-title:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.2
  numeral:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  title-italic:
    fontFamily: "Brygada 1918, ui-serif, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.3
  lockup:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
  tagline:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  row-title:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  description:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI Variable Text, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  keycap:
    fontFamily: "ui-rounded, SF Pro Rounded, system-ui, -apple-system, Segoe UI Variable Display, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1
rounded:
  splash: "24px"
  feature-card: "22px"
  window-panel: "20px"
  overlay-panel: "20px"
  group: "16px"
  nav: "12px"
  control: "10px"
  option: "8px"
  keycap-sm: "7px"
  grade: "6px"
  heat-cell: "3px"
  pill: "9999px"
spacing:
  panel-inset: "8px"
  page-gutter: "24px"
  page-gutter-wide: "40px"
  page-top: "36px"
  page-gap: "28px"
  row-x: "20px"
  row-y: "14px"
  list-x: "24px"
  list-y: "16px"
  card: "28px"
  onboarding-gutter: "28px"
  keycap-gap: "4px"
components:
  button-primary:
    backgroundColor: "{colors.logo-primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "36px"
  button-ghost:
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
  button-danger:
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "36px"
  button-disabled:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    height: "36px"
  icon-button:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.option}"
    size: "32px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  dropdown-trigger:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 12px"
    height: "36px"
    width: "200px"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.nav}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  settings-group:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.group}"
  setting-row:
    padding: "14px 20px"
    height: "64px"
  feature-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.feature-card}"
    padding: "{spacing.card}"
  insight-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.group}"
    padding: "22px 24px"
  rewrite-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.group}"
    padding: "18px 20px"
  tabs:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.nav}"
    padding: "4px"
  tab-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.option}"
    height: "32px"
  chip:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  badge:
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  grade:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.text}"
    rounded: "{rounded.grade}"
    width: "28px"
    height: "24px"
  keycap-hero:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.keycap}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "42px"
  keycap-sm:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.keycap-sm}"
    padding: "0 9px"
    height: "30px"
  keycap-live:
    backgroundColor: "{colors.logo-primary}"
    textColor: "{colors.on-accent}"
  overlay-pill:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 6px 0 14px"
    height: "40px"
  overlay-panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.overlay-panel}"
    padding: "12px 12px 14px 16px"
    width: "392px"
  splash:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.splash}"
    width: "560px"
    height: "400px"
---

# Design System: Glider

## Overview

**Creative North Star: "The Quiet Control Room for Your Shortcuts"**

Glider lives in its shortcuts: hold one to dictate, press one to listen, press another to rewrite what you selected. The main window is opened occasionally, to set those keys, fetch models and voices, see how you have been using them and look back at today. The system serves that visit and gets out of the way. A warm plum-black ground holds one inset rounded panel. Every page inside it is a short, plain form: a serif page title, an optional one-line lede, then cards of rows that say what they do. The shortcuts, drawn as physical keycaps set into serif sentences, are the centrepiece of Home, Rewrite and onboarding, and they are the only ornament anywhere.

The brand comes from the app icon: two wing blades, lilac over violet, on a dark glass tile. The wing mark beside a plain "Glider" in the system face is the lockup at the top of the sidebar. The blades' lilac-to-violet gradient becomes the accent that fills primary buttons, switches, live keycaps and progress. Lilac stays scarce. It marks selection, the primary action and whatever is happening right now.

Outside the window, Glider is one small floating pill near the bottom of the screen, over whatever app the user is in (a terminal, a browser, a chat app). It says what is happening (listening, transcribing, reading aloud, refining), grows into a small panel only when there is something to read or copy, and leaves when it is done. Density everywhere is low and calm. The system rejects grey grouped lists with uppercase captions, and it does not copy the user's pinned reference layout. Reference renders of every screen live in `ui/` at the repo root, dark theme on the left and light on the right.

**Key Characteristics:**
- Ground, panel, card and raised are four warm plum-black steps (light: four warm paper greys), separated by hairlines rather than shadows.
- Brygada 1918 for titles, sentences, numerals and italic headers; system UI for every control and for the "Glider" lockup.
- Keycaps with a 3px lower bevel are the signature, and the only ornament.
- Lilac is reserved for selection, primary action, focus and live state. Solid accent fills paint the 135° wing gradient.
- Rows follow "title + description | control"; lists follow "time | text | action".
- Outside the window, Glider is a floating pill or panel, never a second window.
- State changes take 150-200ms and touch only color, border and transform.

## Colors

A warm, low-chroma plum-black (or warm paper) neutral family, one lilac voice taken from the app icon, and three status hues. Dark is the hero theme. Light mirrors every role. Each themed value is defined once as a light/dark pair in `src/styles/theme.css`, then follows the OS or a forced `data-theme`.

### Primary
- **Wing Lilac** (logo-primary; light: logo-primary-light): the flat accent. It fills the slider track to its value, the live bars, the spinner arc, the selected radio ring and the History play button. It is the base of every accent tint (badges 18%, selected chips 16% with a 45% edge, the menu bar icon's live tint 24%) and of the streak heatmap. It is also the 2px focus ring and the 40% `::selection` wash. Never a large surface.
- **Wing Gradient** (wing-from to wing-to at 135°; light: wing-from-light to wing-to-light): the same lilac-to-violet as the icon's blades. It fills the primary button, the switch when on, the live keycap, progress bars, the Read Aloud panel's current segment, the current onboarding step and the overlay's play/pause button.
- **Lilac Ink** (accent-ink; light: accent-ink-light): lilac as text or icon on a neutral ground. Examples are the active nav icon, badge text, a selected chip's icon and a starred icon button. Light theme deepens it to violet to clear 4.5:1 on paper.
- **Violet-Black Ink** (on-accent): text and icons on any lilac fill, in both themes.
- **Tagline Lilac** (tagline; light: tagline-light): the brand line "Speak. Glide. Create." on the loading screen. Nowhere else.

### Neutral
- **Ground** (ground): the window and sidebar, the deepest layer. Also fills inputs, textareas, the Tabs track and the History player, which read as wells cut into the panel.
- **Panel** (background): the inset rounded content panel, the face of resting keycaps, the overlay pill and panels, and the loading screen.
- **Card** (card): settings groups, Home and Insights cards, rewrite cards, list containers, dropdown triggers and menus.
- **Raised** (raised): secondary buttons, the active nav item, the active tab, permission icon tiles and app initial tiles.
- **Text** (text): primary ink.
- **Ink 2** (ink-2, text at 64%): descriptions, hints, secondary labels, inactive nav labels, footer text.
- **Ink 3** (ink-3): timestamps, meta, column headers, group descriptions, tooltip icons. It is themed separately so it clears 4.5:1 on both grounds.
- **Line Strong** (line-strong, text at 22%): control edges (inputs, dropdowns, the overlay's edge), the switch track when off, the dashed "new rewrite" card.
- **Line** (line, text at 9%): every hairline (panel edge, card edge, row dividers, sidebar rule, footer rule).
- **Wash** (wash, text at 5%): hover fill for nav items, ghost buttons, icon buttons and menu options; the fill of chips, grades and empty heatmap cells.
- **Plum** (plum-light; dark resolves to text): keycap edge, legend and bevel, and the tooltip fill.

### Status
- **Moss** (moss / moss-light): success: "Allowed", "Done", "Copied", "Saved", the ready dot beside the model in the footer, and added words in a rewrite diff. It gets its own hue because lilac already means "live".
- **Amber** (warning / warning-light) and **Coral** (error / error-light): warnings, errors, danger buttons, and deleted words in a rewrite diff. A notice is the status color at 10% over the panel with a 30% edge.

### Named Rules
**The Lilac Means Now Rule.** Lilac marks only three things: what is selected, what the primary action is, and what is happening right now (a live shortcut, focus, progress, today). If an element is none of these, it is neutral.

**The Wing Gradient Rule.** Solid accent fills paint the 135° wing gradient. Tints, strokes, text, live bars and dots stay flat lilac. The gradient never goes on text, borders or surfaces.

**The Two Voices Rule.** Insights charts speak in the wing's two colors: speaking is Voice Violet (voice-speak) and listening is Voice Pink (voice-listen), on one shared scale. Capsule bars (the rewrite mix and app shares) fill with the bar gradient, the wing's lilac-to-violet run left to right. A lilac ring still marks today, and the streak heatmap keeps its four lilac steps. No other hue enters a chart.

**The One Hex Rule.** A hex lives once, as a light/dark pair in `theme.css`. Greys are `color-mix` steps of text, never new hex values. The wing mark's blade gradients live only in `GliderMark.tsx` and `src-tauri/icons/logo.svg`.

## Typography

**Display Font:** Brygada 1918 (self-hosted variable, regular and italic, 400-700), falling back to ui-serif, Georgia
**Body Font:** system UI (system-ui, -apple-system, Segoe UI Variable Text, Roboto, Noto Sans)
**Keycap Legend Font:** ui-rounded / SF Pro Rounded at 600, used only for key legends, grade letters, the speed readout and app initials
**Mono:** ui-monospace / SF Mono, only for paths, logs and raw values on Debug and Advanced

**Character:** A bookish, slightly old-press serif speaks the headlines and the numbers. The platform's own sans does all the work, and it also sets the brand name, so "Glider" reads like part of the operating system. The serif is never used on a control.

### Hierarchy
- **Display** (Brygada 400, 40px, 1.05, -0.01em): page titles, one per page, top-left. Home's "Welcome back, <name>" uses the same style.
- **Onboarding Title** (Brygada 400, 34px, 1.15, -0.01em): the one title on each onboarding step.
- **Headline** (Brygada 400, 30px, 1.3; 26px below a 640px container): the hero shortcut sentences, with hero keycaps set inline. Rewrite's hero uses 28px.
- **Card Title** (Brygada 400, 24px, 1.2): titles inside Insights cards ("Where you talk", "6 day streak").
- **Numeral** (Brygada 400, 40px, 1, tabular; 36px in Insights cards; 28px below a 720px container): stat figures.
- **Title Italic** (Brygada italic 19px): list headers such as "Today" and "Your rewrites". History day headers use 17px italic in ink-2.
- **Lockup** (system 500, 26px, -0.02em): "Glider" beside the wing mark in the sidebar. 24px on the first onboarding step, 40px (-0.025em) on the loading screen.
- **Tagline** (system 400, 15px, 0.04em, tagline lilac): "Speak. Glide. Create." on the loading screen only.
- **Title** (system 600, 15px): settings group titles and rewrite card titles, sentence case.
- **Row Title** (system 500, 15px): the left-hand title of a setting row, model names.
- **Body** (system 400, 15px, 1.6): dictated or read text in lists, clamped to 2 lines; the lede under a page title (ink-2, 60ch).
- **Description** (system 400, 13px, 1.4, ink-2 or ink-3): row and group descriptions, hints, timestamps (tabular).
- **Label** (system 12px, ink-3): sidebar version line, footer, column headers, overlay captions.

### Named Rules
**The Serif Speaks Rarely Rule.** Brygada is used for page and onboarding titles, hero sentences, card titles, numerals, and italic list and day headers. Anything clickable, and the brand name itself, is set in system UI.

**The Sentence Case Rule.** Headers and group titles are sentence case with no added tracking. Uppercase tracked captions are not part of this system. The tagline's 0.04em is the one tracked line, and it is still sentence case.

## Layout

The window is a full-height `ground` with a fixed 212px sidebar on the left. The content area is one inset panel (8px from the window's top, right and bottom edges, 20px radius, hairline edge) that scrolls internally above a footer bar. Inside the panel, the page column is centred and caps at 860px. It has a 24px side gutter (40px once the panel container is 640px or wider), 36px top padding, 40px bottom padding and a 28px gap between page blocks. Responsiveness uses container queries on the panel, not viewport media queries.

- **Sidebar:** the lockup (wing mark + "Glider"), then the main group (Home, Insights, General, Read Aloud, Rewrite, History, Models), a flexible spacer, a hairline, the lower group (Advanced, Debug when enabled, About), and "Glider v<version>" beneath.
- **Page head:** the Display title on the left. When a page has one page-level control it sits on the right of the same line: Tabs on History and Insights, the On switch on Rewrite. A lede (15px ink-2) may follow, pulled 16px closer to the title.
- **Footer bar:** a hairline above, 12px ink-2 text, 9px x 16px padding. On the left, the speech model picker (moss dot when ready) and the voice picker. On the right, a lock icon and "Runs on this computer".
- **Home:** one column below a 720px container. At 720px and up, the hero card (fluid) sits beside a 236px stats card. Below them, the "Today" list.
- **Insights:** one screen. A serif summary sentence under the title; then Activity (1.85fr) beside the streak (1fr); then one card split into Dictation | Read Aloud | Rewrite (3fr) beside a separate "Where you talk" card (1fr). Each pair sits side by side from a 900px container and stacks below it; the three columns stack below 720px. 16px gaps.
- **Rewrite:** the hero card (sentence and actions, fluid, beside a 236px before/after demo), the "After you dictate" group, then "Your rewrites" as a three-column grid of cards (12px gaps). A rewrite's detail page has a back link, then a 250px left column (what it does and an example) and a fluid right column of settings groups, 32px apart.
- **Settings pages:** a vertical stack of groups (title + description over a card of divided rows, 12px between header and card).
- **Models:** a toolbar row (Tabs for Speech to text | Text to speech | Rewriting, a search field, a refresh icon button), then groups ("On this computer", "For your languages"), each with a column-header line (Model, English, Hindi, Speed, Size) above its card.
- **Lists:** a three-column grid (76px time | fluid text | actions), with 16px gaps and 24px x 16px row padding.
- **Onboarding:** a 720 x 600 window with no sidebar, in three rows: a 48px top bar (step dashes), the body (28px gutter, 24px gaps), and a 76px footer under a hairline (Back on the left, a hint in the middle, Continue on the right).
- **Overlay:** centred horizontally, about 22px above the bottom of the screen, above every app.
- **Loading screen:** the window's ground with only the wing mark, centred.

## Elevation & Depth

The system is flat and tonal. Depth comes from four warm surface steps (ground, panel, card, raised) and 9% hairlines, not from shadows. A surface sits in front because it is a step lighter (dark theme) or brighter (light theme) and edged by a line. Shadow appears only where something physically sits above the page or above other apps.

### Shadow Vocabulary
- **Keycap bevel** (`box-shadow: 0 3px 0 0 var(--color-plum)`): the lower edge of a resting key; 2px on line-size keys. Live and capturing keys drop 3px and lose it.
- **Keycap lift** (`box-shadow: 0 5px 0 0 var(--color-plum)` with `translateY(-2px)`): keys inside a hovered or focused shortcut control.
- **Overlay float** (dark `0 16px 40px -14px rgba(0,0,0,0.7)`; light `0 16px 40px -16px rgba(56,39,49,0.4)`): the overlay pill and panels over other apps.
- **Menu float** (`box-shadow: 0 12px 32px -12px rgba(0,0,0,0.5)`): open dropdown menus only.
- **Tab seat** (`box-shadow: 0 1px 2px rgba(0,0,0,0.25)`): the active segment of Tabs.
- **Knob** (`box-shadow: 0 1px 2px rgba(0,0,0,0.3)`): the white knob of a switch and the slider thumb.
- **Mark glow** (`filter: drop-shadow(0 10px 18px rgba(120,60,200,0.35))` over a soft radial lilac glow): the wing mark on the loading screen only.

### Named Rules
**The One Ornament Rule.** The keycap bevel is the only hard-offset shadow, and it belongs only to keycaps. A keycap is a key, so the bevel is its material, not decoration. No other element borrows it.

**The Only What Floats Rule.** Soft shadows belong to things that float: the overlay over other apps, open menus, and the loading screen's mark. Cards and panels inside the window never get one.

## Shapes

Corners are soft and nest outward: grade 6px, menu options, tab segments and icon buttons 8px, controls 10px, nav items, Tabs tracks, notices and the History player 12px, group cards, Insights cards and rewrite cards 16px, the window panel and overlay panels 20px, Home and Rewrite hero cards 22px, the loading screen 24px. Keycaps scale their radius with size (hero 10px, sm 7px, line 6px). Switches, slider tracks, chips, badges, live bars, progress bars, the overlay pill, round player buttons and scrollbar thumbs are full pills or circles. Heatmap cells are 3px squares. Every container has a 1px hairline (line). Control edges use line-strong. A dashed edge means "not yet": a shortcut being captured, a grade that does not apply, or the card that adds a new rewrite.

## Components

### Buttons
Quiet, compact, never shouting.
- **Shape:** gently rounded (10px). Heights are sm 32px, md 36px, lg 40px, with 12/16/20px padding and 13/14/15px medium text. A 16px icon may lead (Download and use, New rewrite) or an arrow may trail (Continue).
- **Primary:** the wing gradient with violet-black text. One main action per view (Continue, Copy, Read). Hover brightens it 5%.
- **Secondary:** raised fill, line edge, text ink. Hover strengthens the edge to line-strong. This is the default ("Change shortcuts", "Use", "Download and use", "Try it").
- **Ghost:** no fill; wash on hover. For toolbars and quiet actions ("Back", "Reset to defaults").
- **Danger:** coral text, coral 12% wash on hover. **Done:** moss 16% fill with moss text, shown after a successful action ("Copied").
- **Disabled:** wash fill, line edge, ink-3 text.
- **Icon button:** 32px square, 8px radius, ink-2 icon at 16px; wash and text ink on hover; Lilac Ink when on (starred).
- **Focus:** the global 2px lilac outline at 2px offset.

### Chips, Badges and Grades
- **Chip:** 28px pill, wash fill, line edge, 13px text, optional 14px icon. Selected: lilac 16% fill, 45% lilac edge, check icon in Lilac Ink. Used for picking languages and what a rewrite does.
- **Badge:** 22px pill, 12px medium. Accent ("In use", "New"): lilac 18% with Lilac Ink. Moss ("Allowed", "Done"). Plain ("Live preview"): wash with ink-2.
- **Grade:** 28 x 24, 6px radius, wash fill, line edge, a rounded 600 letter (A, B, C). A grade that does not apply is a dashed edge with a dash in ink-3.

### Cards / Containers
- **Settings group:** sentence-case semibold title and a 13px ink-3 description above a card (16px radius, line edge) whose rows are divided by line.
- **Feature card (Home, Rewrite hero):** 22px radius, card fill, line edge, 28px padding. No shadow.
- **Insight card:** 16px radius, 22px x 24px padding, a 24px serif title with a 13px ink-3 hint on the right.
- **Summary sentence (`.g-summary`):** Brygada 19px/1.35 in ink-2 across the full page width, its numbers in Lilac Ink and never broken across lines; it sits 12px closer to the title. It is not the page lede (`.g-lede`, 15px, 60ch), which other pages use under their titles.
- **Feature columns:** an italic 19px Lilac Ink header, a 34px numeral with its unit (13px ink-2), a 12px ink-3 note, then at most four 29px label | value rows under hairlines (long values end in an ellipsis, counts from 10,000 read compact: "24.4K words"). Each Dictation and Read Aloud label carries a 14px ink-3 info icon (Lilac Ink on hover) whose tooltip says exactly what the number counts. "Where you talk" uses the same column grammar in its own card: the top app's share as the numeral, "in <app>" as its unit, then the top three apps and Other (name | capsule bar | share), no initial tiles.
- **Rewrite card:** 16px radius, 18px x 20px padding, at least 156px tall: its keycaps, a 15px semibold title, a 13px ink-2 description, and "Used N times" in 12px ink-3 at the bottom. Hover strengthens the edge. The add card has no fill, a dashed line-strong edge and a 32px round raised plus.
- **List container:** the same as a group card. Rows divide by line, and serif italic day headers interrupt the list on History.
- **Notice:** 12px radius, 14px x 16px padding, 18px status icon, 14px text, an optional secondary button on the right. Amber, coral or moss at 10% over the panel with a 30% edge.

### Setting Row
- **Grammar:** title (15px medium) and description (13px ink-2) on the left at up to about two thirds width, with a single control on the right. Minimum height 64px, padding 14px x 20px, 24px gap.
- **Variants:** stacked (title over a full-width control such as a textarea or chips), and tooltip mode, which moves the description into an (i) InfoTooltip beside the title. Advanced uses tooltip mode for every row.

### Inputs / Fields
- **Input / Textarea:** a well on ground fill, line-strong edge, 10px radius, 36px tall (textarea at least 104px), 14px text. A field label above is 13px medium ink-2. Mono fields use 13px monospace.
- **Search:** an input with a leading 16px search icon.
- **Dropdown trigger:** card fill, line-strong edge, 10px radius, at least 200px wide, with a chevron in ink-3 that rotates when open (200ms).
- **Hover / Focus:** hover takes the edge to ink-3. Focus takes it to lilac with no glow.
- **Disabled / read-only:** wash fill or ink-2 text, line edge.
- **Switch:** 44 x 24 pill. Off is a line-strong track; on is the wing gradient. White 18px knob with the knob shadow, sliding in 150ms.
- **Slider:** 6px pill track filled flat lilac to the value over line-strong, a 16px white thumb, and the value (13px medium, tabular, ink-2) at the end.
- **Radio:** 18px circle with a 1.5px line-strong edge; selected becomes a 5px lilac ring.

### Navigation
- **Lockup:** the wing mark at 1.2x the cap size, then "Glider" in the Lockup style, 22px above the first nav item.
- **Sidebar item:** 40px tall, 12px radius, 18px icon at 1.75 stroke, 15px label. Resting ink-2; hover wash with text ink; active raised fill, medium weight, text ink, and the icon turns Lilac Ink. That icon is the sidebar's only accent.
- **Tabs:** a ground-filled track (12px radius, 4px padding, line edge) with 32px segments (8px radius, 14px medium, optional 16px icon). The active segment is raised with the tab seat. Small tabs are 28px with 13px text. Used for History (Dictation | Read Aloud), Models (Speech to text | Text to speech | Rewriting), Insights (30 days | All time), a rewrite's example (Before | After | Changes) and the theme picker.
- **Footer pickers:** 26px ghost buttons with a 14px icon, 12px text and a 12px chevron in ink-3.
- **Back link:** 13px ink-2 with a 14px chevron, above a detail page's title.

### Keycaps (signature)
A shortcut binding drawn as physical keys. These are the system's only ornament.
- **Sizes:** hero (42px, 19px legend, 10px radius) set inline in serif sentences; sm (30px, 14px legend, 7px radius) as the shortcut control in settings rows and on rewrite cards; line (24px, 12px legend, 6px radius, 2px bevel) inside body copy and overlay hints. Keys sit 4px apart.
- **Resting:** panel face, plum edge and legend, 3px plum bevel. Inside a shortcut control, hover or focus lifts the key 2px and deepens the bevel to 5px.
- **Live:** drops 3px, bevel gone, wing gradient fill, violet-black legend. The hero sentence swaps to "Listening..." / "Reading aloud..." followed by five lilac live bars (3px wide, staggered 120ms, scaleY 0.35-1 over 1s; still at 0.6 under reduced motion).
- **Capturing:** dashed plum edge, no bevel, dropped 3px. An empty slot is the same at 60% opacity, and breathes its dashed edge between plum-pick and plum-faint (1.2s).
- **Transition:** transform, shadow and colors at 150ms ease-out.

### History Row
- **Grammar:** time (13px tabular ink-3) | text (15px, 1.6, selectable, clamped to 2 lines) with an optional meta line (13px ink-3: source file, or voice · speed) | actions (32px icon buttons: play, copy, star, delete). The entry being read shows small live bars and "Reading, sentence 2 of 3" in its meta line. Home's Today list uses the same grammar with a kind icon (mic or waveform) in the action column.
- **Player:** opens under the text as a ground well (12px radius, line edge): a 32px round lilac play button, then a 4px scrub track filled with the wing gradient.

### Model Row
- **Grammar:** name (15px medium) with badges, and a 13px ink-2 description, on the left. On the right, a grade grid (56 / 56 / 56 / 64px columns for English, Hindi, Speed and Size; size right-aligned and tabular), then the action: Use (secondary sm), a delete icon button, or Download and use (secondary sm with a download icon).
- **Downloading:** a 4px progress bar under the name with "38% of 1.6 GB, then switches" in 13px ink-2, and a cancel icon button in place of the action.
- **Below a group:** "Show N more" and "How models are graded" as underlined 13px ink-2 links.

### Insights Charts
- **Two directions (Activity):** the last 30 days, one column a day. Speaking rises above a line-strong centre line in Voice Violet; listening falls below it in Voice Pink, both full-pill bars on one scale, the line placed where the two maxima meet. Empty days are a 2px dot on the line; today is a lilac ring on it. The key ("Speaking, above", "Listening, below") sits in the card header; one 13px ink-3 line below the chart reads "Last 30 days. Active N of 30 days. Busiest <day>." Each column carries a tooltip with its minutes. The chart and the streak calendar draw at the measured size of their box (out of flow), so the top row takes whatever height the page leaves and nothing scrolls from a 900px-wide panel up.
- **Capsule bars (rewrite mix, app shares):** a 14px pill with a 1.5px line-strong inset edge and 3px padding, filled with the bar gradient (at least 8px wide when not zero; empty at zero). Bars are 12px tall here; app rows show the name, the bar and the share, with no initial tile.
- **Streak heatmap:** weekday labels and square cells share one grid that fills the card (4px gaps, 4px radius, columns of weeks). Empty days are wash with an inset line. Activity fills in four steps: lilac at 30%, 55% and 80% mixed into card, then full lilac. Today gets a 1.5px text outline. Month and weekday labels and the Less / More legend are 11px ink-3.

### Rewrite Parts
- **Before / after demo:** the "before" text in a ground well (ink-2), a keycap and the rewrite's name between, the "after" text on the panel with a line-strong edge (text ink). 13px, 10px radius boxes.
- **Use chip:** a pill (card fill, line edge) holding sm keycaps and a 14px ink-2 sentence ("polishes selected text").
- **Diff:** deleted words in ink-3 with a coral strike-through at 70%; added words on a moss 20% wash with a 3px radius.
- **Saved state:** a moss check and "Saved" in 13px ink-3 beside the title.

### Onboarding
- **Step dashes:** 22 x 4 pills, 6px apart. Upcoming steps are line-strong, finished ones ink-2, the current one the wing gradient.
- **Step content:** the lockup at 24px on the first step, the Onboarding Title, a 15px ink-2 subtitle, then cards: option rows (radio | name and description | badge, 14px x 18px), permission rows (40px raised icon tile, 12px radius | name and description | "Allowed" moss badge or an Allow button), language chips, or the Try it card with numbered steps, line keycaps and a textarea.
- **Model steps:** one step each for the dictation model, the speech model (voices; the same round picker, but several can be on so each language gets one) and the refine model (optional, with "Not now"). Each option row shows name, badge, a one-line description, a meta line (grades, speed, languages or speakers, memory) and the size; voices add a Sample button. A downloads card below the list keeps one row per download in progress (icon, name, 4px gradient bar, "64% · 1 min left", cancel); finished ones collapse into a moss "Ready: …" line. Downloads keep running while the user moves on.
- **Footer:** Back (ghost, chevron), a 13px ink-3 hint ("You can skip this", "Allow both to continue"), and Continue (primary lg with a trailing arrow, disabled until the step is done).

### Overlay
Glider's face outside its window. Floats over any app and never takes focus.
- **Pill:** 40px tall, full radius, the panel at 97% with a line-strong edge and the overlay float. 13px medium text with a 14px leading glyph and 28px round icon buttons at the end. States: Listening (lilac live bars, the time in tabular ink-2, a cancel x), Transcribing, Loading model and Preparing voice (a 14px spinner with a lilac arc), and Select some text first (an amber warning icon).
- **Reading panel:** 392px wide, 20px radius, same surface as the pill. A top line (live bars, "Reading aloud", "2 of 5" in ink-3), the sentence being spoken (14px, 1.5), a segmented progress bar (3px segments: read in ink-3, current in the wing gradient, upcoming in line), then controls: skip back, a 36px round gradient play/pause, skip forward, a speed stepper pill (wash fill, line edge, minus, "1.6x" in rounded 600, plus) and a stop button.
- **Live preview panel:** the same panel while dictating with a streaming model: "Listening", the time and a cancel x, then the words so far.
- **Nowhere to type:** a 420px panel when dictation had no text box to land in. A 13px ink-2 hint with a mic icon, a close button ringed by an 8s countdown (ink-3 arc over a line track), the dictated text (15px, selectable, up to 4 lines), then "Also saved in History" (12px ink-3) and Copy (primary sm), which turns into a moss "Copied".
- **Refine:** three steps. *Refining* is the pill with a spinner, "Refining" and the word count in ink-2, its fill tinted lilac 16% up to the progress. *Done* is the pill with a moss check, "Done." and a "See changes" text button in Lilac Ink. *See changes* opens a 520px panel: "N changes" and "⌘ Z to undo" (line keycaps) over a hairline, the diff (removed words ink-3 with a coral strike, added words on a moss wash), then icon buttons for copy, good, bad (the picked one in Lilac Ink) and refine again, with the refine and model name in 12px ink-3 on the right.
- **Menu bar icon:** the wing mark as a monochrome template image that macOS tints to fit the bar. While a shortcut is live it sits on a lilac 24% tint in Lilac Ink.

### Loading Screen
Shown while the speech model loads at launch. Only the wing mark, 84px wide and centred on the ground, with no text. Each 3.6s loop draws the two blades in a 6px lilac outline (the lower blade 0.18s behind), fills them with their gradient as the outline fades, holds, then fades out. Under reduced motion it is a still, filled mark.

### Brand
- **Wing mark:** two curved blades. The upper blade runs pale pink-lilac to orchid; the lower runs violet to orchid. Drawn by `GliderMark.tsx` (viewBox 155 170 365 328); never redraw or recolor it, and outline it only in the loading screen's draw animation.
- **Lockup:** the mark, then "Glider" in system 500 with -0.02em tracking, a 0.3em gap, the mark at 1.2em tall. No tagline in the lockup.
- **App icon:** the mark on a dark glass tile with a top rim light, a violet glow at the bottom edge and a soft cast shadow. Source: `src-tauri/icons/logo.svg`.

## Do's and Don'ts

### Do:
- **Do** build each new page as a serif Display title, an optional ink-2 lede, then settings groups of "title + description | control" rows inside the 860px column.
- **Do** step surfaces ground, panel, card, raised, and separate them with 9% hairlines, not shadows.
- **Do** draw every keyboard shortcut with the Keycaps component, at the size that matches its context (hero in sentences, sm in rows and cards, line in body copy and the overlay).
- **Do** paint solid accent fills (primary button, switch on, live keycap, progress, current step) with the wing gradient, and keep tints, strokes and text flat lilac.
- **Do** use Lilac Ink for accent text and icons on neutral grounds, and violet-black ink on any lilac fill.
- **Do** draw Insights charts in the two voices (violet speaking, pink listening) and the bar gradient, and keep lilac for today and the streak.
- **Do** keep the overlay a single pill that grows into a panel only when there is text to read or copy, with the panel at 97%, a line-strong edge and the overlay float.
- **Do** set the brand as the wing mark plus "Glider" in system UI, using `GliderMark` and `GliderTextLogo`.
- **Do** take every color from `theme.css` tokens. Add a new themed color as a light/dark pair there.
- **Do** keep state transitions at 150-200ms on color, border and transform only, and still every loop under reduced motion.
- **Do** route every visible string through i18next.

### Don't:
- **Don't** set controls, buttons, row titles or the brand name in Brygada 1918. The serif is for titles, sentences, numerals and italic headers.
- **Don't** write uppercase, letter-spaced captions or group labels. Use sentence case.
- **Don't** give any element other than a keycap a hard offset shadow or bevel, and don't put soft shadows on cards inside the window.
- **Don't** use lilac or the gradient as a surface, on text, on borders or as decoration, and don't introduce a second accent hue. Success is moss, not lilac.
- **Don't** bring any other hue into a chart, or swap the voices: speaking is always violet, listening always pink.
- **Don't** redraw, recolor or add effects to the wing mark (the loading screen's draw is the one outline), and don't put the tagline anywhere but the loading screen.
- **Don't** add hex values or greys outside `theme.css`. Greys are `color-mix` steps of text.
- **Don't** use the rounded keycap legend face for titles or body text.
