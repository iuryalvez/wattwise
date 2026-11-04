# Interface design

WattWise uses an editorial layout: a horizontal masthead, an asymmetric introduction,
an inline architectural illustration, and a ledger-like overview of estimates. The
appliance list and advisor use unequal columns on desktop and stack on narrow screens.

## Styling

The editable source is [`web/design.css`](../web/design.css). Tailwind CSS 4 theme
variables define the parchment, olive, and clay palette and the display/body font
pairing. Semantic component rules use Tailwind utilities through `@apply`.

[`web/styles.css`](../web/styles.css) is the compiled, committed output. The Python
application serves it directly. Running WattWise does not require Node, an npm
installation, a CDN, external fonts, or an image service.

To change the interface, install the development dependencies and compile:

```sh
npm ci
npm run build:css
```

During styling work, `npm run watch:css` recompiles changes automatically. Refresh
the browser after a rebuild. Commit both the source and the compiled stylesheet.
The lockfile pins the build toolchain.

## Design conventions

- Use the `@theme` variables instead of adding unrelated colors.
- Use the system Palatino/Georgia serif stack for display text and Segoe UI for body
  text. All fonts work offline.
- Prefer spacing and thin rules to card borders or shadows. Reserve the sage surface
  for the advisor and the estimate of the best proposed change.
- Keep the home illustration decorative and inline. It is not a measurement or a
  representation of the user's property.
- Keep existing translation bindings, element IDs, calculator behavior, and evidence
  labels when changing markup.
- Preserve visible keyboard focus, native dialog behavior, generous touch targets,
  reduced-motion support, and layout wrapping for translated content.

The shared stylesheet also styles the masthead, typography, controls, and dialogs
on `/monitor`; its floor-plan and telemetry-specific styles remain in
[`web/monitor.css`](../web/monitor.css).

## Mobile behavior

At 800px and below, the primary navigation becomes a fixed five-item bottom bar.
Its translated short labels supplement the full labels retained for screen readers.
The layout reserves room for this bar and device safe-area insets; notifications
appear above it. Section links update both the active style and `aria-current`.

At 600px and below, the introduction is compact and its decorative illustration is
hidden. Appliance rows place cost and edit controls below the device description.
Native dialogs become bottom sheets with sticky headings and actions, one-column
fields, independent scrolling, and dynamic-viewport height limits. Inputs use 16px
text and decimal/numeric keyboard hints. Interactive controls are at least 44px tall.

The monitoring page moves room controls below the floor plan as a large-button grid
on mobile. The desktop floor plan keeps its positioned markers.
