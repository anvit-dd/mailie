# Zed IDE Design System

> Compiled from Zed Theme Builder (https://zed.dev/theme-builder) — One Dark theme
> Extracted May 2026. The Zed UI is built with [GPUI](https://zed.dev/blog/gpui), Zed's custom Rust-based UI framework.

---

## Editor (Code Surface)

The editor uses a very dark, cool-toned background distinct from the surrounding UI chrome.

| Token | Hex | Usage |
|---|---|---|
| `editor.background` | `#282C33` | Code editor canvas |
| `editor.foreground` | `#ACB2BE` | Default code text |
| `editor.active_line.background` | `#2F343EBF` | Highlighted current line (50% opacity) |
| `editor.active_line_number` | `#D0D4DA` | Line numbers for current line |
| `editor.line_number` | `#4E5A5F` | Regular line numbers |
| `editor.hover_line_number` | `#ACB0B4` | Line number on hover |
| `editor.invisible` | `#878A98` | Invisible characters (spaces etc.) |
| `editor.wrap_guide` | `#C8CCD40D` | Soft vertical indent guides (5% opacity) |
| `editor.active_wrap_guide` | `#C8CCD41A` | Active indent guide (10% opacity) |
| `editor.document_highlight.read_background` | `#74ADE81A` | Read-access highlight (10% opacity) |
| `editor.document_highlight.write_background` | `#555A6366` | Write-access highlight (40% opacity) |
| `search.match_background` | `#74ADE866` | Search match highlight (40% opacity) |

---

## UI Chrome (Surface, Borders, Text)

### Surface

| Token | Hex | Usage |
|---|---|---|
| `background` | `#3B414D` | Deepest layer — panel headers, activity bar |
| `surface.background` | `#2F343E` | Sidebar, panels, dropdown backgrounds |
| `panel.indent_guide` | linked | Inherited from surface hierarchy |
| `panel.indent_guide_hover` | linked | Inherited |
| `panel.indent_guide_active` | linked | Inherited |
| `panel.overlay_background` | linked | Popovers, tooltips |
| `panel.overlay_hover` | linked | Hover states in overlays |

### Border

| Token | Hex | Usage |
|---|---|---|
| `border` | `#464B57` | Default borders |
| `border.variant` | `#363C46` | Subtle secondary borders |
| `border.focused` | `#47679E` | Focus rings — muted blue |
| `border.selected` | `#293B5B` | Selected state borders |
| `border.transparent` | `#00000000` | Invisible/disabled borders |
| `border.disabled` | `#414754` | Disabled element borders |

### Text

| Token | Hex | Usage |
|---|---|---|
| `text` | `#DCE0E5` | Primary UI text — warm off-white |
| `text.muted` | `#A9AFBC` | Secondary labels, metadata |
| `text.placeholder` | `#878A98` | Placeholder, hint text |
| `text.disabled` | `#878A98` | Disabled text |
| `text.accent` | `#74ADE8` | Links, interactive text accent |

### Icon

| Token | Linked to | Hex |
|---|---|---|
| `icon` | `text` | `#DCE0E5` |
| `icon.muted` | `text.muted` | `#A9AFBC` |
| `icon.disabled` | `text.disabled` | `#878A98` |
| `icon.accent` | `text.accent` | `#74ADE8` |

---

## Navigation (Title Bar, Toolbar)

| Token | Hex | Usage |
|---|---|---|
| `title_bar.inactive_background` | `#2E343E` | Inactive window title bar |
| `status_bar.background` | linked to `background` | `#3B414D` |
| `title_bar.background` | linked to `background` | `#3B414D` |
| `toolbar.background` | linked to `editor.background` | `#282C33` |

---

## Terminal

| Token | Hex | Usage |
|---|---|---|
| `terminal.background` | `#282C34` | Terminal pane background |
| `terminal.foreground` | `#ABB2BF` | Default terminal text |
| `terminal.bright_foreground` | `#DCE0E5` | Bold/bright terminal text |
| `terminal.dim_foreground` | `#636D83` | Dimmed terminal text |

### ANSI Terminal Colors

**Standard:**

| Token | Hex |
|---|---|
| `terminal.ansi.red` | `#E06C75` |
| `terminal.ansi.blue` | `#61AFEF` |
| `terminal.ansi.cyan` | `#56B6C2` |
| `terminal.ansi.black` | `#282C34` |
| `terminal.ansi.green` | `#98C379` |
| `terminal.ansi.white` | `#ABB2BF` |
| `terminal.ansi.yellow` | `#E5C07B` |
| `terminal.ansi.magenta` | `#C678DD` |

**Bright:**

| Token | Hex |
|---|---|
| `terminal.ansi.bright_red` | `#EA858B` |
| `terminal.ansi.bright_blue` | `#85C1FF` |
| `terminal.ansi.bright_cyan` | `#6ED5DE` |
| `terminal.ansi.bright_black` | `#636D83` |
| `terminal.ansi.bright_green` | `#AAD581` |
| `terminal.ansi.bright_white` | `#FAFAFA` |
| `terminal.ansi.bright_yellow` | `#FFD885` |
| `terminal.ansi.bright_magenta` | `#D398EB` |

**Dim:**

| Token | Hex |
|---|---|
| `terminal.ansi.dim_red` | `#A7545A` |
| `terminal.ansi.dim_blue` | `#457CAD` |
| `terminal.ansi.dim_cyan` | `#3C818A` |
| `terminal.ansi.dim_black` | `#3B3F4A` |
| `terminal.ansi.dim_green` | `#6D8F59` |
| `terminal.ansi.dim_white` | `#8F969B` |
| `terminal.ansi.dim_yellow` | `#B8985B` |
| `terminal.ansi.dim_magenta` | `#8D54A0` |

---

## Version Control (Git)

| Token | Hex | Usage |
|---|---|---|
| `version_control.added` | `#27A657` | Added lines (green) |
| `version_control.deleted` | `#E06C76` | Deleted lines (red) |
| `version_control.modified` | `#D3B020` | Modified lines (yellow) |
| `version_control.conflict_marker.ours` | `#A1C1811A` | Our changes in conflict (10%) |
| `version_control.conflict_marker.theirs` | `#74ADE81A` | Their changes in conflict (10%) |

---

## Collaboration (Players)

Each collaborator gets a unique color. These colors are used for cursors, selections, and presence indicators.

| Player | Cursor/Background | Selection (40%) |
|---|---|---|
| Player 1 | `#74ADE8` | `#74ADE83D` |
| Player 2 | `#BE5046` | `#BE50463D` |
| Player 3 | `#BF956A` | `#BF956A3D` |
| Player 4 | `#B477CF` | `#B477CF3D` |
| Player 5 | `#6EB4BF` | `#6EB4BF3D` |
| Player 6 | `#D07277` | `#D072773D` |
| Player 7 | `#DEC184` | `#DEC1843D` |
| Player 8 | `#A1C181` | `#A1C1813D` |

---

## Syntax Token Categories

These are the abstract categories used for semantic syntax highlighting from Zed's Syntax tab:

- Comments & Docs — doc comments, block comments, line comments
- Strings & Literals — string literals, template strings, interpolated content
- Numbers & Constants — numeric literals, boolean constants, nil
- Keywords & Operators — language keywords, operators, control flow
- Functions & Methods — function names, method calls, closures
- Types & Classes — type names, class names, interfaces, enums
- Variables & Properties — variable names, object property access
- Punctuation — brackets, delimiters, semicolons, commas
- Markup & Tags — HTML/XML tags, JSX, markdown headings
- Other — everything else, including regex literals and special characters

---

## Typography

Zed uses a minimal, editorial font stack:

**UI:** System monospace (`--font-mono` / `ui-monospace` fallback) for a terminal-native feel.

**Code Editor:** Configurable — Zed defaults to system monospace but supports any installed font. Popular choices in the community:

- `JetBrains Mono`
- `Fira Code`
- `Iosevka`
- `Cascadia Code`

**Zed Website:** Editorial serif for headings/content:

- `I A Writer Quattro S` by Information Architects
- `IBM Plex Serif`
- `Lora`

---

## Brand Color

Zed's product brand uses a purple/violet identity:

| Name | Hex | Usage |
|---|---|---|
| Zed Purple | `#8B5CF6` | Primary brand color — logo, marketing |
| Zed Deep Purple | `#7C3AED` | Darker accent variant |

---

## Design Principles

1. **Dark-first** — The default theme is dark. Light mode is a second-class citizen.
2. **Low-contrast chrome** — UI surfaces (`#2F343E`) blend into the background rather than popping, keeping focus on the code.
3. **Syntax over chrome** — Editor colors are vivid (One Dark palette); UI colors are muted.
4. **Rust-native rendering** — All UI rendered via GPUI using native GPU text shaping.
5. **Typography hierarchy via weight and opacity** — No font size variation in the UI. Hierarchy comes from `text` to `text.muted` to `text.placeholder`.

---

## Color Palette Summary

```text
EDITOR SURFACE
  #282C33   editor.background (code canvas)
  #282C34   terminal.background
  #3B414D   background (deep chrome)

UI SURFACE
  #2F343E   surface.background (panels, sidebar)
  #3B414D   background (activity bar, headers)

BORDER
  #464B57   border.default
  #363C46   border.variant
  #47679E   border.focused (muted blue)
  #293B5B   border.selected

TEXT
  #DCE0E5   text (primary — warm off-white)
  #A9AFBC   text.muted
  #878A98   text.placeholder / text.disabled
  #74ADE8   text.accent (soft blue)

EDITOR CODE
  #ACB2BE   editor.foreground (default code text)
  #D0D4DA   editor.active_line_number
  #4E5A5F   editor.line_number
  #878A98   editor.invisible

TERMINAL ANSI
  #E06C75   red
  #98C379   green
  #E5C07B   yellow
  #61AFEF   blue
  #56B6C2   cyan
  #C678DD   magenta
  #ABB2BF   white (foreground)
  #282C34   black (background)

GIT
  #27A657   added
  #E06C76   deleted
  #D3B020   modified

BRAND
  #8B5CF6   Zed purple (logo/brand)
```

---

## Key Observations for UI Design

- **No pure black** — Even the darkest color (`#282C33`) is not pure black. This prevents harsh contrast and maintains visual depth.
- **Accent is blue** — The only bright, saturated non-neutral color in the UI is `#74ADE8` (soft sky blue), used for focus states, links, and first collaborator.
- **Warm grays** — Unlike most dark themes that use blue-tinted grays, Zed's UI uses warm-toned grays (`#DCE0E5`, `#A9AFBC`) giving it a less clinical feel.
- **Semantic links** — Icons inherit from text colors, maintaining a unified hierarchy. No independent icon palette.
- **Panel/editor separation** — UI chrome uses `#2F343E` while code canvas uses `#282C33`, creating a subtle but clear spatial distinction.
- **Color tokens use alpha** — Many highlight colors use hex alpha (`#74ADE866`) rather than separate semi-transparent tokens.
