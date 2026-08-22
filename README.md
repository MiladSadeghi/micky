<div align="center">
  <img src="./public/micky.png" alt="Micky" width="128" height="128" />

# Micky

**A small, Persian-first voice assistant for your desktop.**

Say what you need, let Micky do the work, and get back to your life.

[![Release](https://img.shields.io/github/v/release/xmannii/micky?style=flat-square)](https://github.com/xmannii/micky/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/xmannii/micky/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/xmannii/micky/actions/workflows/ci.yml)
[![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=flat-square&logo=apple)](https://github.com/xmannii/micky/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square&logo=windows11)](https://github.com/xmannii/micky/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-7c3aed?style=flat-square)](#license)
</div>

> [!WARNING]
> Micky is experimental software. Expect rough edges, imperfect speech recognition, and bugs. Do not rely on it for critical or irreversible work. Bug reports and pull requests are very welcome.

## What is Micky?

AI software has become too complicated. Micky takes the opposite approach: it is a compact companion, not another workspace, dashboard, or text chat.

Wake it with **«هی میکی»** ("Hey Micky") or a keyboard shortcut, speak naturally in Persian, and hear a short answer. Micky can also dictate into other apps, inspect the screen when explicitly asked, work with files, open apps, run guarded commands, remember useful context, and search past conversations.

Micky is designed around Persian. Its interface, wake phrase, speech recognition, agent behavior, and spoken responses are all Persian-first. Other languages may work through the selected language model, but they are not the primary product experience yet.

## Highlights

- 🗣️ **Persian-first voice loop** — wake, listen, think, reply, and keep listening for a natural follow-up.
- 🎙️ **Local speech recognition** — microphone audio is transcribed on-device with [Shenava](https://huggingface.co/collections/Reza2kn/shenava-10-open-streaming-persian-asr-and-captioning) and `sherpa-onnx`.
- 👂 **Local wake word** — «هی میکی» is detected on-device by bundled ONNX models.
- ⌨️ **System-wide dictation** — dictate into the active app, with optional AI cleanup and automatic paste.
- 🧠 **Your choice of model** — use OpenRouter, a custom OpenAI-compatible endpoint, Ollama, or LM Studio.
- 🔊 **Optional spoken replies** — use Gemini or ElevenLabs text-to-speech, or keep TTS disabled.
- 🧰 **Guarded desktop tools** — file access, search, app launching, commands, and screen understanding are protected by path rules, a command policy, and confirmations.
- 💬 **Local conversation archive** — conversations are stored in a local SQLite database and can be searched or resumed.
- 🧩 **Agent skills** — Micky discovers compatible skills installed through [skills.sh](https://skills.sh) and loads their instructions only when needed.

## How it works

```text
“هی میکی” or shortcut
          ↓
Local wake-word detection
          ↓
Local Shenava speech-to-text
          ↓
Selected language model + optional tools
          ↓
Short Persian reply + optional TTS
          ↓
12-second follow-up window
```

The renderer only handles the orb, microphone capture, status, settings, and the conversation archive. The Electron main process owns the conversation state machine, models, tools, permissions, persistence, and provider calls.

## Privacy and local processing

Micky is local-first, but not automatically cloud-free. What leaves your computer depends on the providers and features you choose.

| Data or feature        | Where it goes                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Wake-word audio        | Processed locally; not sent to a wake-word service                                                             |
| Speech recognition     | Processed locally by Shenava after the model is downloaded                                                     |
| Conversation history   | Stored locally in SQLite; history can be disabled or cleared                                                   |
| API keys               | Stored in the operating system keychain                                                                        |
| Agent requests         | Sent to your selected LLM endpoint; Ollama and LM Studio can remain local                                      |
| Spoken replies         | Sent to Gemini or ElevenLabs only when that optional TTS provider is enabled                                   |
| Screen content         | Captured only after an explicit screen request and disclosure, then sent to the selected vision-capable model  |
| File and command tools | Run locally and only when system tools are enabled                                                             |

There is no analytics or telemetry code in the app. For the most private setup, use a local Shenava model with Ollama or LM Studio, keep cloud TTS disabled, and leave system tools off unless you need them.

## Download

Download the latest installer from [GitHub Releases](https://github.com/xmannii/micky/releases/latest):

- **macOS Apple Silicon:** `micky-<version>-arm64.dmg`
- **Windows x64:** `micky-<version>-x64-setup.exe`

The first public builds are unsigned and the macOS builds are not notarized. macOS Gatekeeper or Windows SmartScreen may therefore show a warning. Only download Micky from this repository, and inspect or build the source yourself if that warning is not acceptable to you.

## First run

1. Open Micky and allow microphone access.
2. Download one of the offered Shenava speech models. A smaller model is faster; a larger model is usually more accurate.
3. Choose an LLM provider:
   - add an OpenRouter API key;
   - connect a custom OpenAI-compatible endpoint; or
   - use local Ollama or LM Studio.
4. Optionally configure Gemini or ElevenLabs for spoken replies.
5. Say «هی میکی», tap the orb, or use the configured shortcut.

Models and API usage may have their own licenses, privacy policies, and costs. Micky does not include paid provider access.

## Development

### Requirements

- Node.js 24.8 or newer
- pnpm 9 or newer
- macOS or Windows for the supported desktop builds

### Run locally

```bash
git clone https://github.com/xmannii/micky.git
cd micky
pnpm install
pnpm dev
```

### Validate changes

```bash
pnpm typecheck
pnpm test
pnpm build
```

### Package the app

```bash
pnpm dist
```

Installers are written to `release/`.

## Project structure

| Path                     | Responsibility                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| `src/`                   | React renderer: orb, microphone capture, status, settings, and archive |
| `src/lib/`               | Types and constants shared across Electron processes                   |
| `electron/conversation/` | Voice turn state machine and follow-up behavior                        |
| `electron/wake-word/`    | Local ONNX wake-word detector                                          |
| `electron/speech/`       | Local Shenava speech recognition process                               |
| `electron/agent/`        | Model tool loop and short Persian voice contract                       |
| `electron/system/`       | File guards, command policy, and sandboxing                            |
| `electron/chats/`        | Local SQLite persistence and full-text search                          |
| `electron/soul/`         | Personality, user profile, and memory layers                           |
| `electron/llm/`          | LLM providers and OS-keychain-backed secrets                           |

Renderer code talks to the main process only through the preload API in `electron/preload.ts` and `src/lib/desktop-api.ts`.

## Releases and CI

Every push and pull request runs typechecking and the test suite on GitHub Actions.

Release builds are intentionally version-driven. A push to `main` only starts the macOS and Windows packaging jobs when the version in `package.json` does not have a matching release tag yet. This catches a new version bump and safely retries an unpublished version after a failed workflow. After all native builds succeed, the workflow creates the matching `v<version>` GitHub Release and attaches the installers.

To prepare a future release:

1. Update `version` in `package.json`.
2. Commit and push the bump to `main`.
3. Let the release workflow test, package, tag, and publish the installers.

## Contributing

Micky is young and bugs are expected. If something breaks, please [open an issue](https://github.com/xmannii/micky/issues) with your operating system, what you expected, what happened, and any useful logs with secrets removed.

Pull requests are welcome. Keep Micky small, voice-first, and Persian-first: prefer a tool and a one-line status over a new dashboard or permanent view. Before opening a PR, run:

```bash
pnpm typecheck
pnpm test
```

Please never include API keys, private conversation data, screenshots, or downloaded model files in an issue or commit.

## Experimental software

This is an early `0.x` release. Interfaces, local data formats, prompts, provider support, and behavior may change without migration guarantees. Speech recognition can misunderstand you, language models can produce incorrect output, and tool calls can fail. Review confirmation prompts carefully and keep backups of important files.

## License

MIT. See the repository's package metadata for the current license declaration.

---

<div align="center">
  Built for speaking Persian, getting things done, and closing the computer again.
</div>
