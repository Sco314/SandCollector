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

## Current MVP

The first working extension skeleton is implemented with no build step.

Current behavior:

- Click the WhyDOM toolbar action to activate the picker
- Hover elements to highlight them and see dimensions
- Click an element to capture it without triggering the page action
- Copy a useful computed CSS block to the clipboard automatically
- Generate a stable selector where practical
- Capture a structured element snapshot for future diagnostics
- Record element geometry and overflow facts
- Record parent and ancestor layout facts
- Record stacking-context clues
- Collect matching authored CSS rules when stylesheet access is allowed
- Track inaccessible stylesheets instead of failing the capture
- Press Escape to cancel the picker

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

### 1. Inspector side panel

Create a persistent panel for dimensions, box model, layout, typography, colors, authored CSS, and copy actions.

### 2. Overflow WHY diagnostic

Answer why a selected element or its contents overflow by evaluating measured geometry and likely constraints such as fixed widths, minimum widths, flex sizing, grid tracks, white-space, replaced elements, transforms, and positioned descendants.

### 3. Try Fix

Apply a proposed change to the live page, remeasure the result, and verify whether the diagnosed problem was resolved.

### 4. Additional deterministic diagnostics

- Flex sizing and alignment
- Grid sizing and placement
- Stacking contexts and z-index
- Sticky positioning
- Positioning and containing blocks
- Visibility and covered elements
- Text wrapping and clipping

### 5. Changes

Track live fixes, undo them, and export the resulting CSS or diff.

### 6. Trace

Correlate a user interaction with events, DOM mutations, class and attribute changes, network activity, storage changes, navigation, and resulting UI state.

### 7. Source patching

Map verified browser fixes back to source rules when practical and generate a minimal patch.

## Install for development

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository root containing `manifest.json`.
6. Pin WhyDOM to the toolbar.
7. Open a normal webpage and click the WhyDOM toolbar button.

Changes to extension files require reloading the extension from `chrome://extensions`. Page changes generally require refreshing the page before testing again.

## Permission model

The MVP intentionally avoids blanket host permissions. It currently uses:

- `activeTab`
- `scripting`
- `clipboardWrite`

The content inspector is injected only after the user explicitly clicks the WhyDOM toolbar action on the current page.

## Technical baseline

- Chrome Extension Manifest V3
- Plain JavaScript, HTML, and CSS initially
- No build step for the MVP
- GitHub repository and future Actions-based release workflow
- Chrome Web Store distribution

The architecture should stay modular enough to add a UI framework or build pipeline later only if the product actually benefits from one.
