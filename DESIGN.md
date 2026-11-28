---
name: Glider
description: A quiet control room for your voice shortcuts; dictate, listen and rewrite, all on your own computer.
colors:
  background: "#1f1f1f"
  background-light: "#f7f7f8"
  ground: "#2c2c2e"
  ground-light: "#e9e9eb"
  card: "#272727"
  card-light: "#ffffff"
  raised: "#353535"
  raised-light: "#e4e4e7"
  bar: "#1b1b1b"
  bar-light: "#efeff1"
  pill: "#0f0f0f"
  pill-light: "#ffffff"
  text: "#ececec"
  text-light: "#1d1d1f"
  ink-2: "#ececec9e"
  ink-2-light: "#1d1d1f9e"
  ink-3: "#8e8e93"
  ink-3-light: "#6e6e73"
  line-strong: "#ececec29"
  line: "#ececec14"
  wash: "#ececec0f"
  accent: "#8b5cf6"
  accent-light: "#7c4dea"
  accent-ink: "#b99cff"
  accent-ink-light: "#6d3fd8"
  on-accent: "#ffffff"
  voice-speak: "#8b5cf6"
  voice-listen: "#5eb0ff"
  voice-listen-light: "#2f8ae0"
  mark-from: "#cbabff"
  mark-to: "#8b5cf6"
  mark-from-light: "#a87cf9"
  mark-to-light: "#6d35e4"
  moss: "#8fd19e"
  moss-light: "#2f7d5b"
  warning: "#fbbf24"
  warning-light: "#b45309"
  error: "#f87171"
  error-light: "#dc2626"
typography:
  page-title-mac:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  page-title-pc:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  hero:
    fontFamily: "system-ui"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  welcome:
    fontFamily: "system-ui"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  section:
    fontFamily: "system-ui"
    fontSize: "13px"
    fontWeight: 600
  row-title-mac:
    fontFamily: "system-ui"
    fontSize: "13px"
    fontWeight: 500
  row-title-pc:
    fontFamily: "system-ui"
    fontSize: "14px"
    fontWeight: 500
  description:
    fontFamily: "system-ui"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  numeral:
    fontFamily: "system-ui"
    fontSize: "26px"
    fontWeight: 600
    fontFeature: "tnum"
  key:
    fontFamily: "system-ui"
    fontSize: "11px"
    fontWeight: 600
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13px"
rounded:
  intro-mac: "18px"
  card-mac: "12px"
  card-pc: "8px"
  menu-mac: "12px"
  menu-pc: "8px"
  nav-mac: "8px"
  nav-pc: "6px"
  control-mac: "7px"
  control-pc: "6px"
  key-mac: "5px"
  key-pc: "4px"
  pill: "9999px"
spacing:
  sidebar: "264px"
  sidebar-rail-mac: "92px"
  page-gutter: "28px"
  page-gap: "22px"
  group-gap: "8px"
  head-mac: "62px"
  head-pc: "52px"
  footer: "52px"
  nav-row-mac: "30px"
  nav-row-pc: "34px"
  row: "12px 16px"
components:
  button-bordered:
    backgroundColor: "text at 10%"
    textColor: "{colors.text}"
    rounded: "{rounded.control-mac}"
    height: "24px (macOS) / 32px (Windows, Linux)"
  button-prominent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control-mac}"
  switch-mac:
    size: "38 x 22"
    backgroundColor: "{colors.accent}"
  switch-pc:
    size: "40 x 20, outlined"
    backgroundColor: "{colors.accent}"
  segmented:
    backgroundColor: "text at 7%"
    rounded: "8px (macOS) / 6px (Windows, Linux)"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card-mac}"
  footer:
    backgroundColor: "{colors.background} at 82%, frosted (macOS) / {colors.bar} (Windows, Linux)"
    height: "{spacing.footer}"
---

# Design System: Glider

## Overview

**Creative North Star: "The Quiet Control Room for Your Shortcuts"**

Glider lives in its shortcuts: hold one to dictate, press one to listen, press another to rewrite what you selected. The main window is opened now and then, to set those keys, fetch models and voices, see how you have been using them and look back at today. The window serves that visit and gets out of the way.

