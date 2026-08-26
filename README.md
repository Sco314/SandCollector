# WhyDOM

WhyDOM is a Chrome extension for web developers that starts as a fast, free CSS inspector and grows into an element-centered front-end debugger.

The repository is still named `SandCollector` while the public product name is being validated.

## Product thesis

**Click the thing that is wrong. Understand why it looks or behaves that way. Test a fix.**

Basic inspection and CSS copying are the acquisition utility. The differentiated product is the WHY engine: deterministic diagnostics that explain the browser constraints actually responsible for layout and UI behavior.

Core workflow:

**Inspect → Copy → Explain → Test → Verify → Change**

Future interaction workflow:

**Trace → Correlate → Explain → Patch**

## Current build: v0.2.0

Current behavior:

- Click the WhyDOM toolbar action to open the inspector side panel and activate the picker
- Hover elements to highlight them and see dimensions
- Click an element to capture it without triggering the page action
- Keep the picker active after a capture so multiple elements can be inspected in one session
- Switch away from the page and return without intentionally ending that page's inspection session
- Press Escape or click the toolbar action again to end the picker session
- Copy a useful computed CSS block to the clipboard automatically on every capture
- Show the latest capture in a persistent side panel
- Copy CSS, selector, or HTML from the side panel
- Prefer short, stable unique selectors before using ancestor chains or positional selectors
- Capture a structured element snapshot for future diagnostics
- Record element geometry and overflow facts
- Record parent and ancestor layout facts
- Record stacking-context clues
- Collect matching authored CSS rules when stylesheet access is allowed
- Track inaccessible stylesheets instead of failing the capture
- Store the latest snapshot per tab for the current browser session

## Inspector side panel

The current INSPECT panel shows:

- selected selector
- width and height
- display and positioning mode
- box sizing and min/max width
- overflow settings and measured overflow warning
- z-index
- parent selector and layout facts
- stacking-context reasons when detected
- generated useful CSS
- element text preview
- matching authored rule count
- copy CSS, selector, and HTML actions

The WHY, TRACE, and CHANGES tabs are visible as product direction but are not enabled yet.

## Element snapshot foundation

Each capture is structured around an element snapshot rather than a one-off CSS string. The current snapshot includes:

- identity
- selector
- DOM preview
- computed styles
- inline styles
- matched authored rules
- geometry
- scroll and overflow measurements
- layout facts
- parent layout facts
- ancestor layout facts
- stacking-context reasons

This data model is intended to support the WHY engine without replacing the free inspector implementation.

## Next development milestones

### 1. Overflow WHY diagnostic

Answer why a selected element or its contents overflow by evaluating measured geometry and constraints such as fixed widths, minimum widths, flex sizing, grid tracks, white-space, replaced elements, transforms, and positioned descendants.

The first diagnostic should return evidence, a primary cause when confidence is high, and one or more testable fixes rather than a generic list of possibilities.

### 2. Try Fix + verification

Apply a proposed change to the live page, remeasure the result, and verify whether the diagnosed problem was resolved. Support undo immediately.

### 3. Flex WHY diagnostic

Explain common flex failures such as a child that will not shrink, unexpected stretching, alignment surprises, and width controlled by flex-basis or intrinsic content.

### 4. Stacking context / z-index WHY diagnostic

Build and explain the relevant stacking-context chain and identify the ancestor that prevents a high z-index from winning.

### 5. Sticky WHY diagnostic

Explain sticky failures using scroll ancestors, overflow, containing geometry, inset requirements, and element/container dimensions.

### 6. CHANGES

Track live fixes, undo them, and export the resulting CSS or diff.

### 7. State comparison

Capture state A and state B and compare DOM attributes/classes, computed styles, children, ARIA state, and relevant layout changes.

### 8. TRACE

Correlate a user interaction with events, DOM mutations, class and attribute changes, network activity, storage changes, navigation, and resulting UI state.

### 9. Source patching

Map verified browser fixes back to source rules when practical and generate a minimal patch.

## Install for development

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository root containing `manifest.json`.
6. Pin WhyDOM to the toolbar.
7. Open a normal webpage and click the WhyDOM toolbar button.

After changing extension files, reload WhyDOM from `chrome://extensions` and refresh the page being tested.

## Permission model

WhyDOM avoids blanket host permissions. The current build uses:

- `activeTab`
- `scripting`
- `clipboardWrite`
- `storage`
- `sidePanel`

The content inspector is injected only after the user explicitly clicks the WhyDOM toolbar action on the current page. Session storage is used for the latest captured snapshot for each tab; the current build does not send captured page data to a remote service.

## Build artifacts

GitHub Actions validates the Manifest V3 package and required extension files, builds a clean unpacked directory, creates a ZIP, and uploads both as short-lived workflow artifacts on relevant pushes or manual runs.

## Technical baseline

- Chrome Extension Manifest V3
- Plain JavaScript, HTML, and CSS initially
- No application bundler required for the current build
- GitHub Actions build and test-artifact workflow
- Chrome Web Store distribution target

The architecture should stay modular enough to add a UI framework or build pipeline later only if the product actually benefits from one.
