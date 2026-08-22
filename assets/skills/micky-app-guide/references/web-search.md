# Web search setup

Open `تنظیمات → جستجوی وب`. The `search_web` tool is available only when at least one provider is enabled and usable. Searching finds result titles, addresses, and snippets; Micky can separately read a selected public page when more detail is needed.

## Provider choices

### Exa

- Best default when the user wants a dedicated search API.
- Requires an Exa API key before its switch can be enabled.
- Press `گرفتن کلید`, sign in on Exa's official page, create a key, paste it into the password field, press `ذخیره`, then enable Exa.

### Firecrawl

- Returns search results, URLs, and summaries; Micky's separate page reader handles full public-page reading.
- The API key is optional in Micky. It can be enabled without a key, while adding one may raise provider-side limits.
- Use `گرفتن کلید`, paste and save it, then enable Firecrawl when a key is desired.

### Google محلی

- Experimental and requires no API key.
- Sends an anonymous Google search from the computer's public IP.
- It can fail because of CAPTCHA, consent pages, or markup changes. It is local only in the sense that Micky makes the request directly; the query still goes to Google.

## Choosing and fallback

Multiple providers can be enabled. Micky normally uses an available default and may fall back when a provider fails. If reliability matters, enable a dedicated API provider rather than depending only on experimental Google search.

## Safety and privacy

- Never ask for an API key in conversation or accept one for memory. The user should paste it only into Settings; Micky stores it in the OS keychain.
- Search queries and network metadata go to the selected provider. Opening a result sends a normal public-page request to that site.
- Web search cannot access signed-in browser sessions, private pages, local-network URLs, or paywalled account content.
- Provider quotas and pricing change. Use official current documentation when the user asks about them.

## Troubleshooting

- Switch unavailable: Exa has no saved key, or the OS keychain is unavailable.
- Tool still unavailable: no usable provider is enabled; save any required key and turn on its provider switch.
- Exa or Firecrawl fails: verify the saved key and provider account status, then try the other enabled provider.
- Google fails: CAPTCHA or page changes are common; enable Exa or Firecrawl instead.
- Results are too shallow: ask Micky to open/read the strongest result, or give it the exact public URL.
