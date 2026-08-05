# Family design system — OPL migration review

Screenshots of every route in Open Perf Lab after adopting `@open-family/ui`, so the
tab-to-route split can be reviewed without running the stack.

## How these were captured

Headless Chrome at 1440×1000 (desktop) and 900×1100 (narrow), against a read-only
fixture API that answers the same endpoints `opl-api` does. The fixture is not part
of this repository — it only exists so the views are populated rather than empty.

The theme is left at `system` and the **operating-system preference is emulated**,
so these captures exercise the real resolution path: the kit's
`@media (prefers-color-scheme: dark)` block with no `data-theme` stamped. Seeding
the stored theme would stamp the attribute and bypass the code that picks the
colour, which is the thing worth reviewing.

Two extra captures cross the two, because the toggle has to beat the operating
system **in both directions**:

| File | Stored theme | OS prefers | Resolved `--canvas` | Resolved `--accent` |
|---|---|---|---|---|
| `20-theme-light-stamp-beats-dark-os` | light | dark | `#f6f7f9` | `#007748` |
| `20-theme-dark-stamp-beats-light-os` | dark | light | `#0b0e13` | `#00a768` |

## Routes

`NN-name-<theme>-<desktop|narrow>.png` for every route, plus `-full.png` for the
four whose whole-page composition matters most.

| # | Route | Was |
|---|---|---|
| 01 | `/overview` | new — `/` rendered the whole studio |
| 02 | `/scenarios` | `?tab=design` |
| 03 | `/scenarios/users` | `?tab=users` |
| 04 | `/scenarios/capture` | `?tab=capture` |
| 05 | `/scenarios/jmx` | `?tab=jmx` |
| 06 | `/run` | `?tab=run` |
| 07 | `/results` | `?tab=results` (list half) |
| 08 | `/results/:runId` | `?tab=results&run=…` (detail half) |
| 09 | `/results/:runId/timeline` | the "Live samples" panel |
| 10 | `/results/:runId/errors` | new view over data already held |
| 11 | `/results/:runId/resources` | the "Runners" panel |
| 12 | `/trends` | `?tab=trends` |
| 13 | `/compare` | `?tab=compare` |
| 14 | `/sla` | `?tab=sla` |
| 15 | `/settings/account` | new — the product had no account page |
| 16 | `*` | an unknown URL silently redirected to the studio |
| 17 | `/login` | unchanged route, rebuilt on the kit |

## States

| File | Shows |
|---|---|
| `18-rail-collapsed-<theme>` | The icon-only rail. One glyph per destination, asserted by the test suite. |
| `19-command-menu-<theme>` | The command menu behind the top bar's search trigger. |
| `20-theme-*` | The stored theme beating the OS preference, both ways. |
| `21-topbar-narrow-880-dark` | The top bar at 880px, where the kit's own bar overlaps its controls. See the stopgap in `src/perflab.css`. |
| `22-error-state-*` | A failed request rendering as an **error with a retry**, not as an empty result set. |
| `23`–`25-vu-tree-*` | The virtual-user tree before a drag, mid-drag with the nest indicator, and after the nest — at the new 44px row height. |
