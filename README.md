# SandCollector

Chrome extension project for web developers to inspect, capture, understand, edit, verify, and export CSS and UI components from webpages.

This is a standalone project and is separate from Transcript Collector.

## Product direction

The extension should make basic CSS collection extremely fast while extending the workflow beyond a normal CSS copier.

Core workflow:

**Capture → isolate → render → compare → diagnose → repair → simplify → export**

## Initial product goals

- One click element inspection and CSS copying
- Hover element picker
- Authored CSS and computed CSS views
- Reliable selector generation
- Pseudo element support
- Inherited style tracing
- CSS variable tracing
- Media query and responsive rule capture
- Portable component capture
- CSS dependency discovery
- Isolated component rendering
- Visual fidelity comparison against the source
- Render verified CSS cleanup and minimization
- CSS provenance: where a rendered value came from and why it won
- Visual editing of spacing, sizing, layout, typography, and other styles
- Responsive and interaction state verification
- Export of clean CSS and component code
- Future project aware adaptation to existing design tokens or Tailwind configuration

## Key differentiator

Do not stop at copying CSS.

SandCollector should determine what a selected component actually depends on, reproduce it outside the source page, verify that the reproduction matches, diagnose missing dependencies, and produce the smallest portable version that still renders correctly.

## Working capture modes

### Exact

Preserve the source site's authored implementation as closely as practical.

### Portable

Include or resolve the dependencies required for the captured component to work outside the source page.

### Clean

Produce a render verified minimal implementation with unnecessary CSS removed while preserving visual fidelity.

## Technical baseline

- Chrome Extension
- Manifest V3
- GitHub repository and Actions based build/release workflow
- Chrome Web Store distribution

Implementation architecture, permissions, build tooling, UI framework, and final extension name are intentionally not locked yet.
