# Models and voice setup

The UI paths are `تنظیمات → شنیدن`, `تنظیمات → مغز (مدل AI)`, and `تنظیمات → حرف‌زدن`.

## Listening: local Shenava

Micky's speech recognition is local and requires one downloaded model:

- `شنوا کوچیک` is the default recommendation for most modern computers. It is larger and more accurate.
- `شنوا ریزه` is lighter and faster for older or low-power computers.

In `شنیدن`, press `دانلود` beside the model. When the download finishes, press `انتخاب` if it is not already active. The same section chooses the input microphone. Do not tell users to obtain a Shenava API key; none is needed.

## Cloud brain: OpenRouter

OpenRouter is the simplest cloud setup and requires the user's own API key:

1. Open `تنظیمات → مغز (مدل AI)` and select `OpenRouter`.
2. Press `دریافت کلید`; the official OpenRouter key page opens. The user signs in and creates a key there.
3. Paste the key into `کلید API` and press `ذخیره`. Never ask the user to speak it.
4. Select a curated model. A different OpenRouter model can be added by entering its exact `provider/model` ID.

Micky does not bundle OpenRouter credit. Provider pricing, limits, and model availability can change; verify those on official pages when asked.

## Local brain: Ollama

Micky connects to an Ollama server; it does not download Ollama language models itself.

1. Install Ollama from its official source, obtain a tool-capable model supported by that installation, and keep the Ollama service running.
2. In `مغز (مدل AI)`, select `Ollama`.
3. The normal local endpoint is `http://localhost:11434/v1`. Change it only if the server uses another host or port, then press `بررسی`.
4. Refresh the model list and choose a model. If discovery fails, enter the exact local model ID.

If Micky cannot connect, check that Ollama is running, the model is already present in Ollama, the port matches, and local firewall software is not blocking it. Do not promise that every local model supports reliable tool calling or Persian; recommend testing a tool-capable multilingual model.

## Local brain: LM Studio

Micky connects to LM Studio's OpenAI-compatible local server:

1. In LM Studio, download and load a suitable model, then start its local server.
2. In `مغز (مدل AI)`, select `LM Studio`.
3. The normal endpoint is `http://localhost:1234/v1`. Change it if LM Studio shows another address, then press `بررسی`.
4. Refresh and select the loaded model, or enter its exact model ID.

LM Studio and Ollama usually need no API key on their default local setup. Micky still offers an optional key field for servers configured to require one.

## Custom OpenAI-compatible brain

Use `سفارشی` for another OpenAI-compatible local or remote API:

1. Enter the complete base URL, normally ending in `/v1`, and press `بررسی`.
2. Paste an API key only if that server requires one.
3. Refresh the catalog or enter the exact model ID and select it.

Whether this is local or cloud depends entirely on the entered address. Do not call a custom endpoint private or local without checking where it points.

## Brain tuning

The advanced area controls response randomness (`دما`) and reasoning effort for models that advertise reasoning support. A lower temperature is more predictable; higher is more varied. The app ignores a custom reasoning effort when the active model does not support it.

## Optional spoken replies

In `تنظیمات → حرف‌زدن`:

- Turn `صدای میکی` off for written replies with no TTS request.
- For Gemini, press `گرفتن کلید`, create a key on the official Google AI Studio page, paste and save it, select a voice, then use `شنیدن نمونه`.
- For ElevenLabs, use its `گرفتن کلید` button, paste and save the key, refresh/select a voice or enter a voice ID, and preview it.
- Choose the output audio device in the same section.

Spoken reply text is sent to the chosen TTS provider. TTS keys are separate from the brain key: a Gemini TTS key does not configure OpenRouter, and an OpenRouter key does not configure speech.

## Keychain errors

Keys are stored in the operating-system keychain. If the UI says the keychain is unavailable, do not work around it by writing keys to files. On Linux, the user needs a functioning GNOME Keyring or KWallet session. Local no-key services can still work.