It looks like a settings app that belongs to the operating system. On macOS it reads like System Settings: a glass sidebar a shade lighter than a neutral dark page, 13px SF Pro, compact rows, pill-shaped controls and pop-up buttons. On Windows and Linux it keeps the same screens and the same neutral greys, with PC controls: the native title bar, Segoe UI Variable (the system font on Linux), roomier rows, outlined toggles, boxy dropdowns and an accent pill on the selected row. Every screen exists once; only the controls' metrics change per platform.

The only hue is Glider violet, taken from the app icon's mic. It marks what is selected, the one primary action and whatever is happening right now. Everything else is neutral grey.

Outside the window, Glider is one small floating pill near the bottom of the screen, over whatever app the user is in. It says what is happening, grows into a small panel only when there is something to read or copy, and leaves when it is done.

The reference renders are the two design canvases: "Glider macOS Glass" and "Glider Windows & Linux". Their PNG and HTML exports live in `archive/Canvas/` on the designer's machine (not in git).

**Key Characteristics:**

- Neutral greys like System Settings: the page, a lighter sidebar, cards a step above the page, controls a step above the cards. Hairlines, not shadows, separate them.
- System fonts only. One weight jump does the hierarchy: semibold for titles and section headers, medium for row titles, regular for the rest.
- Violet is for selection, the primary action, focus and live state. No gradients on controls.
- Rows follow "title + description | control"; lists follow "time | text | actions".
- One set of screens, two control sets: macOS and PC (Windows and Linux).
- State changes take 150-200ms and touch only color, border and transform.

## Colors

Each themed value is defined once as a light/dark pair in `src/styles/theme.css`, then follows the OS or a forced `data-theme`. Dark is the hero theme; light mirrors every role with paper greys. The overlay window (`src/overlay/RecordingOverlay.css`) takes the same tokens.

### Accent

