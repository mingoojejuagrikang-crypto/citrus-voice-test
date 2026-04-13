# Citrus Survey v6

Gemma 4 E2B loader and citrus survey voice PWA prototype.

## Run

```bash
npm install
npm run dev
```

Open:

- `http://127.0.0.1:4174/`
- `http://127.0.0.1:4174/benchmark.html`

## Build

```bash
npm run build
```

The production output is written to `dist/` and includes both `index.html` and `benchmark.html`.
For the current GitHub Pages `legacy` branch deployment, the repository root is updated with the built `index.html`, `benchmark.html`, and `assets/` files.

## Source Layout

- `app/`: Vite HTML entry sources
- `src/lib/`: shared runtime and Gemma loader modules
- repository root: currently committed Pages-ready build output

## What Changed

- Replaced CDN imports with bundled `@huggingface/transformers` imports via Vite.
- Added shared Hugging Face runtime setup in `src/lib/hf-runtime.js`.
- Added WebGPU-only Gemma loader and diagnostics in `src/lib/gemma-loader.js`.
- Moved editable HTML entry sources to `app/` and kept the repository root as Pages-ready static output.
- Kept Web Speech and Whisper flows independent from Gemma load success.
- Added benchmark/runtime diagnostics for:
  - Transformers.js version
  - Gemma export availability
  - WebGPU support
  - processor/model stage and error state

## Validation Notes

- `npm run build` succeeds.
- `node test_parse.mjs` passes: `12 PASS / 0 FAIL`.
- In a default headless Chromium environment without WebGPU, Gemma is disabled and the STT UI remains usable.
- In Chromium launched with WebGPU flags, the benchmark page successfully loaded `onnx-community/gemma-4-E2B-it-ONNX` with:
  - `device: webgpu`
  - `dtype: q4f16`
  - processor load success
  - model load success
- The flagged browser test observed downloads for `tokenizer.json`, `config.json`, and multiple Gemma ONNX files before reaching `ready`.

## Notes

- Gemma is treated as an experimental WebGPU-only feature.
- If WebGPU is unavailable or Gemma load fails, the app falls back to Web Speech / Whisper paths without blocking capture or UI.
