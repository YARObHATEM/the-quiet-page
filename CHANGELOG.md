# Changelog

## 1.2.1

- Removed tags feature for a cleaner writing experience.
- Reader content now fills full width instead of the 760px constraint.
- Removed preview text from library cards; increased folder, meta, and label
  font sizes for better readability.
- Centered the sidebar brand title and removed the trailing period.
- Fixed composer placeholder alignment — now matches the cursor position
  using dynamic padding inheritance instead of hardcoded pixel values.
- Normalized forest ambient audio volume to match other moods.
- Various UI spacing improvements.

## 1.1.3

- Added Rain, Forest, Café, Lo-fi, and Deep Space ambient writing moods.
- Bundled all recorded ambience locally and synthesized Rain and Deep Space
  through the existing Web Audio engine.
- Added persistent mood and volume controls, gentle crossfades, and automatic
  softening after eight idle seconds on the Write tab.

## 1.1.2

- Added five new local English fonts and four new local Arabic fonts alongside
  the existing Amiri default.
- Added separate English and Arabic font selectors with instant preview and
  persistent settings.
- Applied the chosen English font to LTR writing and interface labels, while
  independently applying the chosen Arabic font to RTL content.

## 1.1.1

- Added automatic titles derived from each entry's first non-empty line.
- Added title and body previews to the library with per-entry RTL support.
- Added title-aware search, import normalization, and structured exports.
- Preserved compatibility with existing entries and backups.

## 1.1.0

- Added the desktop writing journal, library, focus mode, insights, themes,
  local backups, Arabic direction support, and synthesized typing sounds.
- Hardened Electron window and IPC behavior for public distribution.
- Bundled fonts locally so the app works without network requests.
- Added Windows installer and portable release targets.
