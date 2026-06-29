# The Quiet Page

A private offline writing journal for Windows, made for Arabic and English.

The Quiet Page is a calm desktop space for drafting, journaling, and keeping
personal notes without accounts, cloud sync, ads, analytics, or background
network requests. Your writing, drafts, settings, and backups stay on your own
computer.

![The Quiet Page writing screen](docs/screenshot.png)

## Download

Latest release: [v1.2.1](https://github.com/YARObHATEM/the-quiet-page/releases/tag/v1.2.1)

- [TheQuietPage-1.2.1-Setup.exe](https://github.com/YARObHATEM/the-quiet-page/releases/download/v1.2.1/TheQuietPage-1.2.1-Setup.exe) - normal Windows installer
- [TheQuietPage-1.2.1-Portable.exe](https://github.com/YARObHATEM/the-quiet-page/releases/download/v1.2.1/TheQuietPage-1.2.1-Portable.exe) - portable version with no installation

Windows may show a SmartScreen warning because this community build is not
code-signed. The release page includes SHA-256 digests for checking the files.

## What's New in 1.2.1

- Cleaner writing flow with the tags feature removed.
- Full-width library reader for more comfortable long-form reading.
- Cleaner library cards with larger folders, metadata, and labels.
- Sidebar title polish: centered brand name, no trailing period.
- Composer placeholder alignment now follows the real cursor position.
- Forest ambience volume now matches the other ambient moods.
- Library scrolling is fixed so the list and reader move independently.

## Features

- Arabic right-to-left and English left-to-right writing.
- Local journal library with search, folders, editing, pinning, copy, import,
  and export.
- Rich writing composer with headings, bold, italic, underline, draft restore,
  and Ctrl+Enter publishing.
- Focus mode, writing statistics, day streaks, themes, typography controls,
  typewriter sounds, and ambient writing moods.
- Bundled offline Arabic and English fonts.
- JSON and plain-text backups.
- No accounts, telemetry, cloud service, or network dependency.

## Privacy

Everything stays on your computer.

On Windows, journal data is stored under:

```text
%APPDATA%\The Quiet Page
```

Uninstalling the app does not delete your writing. Back up entries from
**Settings > Export All as JSON**.

See [PRIVACY.md](PRIVACY.md) for the full privacy summary.

## Development

Requirements: Node.js 22 or newer.

```powershell
npm install
npm start
```

Create the Windows installer and portable executable:

```powershell
npm run dist
```

Artifacts are written to `dist/`.

## License

The application source is released under the [MIT License](LICENSE). Bundled
fonts and ambient audio have their own notices under `licenses/` and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
