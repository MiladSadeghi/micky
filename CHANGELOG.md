# Changelog

All notable changes to Micky are documented here.

## 0.0.4 — 2026-08-21

### Added

- Shortcut flyover now accepts typing as well as speech: the first keystroke stops the mic, the same card shows the draft, and Enter sends it through the existing turn machine.
- Live streamed transcripts and replies in the flyover, with a blinking caret and keyboard hint so typing is obvious at a glance.
- Automatic left-to-right layout when a draft or reply starts in English.
- Listen and confirm earcons for the shortcut flyover.

### Changed

- Wake-word flyover stays voice-only and does not steal keyboard focus.
- Typed replies stay on screen instead of jumping back to listen after a few seconds.
- Screen capture can keep the flyover visible by excluding it from the screenshot on macOS and Windows.

## 0.0.3 — 2026-08-21

### Added

- Persistent light and dark appearance modes.
- A privacy-conscious system font picker that loads only on request, supports search, and remembers the selected font.
- Vazirmatn as the bundled default font, with a tribute to its creator, the late Saber Rastikerdar.

### Changed

- Removed the licensed Modam font from the app and ignore it locally.
