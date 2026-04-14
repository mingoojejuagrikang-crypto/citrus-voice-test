import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  Gemma4Processor,
  TextStreamer,
  env,
  pipeline,
} from '@huggingface/transformers';

export const TRANSFORMERS_VERSION = __TRANSFORMERS_VERSION__;

let envConfigured = false;

export function ensureHFEnvironment() {
  if (envConfigured) return;
  env.allowLocalModels = false;
  try { env.useBrowserCache = true; } catch {}
  try { env.useFSCache = false; } catch {}
  try {
    env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1));
  } catch {}
  envConfigured = true;
}

export function getTransformersDiagnostics() {
  ensureHFEnvironment();
  return {
    version: TRANSFORMERS_VERSION,
    exports: {
      AutoProcessor: typeof AutoProcessor === 'function',
      Gemma4ForConditionalGeneration: typeof Gemma4ForConditionalGeneration === 'function',
      Gemma4Processor: typeof Gemma4Processor === 'function',
      TextStreamer: typeof TextStreamer === 'function',
      pipeline: typeof pipeline === 'function',
    },
  };
}

ensureHFEnvironment();

export {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  Gemma4Processor,
  TextStreamer,
  env,
  pipeline,
};
