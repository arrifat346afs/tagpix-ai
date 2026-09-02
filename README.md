<div align="center">
  <a>
    <img src="./img/desifytext.png" alt="Descify" width="250">
  </a>

  <h1 align="center">Descify</h1>

  <p align="center">
    AI-powered batch metadata generator for images — cloud APIs or <b>100% local models</b>
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

It works with **cloud AI providers** (Gemini, OpenRouter) **and with fully local models** via [LM Studio](https://lmstudio.ai/) — so your images and prompts never have to leave your machine.

![Screenshot](img/app.png)

## Features

### AI Integration
- **Gemini** (free tier available) and **OpenRouter** (paid) support
- 🏠 **Local model support** — run vision models entirely on your own machine via LM Studio (or any OpenAI-compatible server). No API key, no cost, no data leaving your device — see [Local Models](#local-models-lm-studio) below
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

## Local Models (LM Studio)

> [!TIP]
> Descify supports **running AI models locally** — great for privacy, offline work, and avoiding API costs entirely.

1. Download and install [LM Studio](https://lmstudio.ai/)
2. In LM Studio, download a **vision-capable** model (e.g. Qwen2.5-VL, or any model with a "vision" capability) and start the local server
3. Open Descify's Settings, enable the local model option, and point it to your server (default: `http://localhost:1234` — the `/v1` suffix is added automatically)
4. Pick your model from the list and start generating — no API key required

Notes:
- Works with any **OpenAI-compatible** local server, not just LM Studio
- Only **vision-capable** models can describe images (LM Studio shows a "vision" capability badge on supported models)
- Locally hosted models are well suited to **parallel processing** — tune the number of parallel workers and request delay in Settings to match your hardware

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

1. **Choose Your Provider** — Either add your Gemini/OpenRouter API key in Settings, or enable a local model via LM Studio (no key needed)
2. **Import Images** — Use the Upload button to select one or more images
3. **Select Mode** — Choose Sequential (free APIs) or Parallel (paid APIs or local models)
4. **Generate** — Click Generate to produce AI-powered metadata
5. **Review & Save** — Edit results, save metadata, or export

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | [Tauri](https://tauri.app/) 2.x |
| Frontend | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) 5.6 |
| Bundler | [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 + [Radix UI](https://www.radix-ui.com/) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/) (Google & OpenRouter providers, plus any OpenAI-compatible local server) |
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
> OpenAI is not supported because it's closeAI. The project uses Gemini (free) and OpenRouter (paid). Alternatively, run **local models** via [LM Studio](#local-models-lm-studio) — no API key required at all.

| Service | Get Key |
|---------|---------|
| Gemini | [Google AI Studio](https://aistudio.google.com/api-keys) |
| OpenRouter | [OpenRouter](https://openrouter.ai/api-keys) |

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a [pull request](https://github.com/arrifat346afs/Descify/pulls) or [issue](https://github.com/arrifat346afs/Descify/issues).

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