- **Glider Violet** (accent, `--color-logo-primary`: #8b5cf6; light #7c4dea): fills the primary button, a switch that is on, the picked row of a macOS menu, progress, the live key, the speaking bars and the streak's top step. Its 16% tint backs badges, picked chips and the Saved toggle; its 55% tint is the line under "Try it". It is the 2px focus ring and the 40% text selection.
- **Violet Ink** (accent-ink: #b99cff; light #6d3fd8): violet as text or icon on grey: links ("Change shortcuts", "See all history"), "Try it", the selected sidebar icon, icon tiles on Home and Rewrite, badge text.
- **On Accent** (#ffffff): text and icons on a violet fill, in both themes.
- `--color-accent-grad`, `--color-bar-grad` and `--color-ink-grad` are kept as flat one-colour gradients so `background-image` users stay solid violet.

### Neutral

- **Background** (#1f1f1f; light #f7f7f8): the window and every page, onboarding and the loading screen.
- **Ground** (#2c2c2e; light #e9e9eb): the sidebar. On macOS it is 84% over the window's sidebar vibrancy; on Windows and Linux it is solid. Menus are ground at 97%.
- **Card** (#272727; light #ffffff): settings groups, Home and Insights cards, rewrite cards, lists, dialogs and the notice toast.
- **Raised** (#353535; light #e4e4e7): a solid control fill where a translucent one would not do.
- **Bar** (#1b1b1b; light #efeff1): the footer on Windows and Linux (macOS frosts the page colour instead).
- **Pill** (#0f0f0f; light #ffffff): the overlay pill and its miniatures in the intro examples.
- **Text** (#ececec; light #1d1d1f), **Ink 2** (text at 62%: descriptions, section headers, secondary labels), **Ink 3** (#8e8e93; light #6e6e73: times, meta, placeholders; themed so it clears 4.5:1).
- **Line Strong** (text 16%: menu edges, switch track when off, dashed "add" rows), **Line** (text 8%: every hairline), **Wash** (text 6%: hover fills, fields, the search well).
- Control fills are text at 10% on macOS and 7% on Windows and Linux (`--g-ctl`), with a 9% edge (`--g-ctl-edge`).

### Status

- **Moss** (#8fd19e; light #2f7d5b): success and "ready": Allowed, Done, Copied, Saved, the live-log dot, added words in a diff.
- **Amber** (warning) and **Coral** (error): warnings, errors, danger buttons and deleted words in a diff. A notice is the status colour at 10% over the page with a 30% edge.

### Named Rules

**The Violet Means Now Rule.** Violet marks only three things: what is selected, what the primary action is, and what is happening right now. If an element is none of these, it is grey.

**The Two Voices Rule.** Insights speaks in two colours: speaking is violet (voice-speak), listening is blue (voice-listen, #5eb0ff; light #2f8ae0). Capsule bars and the streak use violet. No other hue enters a chart.

**The One Hex Rule.** A hex lives once, as a light/dark pair in `theme.css`. Greys are `color-mix` steps of text. The app icon's own colours live only in `src-tauri/icons/{dark,light}/logo.svg`.

## Typography

**Font:** the system UI face only: `system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, "Noto Sans"`. SF Pro on macOS, Segoe UI Variable on Windows, the desktop's font on Linux. **Mono:** `ui-monospace, SF Mono, Menlo` for paths, logs and raw values on Debug and About.

**Base size:** 13px on macOS, as in System Settings; row titles are 14px on Windows and Linux, the PC norm.

### Hierarchy

- **Page title** (600, 15px on macOS, 18px on Windows and Linux): in the page's title bar, top left.
- **Hero** (600, 24px, -0.01em): the sentence on a feature's intro card ("Hold fn to dictate", with keys set in it) and onboarding titles.
- **Welcome** (600, 22px): Home's "Welcome back, <name>".
- **Section header** (600, 13px, ink 2): above every group of cards ("Your shortcuts", "Today", "Languages").
- **Row title** (500, 13px; 14px on PC), **Description** (400, 12px, ink 2, 1.4).
- **Numerals** (600, tabular): 20px on Home's numbers card, 26px in Insights.
- **Labels and meta** (11-12px, ink 3): times, "Not used yet", the sidebar version, column headers.
- **Keys** (600, 11px on macOS, 12px on PC; 15px in a hero sentence).

### Named Rules

**The One Face Rule.** Every word is the system face. Hierarchy comes from size and one weight step, never from a second family.

**The Room for Descenders Rule.** Text that can be truncated (nav labels, dropdown values, footer pickers, buttons, tabs) keeps a line height of at least 1.3, so "g", "y" and "p" are never clipped.

**The Sentence Case Rule.** Headers and labels are sentence case. The only uppercase caption is the macOS footer menu's heading ("DICTATION MODEL"), as in macOS menus; on Windows and Linux it is sentence case.

## Layout

The window is a sidebar on the left and the page on the right; there is no inset panel and no top bar.

- **Sidebar (264px):**
  - **Top:** on macOS a 30px row holds the window buttons (native, placed at 18, 31) and, on its right, the glossy round button that hides the sidebar. Windows and Linux keep their native title bar above the window instead.
  - **Search:** a field that narrows the sections as you type; Enter opens the first match.
  - **Sections:** the main group (Home, Insights, General, Dictation, Read Aloud, Rewrite, History, Models), a hairline, then Advanced, Debug and About.
  - **Bottom:** the mic mark, a semibold "Glider" and the version.
  - **Hidden (macOS only):** the sidebar folds to a 92px icon rail, wide enough to keep the window buttons inside it. Each icon names its section in a tooltip on hover.
- **Page:** a column capped at 1280px with a 28px gutter; only Insights is held to the window's height. The page's **title bar** (62px on macOS, 52px on PC) holds the title on the left and the page's one or two actions on the right. It is a band a step lighter than the page (text 3.5% over it) with a hairline under it, running the page's full width; it stays at the top while the page scrolls under it frosted (blur 20px), lifts a touch (text 6%) under the pointer, and drags the window on macOS. An optional one-line lede (13px, ink 2) sits right under it. Blocks follow 22px apart; inside a group, the header sits 8px above its card.
- **Footer (52px):** the dictation model, the voice and the rewrite model as pickers. It sits below the page, never over it, so the end of every page stays reachable: on macOS it is the page colour at 82%, frosted; on Windows and Linux it is the solid bar. Notices sit on its right.
- **Home:** the welcome line; "Your shortcuts" (a card of two rows: icon tile, the sentence with its keys, a hint) beside a 240px "Your numbers" card of three stacked figures; "Today" with three Show-only filters (mic, waveform, sparkle) and "See all history"; then "How to use", a card with a video thumbnail.
- **Feature pages (Dictation, Read Aloud, Rewrite):** the lede, the intro card (hero sentence, hint and "Try it" on the left; a live example with its mute button on the right), then groups of rows.
- **Rewrite:** On switch and "New rewrite" in the title bar; "Your rewrites" in two columns of cards (icon tile, name, keys; one line on what it does; how often it was used), then a dashed "Write your own" row.
- **Insights:** the summary sentence in a card (its numbers in semibold text), Activity (1.85fr) beside the streak (1fr), the Dictation | Read Aloud | Rewrite card, then "Where you talk" across the full width with its apps in two columns. The time range is a segmented control in the title bar.
- **History:** "Transcribe file" and "Open Recordings Folder" in the title bar; then Dictation | Read Aloud | Rewrite tabs with a "Saved" toggle pill on the right; then a card per day.
- **Models:** rescan and folder buttons in the title bar; the three tabs and a search field; then groups with column headers (Model, Language, Quality, Speed, Size, Memory).
- **Settings pages (General, Advanced, Debug, About):** groups of rows.
- **Onboarding:** the same page colour with no sidebar: step dashes, a 24px semibold title, a 13px subtitle, cards, then a footer with Back, a hint and Continue.
- **Loading screen:** the page colour with only the mic mark, centred.
- **Responsiveness** uses container queries on the page, not viewport queries.

## Elevation & Depth

Flat and tonal. A surface sits in front because it is a step lighter (dark) or whiter (light) and edged by a hairline. Shadows only where something floats.

- **macOS glass:** the window is see-through with the system sidebar material (vibrancy) behind it; the sidebar is ground at 84% so the desktop shows through faintly, and the page paints opaque. The footer is frosted (blur 20px).
- **macOS gloss:** the sidebar's round button and the search pill are glass, ported from Glassy UI's button (glassyui.com, MIT): a frost of what lies behind (blur 16px, saturate 1.8) over a thin fill, a sheen falling from the top, and a lit rim — a bright inner edge at the top left, a softer counter highlight at the bottom right, a shaded inner bottom edge and a faint blue/pink split at the sides — with a small drop beneath. The values are themed (`--g-glass-fill`, `--g-rim-light`, `--g-rim-dark`, `--g-rim-glow`). WebKit draws Glassy UI without its Chromium-only lens, so this is its full look in the macOS webview. Bordered and prominent buttons carry a faint inner top highlight.
- **Menu float:** dropdown menus and footer menus (`0 14px 40px rgba(0,0,0,0.4)`), dialogs and the notice toast.
- **Overlay float:** the overlay pill and its panels over other apps.
- **Knob:** the switch knob and the slider thumb (`0 1px 3px rgba(0,0,0,0.35)` on macOS).

### Named Rules

**The Only What Floats Rule.** Soft shadows belong to menus, dialogs, toasts, the overlay and the macOS sidebar controls' small drop. Cards inside the window never get one.

## Shapes

macOS is rounder; PC is squarer.

|                                 | macOS     | Windows, Linux |
| ------------------------------- | --------- | -------------- |
| Cards, lists, groups            | 12px      | 8px            |
| Intro cards                     | 18px      | 8px            |
| Menus                           | 12px      | 8px            |
| Nav rows                        | 8px       | 6px            |
| Buttons, fields, shortcut wells | 7px       | 6px            |
| Keys                            | 5px       | 4px            |
| Search                          | 15px pill | 6px box        |

Switches, chips, badges, the Saved toggle, the pop-up chevron, the overlay pill and progress bars are full pills. A dashed edge means "not yet": a shortcut being captured, the empty Today card, "Write your own".

## Components

### Buttons

- **Bordered** (default, `g-btn sec`): text at 10% fill (7% on PC), 9% edge, a faint inner highlight; 24px tall on macOS, 32px on PC, 12-13px text.
- **Prominent** (`g-btn pri`): violet fill, white text, 500 weight (600 on PC). One per view.
- **Ghost** (`g-btn ghost`), **Danger** (coral text), **Done** (moss 16% fill).
- **Icon button** (`g-ib`): 28px (32px on PC), 7px (6px) radius, ink 2 icon; wash on hover; Violet Ink when on.
- **Link** (`g-link`): 12px Violet Ink, underline on hover. **Try it** (`g-try`): 14px medium Violet Ink over a 1.5px line at 55% violet.

### Controls

- **Switch:** macOS 38 x 22, violet when on, line-strong when off, white knob. PC 40 x 20 outlined in text at 60% with a 12px knob; violet fill and white knob when on.
- **Segmented control** (`Segmented`, `Tabs`): a sunk track (text at 7%) with the picked segment raised (text at 18% with a small drop on macOS; 14% and semibold on PC). For a setting with two or three choices (Overlay, Overlay Position, Theme) and for page tabs.
- **Dropdown** (`Dropdown`): on macOS a pop-up button, the value then a 22px round up-and-down chevron; its menu is frosted, the picked row filled violet with a check before it. On PC a 32px box with a chevron and a lighter bottom edge; its menu is solid, the picked row a faint fill with a violet pill on its left edge. Menus are as wide as their longest option (180-320px, never narrower than the button), line up with the button's end, and open upward when the page has no room below. The type-ahead model picker (`Select`) wears the same field and menu.
- **Fields** (`Input`, `Textarea`, `g-field`): wash fill, 9% edge, 28px tall on macOS (32px on PC). Focus: a violet edge and a 3px violet ring on macOS; a 2px violet bottom edge on PC.
- **Search:** sidebar and Models. A 30px pill with the icon first on macOS; a box with the icon last and an underline on PC.
- **Chip:** 24px pill (28px on PC), text at 8%. Picked: violet 16% with a 55% violet edge.
- **Badge:** 20px pill, 11px medium; violet 16% with Violet Ink ("In use"), moss, or plain.
- **Toggle pill** (`g-toggle`, History's Saved): 26px pill with a star; violet tint when on.

### Keys

A shortcut drawn as keys (`Keycaps`). Flat, like the keys in System Settings: text at 10% fill, 12% edge, a 1px darker lower edge (a 2px bottom border on PC; 3px in a hero sentence). Sizes: in rows and sentences 20px (22px on PC); in small text 18px; in a hero sentence 30-32px with 15px legends. Live: violet fill, white legend. Capturing: dashed violet edge. The shortcut control in a row is a bordered well (`g-shortcut`, 28px tall) holding the keys.

### Navigation

- **Sidebar row:** 30px (34px on PC), 13px, 17px icon in ink 2. Hover: wash. Selected: text at 10% fill (8% on PC), the icon turns violet; on PC a 3 x 16px violet pill sits on the left edge.
- **Page title bar:** the title on the left (an optional back chevron before it on a detail page), actions on the right.
- **Footer pickers:** 30px ghost buttons (32px on PC), 14px icon, 12px text, a 10px chevron. Their menus are 330px wide with a heading and one row per model ("Active" in Violet Ink).

### Cards and Rows

- **Group:** a 13px semibold ink 2 header (and an optional 12px ink 3 description), 8px above a card of rows divided by hairlines.
- **Setting row:** title (13px medium; 14px on PC) and description (12px, ink 2) on the left; one control on the right. 12 x 16px padding, 24px gap. Variants: stacked (title over a full-width control) and tooltip mode (Advanced).
- **Intro card:** 18px radius (8px on PC), 22 x 24px padding; hero sentence, hint, "Try it"; the example column is 360px with a mute button on its first line (off by default).
- **Rewrite card:** a 26px icon tile, the name in semibold, its keys on the right, one line on what it does, "Not used yet" or "Used N times".
- **Insight card:** 14 x 18px padding; 13px semibold title (the streak's is 17px); feature columns with a 26px numeral, a note and 28px label | value rows.
- **List row (History, Today):** time (12px, ink 3) | text (13px, 1.5, clamped to two lines) with a 12px meta line | 28px icon buttons.
- **Empty state:** a dashed card with one centred 12px line.
- **Notice:** status colour at 10% over the page with a 30% edge, 16px icon, 13px text.
- **Dialog:** card fill, line-strong edge, card radius, menu float; 13px semibold title.

### Insights Charts

- **Activity:** the last 30 days, one column a day; speaking rises above a centre line in violet, listening falls below it in blue. The two are named at the left, "Speaking" just above the line in Violet Ink and "Listening" just below it in blue (12px medium), in a gutter as wide as the longer word, so the card header carries only the title. The line keeps room for both names. Empty days are a dot on the line; today is a violet ring.
- **Streak:** weekday labels and square cells in one grid. Empty days are wash with an inset hairline; activity fills violet at 30%, 55%, 80% and 100%; today gets a 1.5px text outline. A month's name is dropped when the next one starts within two weeks, so names never collide.
- **Capsule bars:** a thin outlined pill filled with flat violet.

### Onboarding

Step dashes (22 x 4 pills: done ink 2, current violet), a 24px semibold title, a 13px subtitle, then cards: option rows (radio | name and description | badge), permission rows (32px icon tile | name and description | "Allowed" or Allow), language chips, model rows with downloads, or the Try it card with numbered steps and keys. The footer has Back (ghost), a 12px hint, and Continue (prominent, disabled until the step is done).

### Overlay

Glider's face outside its window: floats over any app and never takes focus. Its window is only as big as what it shows, because the window's transparent rest still catches clicks meant for the app underneath: Read Aloud opens as the compact "Preparing voice" pill (with a cancel button, like dictation's), grows to the player with room for its tooltips when the first sentence plays, and is taller only when live preview is on. The pill is 28px tall on the pill colour with a hairline edge and the overlay float; listening shows live level bars, transcribing a sweep, and refining a shimmer. Read Aloud's player, the "nowhere to type" card and the "See changes" diff card share the same surface and tokens. Live and current marks are violet; success is moss.

### Loading Screen

Only the mic mark, 64px wide, centred on the page colour. Each 3.2s loop draws the capsule, then the cradle and the stem, holds, then fades. Under reduced motion it is a still mark.

### Brand

- **Mic mark:** a line mic (capsule, cradle, stem) with round caps in a violet gradient (mark-from to mark-to), drawn by `GliderMark.tsx`. Never redraw or recolour it.
- **Lockup:** the mark, then "Glider" in the system face (semibold at the foot of the sidebar).
- **App icon:** the thin-line mic on a black tile (dark) or a white tile (light). Sources: `src-tauri/icons/{dark,light}/logo.svg`. The App icon setting (Automatic, Light, Dark) swaps the Dock or taskbar icon while Glider runs.

## Do's and Don'ts

### Do:

- **Do** build each new page as a title bar (title, then at most two actions), an optional lede, then groups of "title + description | control" rows.
- **Do** take every colour from `theme.css` and every metric from the `--g-*` variables in `glider-ui.css`, so macOS and PC stay in step.
- **Do** style per platform with `:root[data-platform="macos"]` and `:root:not([data-platform="macos"])`, never by forking a component.
- **Do** draw every shortcut with `Keycaps`, set a two- or three-way setting with `Segmented`, and a longer list with `Dropdown`.
- **Do** keep violet for selection, the primary action, focus and live state.
- **Do** keep line heights at 1.3 or more on anything that can truncate.
- **Do** keep state transitions at 150-200ms and still every loop under reduced motion.
- **Do** route every visible string through i18next.

### Don't:

- **Don't** use a serif, a second font family, or uppercase captions (except the macOS footer menu heading).
- **Don't** put gradients, glows or colour on surfaces. The macOS sidebar controls' Glassy UI glass is the one exception.
- **Don't** add hex values or greys outside `theme.css`.
- **Don't** bring another hue into a chart or swap the voices: speaking is violet, listening is blue.
- **Don't** put soft shadows on cards inside the window.
- **Don't** redraw, recolour or add effects to the mic mark.
