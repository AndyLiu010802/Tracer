# Appearance and workspace layout

Materials paint the workspace without changing its available width or height. The outer frame uses a fixed, pointer-transparent decorative layer; material borders on cards keep a constant one-pixel box model. `workspace-layout.css` is loaded after appearance styles and owns section spacing and responsive layout.

Board, planner, notes, inbox, insights, timeline and map use complete reading surfaces instead of individual background chips behind headings and hints. Board columns and planner days adapt to the content container, including when the reference reader is open. Unscheduled tasks occupy their own row above the week.

At widths up to 720 px, navigation and projects remain reachable in horizontal scrolling rows. The reference reader stacks below the main area, with its existing collapse control available; dragging a horizontal reader width is disabled in this layout. Header controls wrap within the header instead of covering navigation.

## Validation

`dev/qa-appearance-layout.cjs` runs in an isolated temporary workspace. It compares element geometry across ten pages, ten material palettes plus the default, no/static/dynamic background CSS states, widths of 320/390/1024/1600 px, and Chinese/English: 2,640 combinations. It checks overflow, usable main area, navigation/header separation and compact navigation height. These comparisons exercise appearance selectors directly; final screenshots additionally mount the real celadon material and firefly wallpaper through `TracerWallpapers.synchronize`.

Also passed browser regressions for board/planner drag anchors (120 frame/material combinations), frame purchases and priority (60 combinations), and wallpaper opacity and account isolation. Text contrast checks passed for all ten materials and ten pages plus dialogs.

- [Board](layout-board-celadon.png)
- [Planner](layout-planner-celadon.png)
- [Narrow planner](layout-planner-mobile.png)
