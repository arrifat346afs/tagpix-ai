<div align="center">
  <a>
    <img src="./img/desifytext.png" alt="Descify" width="250">
  </a>

  <h1 align="center">Descify</h1>

  <p align="center">
    AI-powered batch metadata generator for images
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&logoColor=white" alt="Tauri">
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  </p>
</div>

## Overview

Descify is a cross-platform desktop application that **generates titles, keywords, and descriptions for images in batch** using AI models. Built with Tauri, React, and TypeScript, it streamlines metadata workflows for stock photographers, e-commerce catalogs, and content managers.

![Screenshot](img/app.png)

## Features

### AI Integration
- **Gemini** (free tier available) and **OpenRouter** (paid) support
-Supports local AI models via LM Studio (optional).
- Configurable AI prompt templates with variables (`${titleLimit}`, `${descriptionLimit}`, `${keywordLimit}`, `${fileName}`, `${currentDate}`)
- Built-in preset templates for **Stock Photo**, **Product Catalog**, and **Social Media**
- Create and save custom templates with custom instructions
- **Avoid Words** list to exclude specific terms from generated metadata

### Processing
- **Batch processing** for multiple images at once
- **Sequential mode** — process one by one to avoid rate limiting on free/trial API keys
- **Parallel mode** — process up to 5 images simultaneously with paid API keys
- Configurable **request delay** (0–10s) between AI requests
- ExifTool integration for embedding metadata directly into image files
- **Vector file support** — `.ai` (Adobe Illustrator) and `.eps` files are accepted and rasterized via Ghostscript for thumbnails and AI analysis (metadata embedding is skipped for these formats — use CSV export instead)

### Management
- Secure API key storage (Gemini & OpenRouter)
- Category tagging and organization
- Metadata export and embedding

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+) and [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/) and Cargo (for Tauri)
- [ExifTool](https://exiftool.org/) (optional, for metadata embedding)
- [Ghostscript](https://ghostscript.com/) (optional, for `.ai`/`.eps` vector file support)

> [!NOTE]
> Ghostscript is detected at runtime and is never bundled with the app. Linux: `sudo apt install ghostscript` · macOS: `brew install ghostscript` · Windows: download from [ghostscript.com/releases](https://ghostscript.com/releases/gsdnld.html). Without it, `.ai`/`.eps` files cannot be rasterized for thumbnails or AI analysis.

### Installation

```bash
git clone https://github.com/arrifat346afs/Descify.git
cd Descify
pnpm install
```

### Development

```bash
pnpm run tauri dev
```

### Production Build

```bash
pnpm run tauri build
```

## Usage

1. **Configure API Keys** — Open Settings and add your Gemini or OpenRouter key
2. **Import Images** — Use the Upload button to select one or more images
3. **Select Mode** — Choose Sequential (free APIs) or Parallel (paid APIs)
4. **Generate** — Click Generate to produce AI-powered metadata
5. **Review & Save** — Edit results, save metadata, or export

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | [Tauri](https://tauri.app/) 2.x |
| Frontend | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) 5.6 |
| Bundler | [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 + [Radix UI](https://www.radix-ui.com/) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/) (Google & OpenRouter providers) |
| State | [Redux Toolkit](https://redux-toolkit.js.org/) |
| Backend (Rust) | Tauri commands for file I/O, ExifTool, and OS integration |

## Project Structure

```
Descify/
├── src/                # React application source
│   └── app/            # Application components
├── src-tauri/          # Tauri Rust backend
├── public/             # Static assets
├── img/                # Logo & screenshots
├── scripts/            # Utility scripts
├── package.json
└── vite.config.ts
```

## API Keys

> [!WARNING]
> OpenAI is not supported. The project uses Gemini (free) and OpenRouter (paid).

| Service | Get Key |
|---------|---------|
| Gemini | [Google AI Studio](https://aistudio.google.com/api-keys) |
| OpenRouter | [OpenRouter](https://openrouter.ai/api-keys) |

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a [pull request](https://github.com/arrifat346afs/Descify/pulls) or [issue](https://github.com/arrifat346afs/Descify/issues).

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
