import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  ensureHFEnvironment,
  getTransformersDiagnostics,
} from './hf-runtime.js';

export const GEMMA_LOAD_STATES = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  failed: 'failed',
});

export const GEMMA_MODEL_CONFIGS = {
  'gemma-4-e2b': {
    key: 'gemma-4-e2b',
    label: 'Gemma 4 E2B (~500MB)',
    modelId: 'onnx-community/gemma-4-E2B-it-ONNX',
    device: 'webgpu',
    dtype: 'q4f16',
    experimental: true,
  },
};

export const GEMMA_DEFAULT_MODEL_KEY = 'gemma-4-e2b';

export function getGemmaConfig(modelKey = GEMMA_DEFAULT_MODEL_KEY) {
  return GEMMA_MODEL_CONFIGS[modelKey] || GEMMA_MODEL_CONFIGS[GEMMA_DEFAULT_MODEL_KEY];
}

export function sanitizeGemmaModelKey(value) {
  if (!value) return GEMMA_DEFAULT_MODEL_KEY;
  if (Object.prototype.hasOwnProperty.call(GEMMA_MODEL_CONFIGS, value)) return value;
  if (value === getGemmaConfig().modelId) return GEMMA_DEFAULT_MODEL_KEY;
  return GEMMA_DEFAULT_MODEL_KEY;
}

export async function detectWebGPU() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const result = {
    supported: false,
    hasNavigatorGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    isSecureContext: typeof window === 'undefined' ? true : window.isSecureContext !== false,
    isIOS,
    adapter: null,
    adapterInfo: null,
    reason: '',
    error: null,
  };

  if (isIOS) {
    result.reason = 'iOS/iPadOS에서는 WebGPU LLM을 지원하지 않습니다. 규칙 파서만 사용합니다.';
    return result;
  }
  if (!result.isSecureContext) {
    result.reason = '보안 컨텍스트(https) 환경이 아닙니다.';
    return result;
  }
  if (!result.hasNavigatorGpu) {
    result.reason = 'navigator.gpu를 사용할 수 없습니다.';
    return result;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      result.reason = '사용 가능한 WebGPU 어댑터를 찾지 못했습니다.';
      return result;
    }
    result.supported = true;
    result.adapter = adapter;
    result.adapterInfo = adapter.info || null;
    return result;
  } catch (error) {
    result.reason = error?.message || 'WebGPU 초기화에 실패했습니다.';
    result.error = normalizeError(error);
    return result;
  }
}

export function getGemmaRuntimeDiagnostics() {
  const runtime = getTransformersDiagnostics();
  return {
    ...runtime,
    exports: {
      ...runtime.exports,
      TextStreamer: typeof TextStreamer === 'function',
    },
  };
}

export async function loadGemmaRuntime({
  modelId,
  device = 'webgpu',
  dtype = 'q4f16',
  onLog,
  onStateChange,
} = {}) {
  ensureHFEnvironment();
  const runtime = getGemmaRuntimeDiagnostics();
  const startedAt = performance.now();
  const base = {
    modelId,
    device,
    dtype,
    runtime,
  };

  emitState(onStateChange, {status: GEMMA_LOAD_STATES.loading, stage: 'start', ...base});
  emitLog(onLog, 'info', '모델 로드 시작', `${modelId} (${device}, ${dtype})`);

  if (!runtime.exports.AutoProcessor) {
    const error = new Error('현재 설치된 transformers 패키지에서 AutoProcessor export를 찾을 수 없습니다.');
    emitState(onStateChange, {status: GEMMA_LOAD_STATES.failed, stage: 'exports', error, ...base});
    emitLog(onLog, 'error', 'export 확인 실패', error.message);
    throw error;
  }
  if (!runtime.exports.Gemma4ForConditionalGeneration) {
    const error = new Error('현재 설치된 transformers 패키지에서 Gemma4ForConditionalGeneration export를 찾을 수 없습니다.');
    emitState(onStateChange, {status: GEMMA_LOAD_STATES.failed, stage: 'exports', error, ...base});
    emitLog(onLog, 'error', 'export 확인 실패', error.message);
    throw error;
  }

  const webgpu = await detectWebGPU();
  if (!webgpu.supported) {
    const error = new Error(webgpu.reason || 'WebGPU를 사용할 수 없습니다.');
    emitState(onStateChange, {status: GEMMA_LOAD_STATES.failed, stage: 'webgpu', error, webgpu, ...base});
    emitLog(onLog, 'warn', 'WebGPU 확인 실패', error.message);
    throw error;
  }

  emitLog(onLog, 'info', 'WebGPU 확인 완료', webgpu.adapterInfo?.description || 'adapter ready');

  const progress = makeProgressTracker(onLog, onStateChange, base);

  try {
    emitState(onStateChange, {status: GEMMA_LOAD_STATES.loading, stage: 'processor', webgpu, ...base});
    emitLog(onLog, 'info', 'processor 로드 시작', modelId);
    const processor = await AutoProcessor.from_pretrained(modelId, {
      progress_callback: (event) => progress('processor', event),
    });
    progress.markStageComplete('processor');
    emitLog(onLog, 'info', 'processor 로드 완료');

    emitState(onStateChange, {status: GEMMA_LOAD_STATES.loading, stage: 'model', webgpu, processor, ...base});
    emitLog(onLog, 'info', 'model 로드 시작', `${device}, ${dtype}`);
    const model = await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
      device,
      dtype,
      progress_callback: (event) => progress('model', event),
    });
    progress.markStageComplete('model');
    emitLog(onLog, 'info', 'model 로드 완료');

    const ready = {
      status: GEMMA_LOAD_STATES.ready,
      stage: 'ready',
      processor,
      model,
      webgpu,
      loadMs: Math.round(performance.now() - startedAt),
      ...base,
    };
    emitState(onStateChange, ready);
    emitLog(onLog, 'info', '최종 ready', `${ready.loadMs}ms`);
    return ready;
  } catch (error) {
    const normalized = normalizeError(error);
    emitState(onStateChange, {
      status: GEMMA_LOAD_STATES.failed,
      stage: progress.lastStage || 'model',
      error: normalized,
      webgpu,
      ...base,
    });
    emitLog(onLog, 'error', '최종 failed', normalized.message);
    throw normalized;
  }
}

function makeProgressTracker(onLog, onStateChange, base) {
  const STAGE_WEIGHTS = {
    processor: 15,
    model: 85,
  };
  const state = {
    stages: new Map(),
    maxPercent: 0,
    lastLogKey: '',
  };

  const tracker = (stage, event) => {
    tracker.lastStage = stage;
    const detail = normalizeProgressEvent(state, stage, event, STAGE_WEIGHTS);
    emitState(onStateChange, {
      status: GEMMA_LOAD_STATES.loading,
      stage,
      progress: detail,
      rawProgress: event,
      ...base,
    });
    const logKey = `${stage}:${detail.percent}:${detail.currentFile || ''}:${detail.status}:${detail.stagePercent}`;
    if (state.lastLogKey !== logKey) {
      state.lastLogKey = logKey;
      emitLog(onLog, 'progress', `${stage} progress`, formatProgressMessage(detail));
    }
  };
  tracker.lastStage = 'start';
  tracker.markStageComplete = (stage) => {
    getStageState(state, stage).complete = true;
  };
  return tracker;
}

function normalizeProgressEvent(state, stage, event, weights) {
  const raw = normalizeProgress(event);
  const stageState = getStageState(state, stage);
  const fileKey = `${stage}:${raw.file || raw.status || 'unknown'}`;

  if (raw.total > 0 || raw.loaded > 0) {
    const prev = stageState.files.get(fileKey) || {file: raw.file || '', loaded: 0, total: 0};
    const nextTotal = Math.max(prev.total || 0, raw.total || 0);
    const maxLoaded = Math.max(prev.loaded || 0, raw.loaded || 0, raw.status === 'done' ? nextTotal : 0);
    stageState.files.set(fileKey, {
      file: raw.file || prev.file || '',
      loaded: nextTotal > 0 ? Math.min(nextTotal, maxLoaded) : maxLoaded,
      total: nextTotal,
    });
  }

  if (raw.status === 'done') {
    stageState.complete = true;
  }

  const stageTotals = [...stageState.files.values()].reduce((acc, file) => {
    acc.loaded += Math.max(0, Number(file.loaded || 0));
    acc.total += Math.max(0, Number(file.total || 0));
    return acc;
  }, {loaded: 0, total: 0});

  const stagePercent = raw.percent !== null
    ? raw.percent
    : stageTotals.total > 0
      ? Math.max(0, Math.min(100, Math.round((stageTotals.loaded / stageTotals.total) * 100)))
      : 0;
  const normalizedStagePercent = stageState.complete ? 100 : stagePercent;
  const completedWeightPercent = Object.entries(weights).reduce((acc, [name, weight]) => {
    if (name === stage) return acc;
    return acc + (getStageState(state, name).complete ? weight : 0);
  }, 0);
  const currentWeightedPercent = completedWeightPercent + ((normalizedStagePercent / 100) * (weights[stage] || 0));
  state.maxPercent = Math.max(state.maxPercent, Math.round(currentWeightedPercent));

  // Accumulate across ALL stages for a single monotonic total
  const allTotals = [...state.stages.values()].reduce((acc, s) => {
    for (const f of s.files.values()) {
      acc.loaded += Math.max(0, Number(f.loaded || 0));
      acc.total += Math.max(0, Number(f.total || 0));
    }
    return acc;
  }, {loaded: 0, total: 0});

  return {
    ...raw,
    currentFile: raw.file || '',
    stageLoaded: stageTotals.loaded,
    stageTotal: stageTotals.total,
    stagePercent: normalizedStagePercent,
    allLoaded: allTotals.loaded,
    allTotal: allTotals.total,
    percent: state.maxPercent || raw.percent,
  };
}

function getStageState(state, stage) {
  if (!state.stages.has(stage)) {
    state.stages.set(stage, {
      complete: false,
      files: new Map(),
    });
  }
  return state.stages.get(stage);
}

function normalizeProgress(event) {
  const total = Number(event?.total ?? 0);
  const loaded = Number(event?.loaded ?? 0);
  const percent = Number.isFinite(Number(event?.progress))
    ? Math.max(0, Math.min(100, Math.round(Number(event.progress))))
    : total > 0
      ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
      : null;

  return {
    status: event?.status || 'unknown',
    file: event?.file || '',
    loaded,
    total,
    percent,
  };
}

function formatProgressMessage(detail) {
  const parts = [];
  if (detail.percent !== null) parts.push(`total ${detail.percent}%`);
  if (detail.stageTotal > 0) {
    parts.push(`${toMb(detail.stageLoaded)}/${toMb(detail.stageTotal)}MB`);
  }
  if (detail.currentFile) parts.push(detail.currentFile);
  if (detail.stagePercent !== null) parts.push(`stage ${detail.stagePercent}%`);
  return parts.join(' ') || detail.status;
}

function toMb(bytes) {
  return (bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1);
}

export function buildGemmaPrompt(rawText, fieldList, aliasHints) {
  return `감귤조사 보정.\n항목: ${fieldList.join(', ')}\n사전: ${aliasHints.join(', ')}\n입력: "${rawText}"\n보정결과만:`;
}

export async function buildGemmaInputs(processor, promptText) {
  let formattedPrompt = promptText;

  try {
    if (typeof processor.apply_chat_template === 'function') {
      formattedPrompt = processor.apply_chat_template(
        [{role: 'user', content: [{type: 'text', text: promptText}]}],
        {tokenize: false, add_generation_prompt: true}
      );
    }
  } catch {
    try {
      if (typeof processor.apply_chat_template === 'function') {
        formattedPrompt = processor.apply_chat_template(
          [{role: 'user', content: promptText}],
          {tokenize: false, add_generation_prompt: true}
        );
      }
    } catch {}
  }

  try {
    return {
      formattedPrompt,
      inputs: await processor(formattedPrompt, null, null, {add_special_tokens: false}),
    };
  } catch {
    return {
      formattedPrompt,
      inputs: await processor(formattedPrompt),
    };
  }
}

export function getInputTokenLength(inputs) {
  const dims = inputs?.input_ids?.dims;
  if (Array.isArray(dims) && dims.length) return dims[dims.length - 1];
  const values = inputs?.input_ids?.[0];
  if (Array.isArray(values)) return values.length;
  return 0;
}

export function decodeInputText(processor, inputs) {
  try {
    if (typeof processor.batch_decode === 'function') {
      return processor.batch_decode(inputs.input_ids, {skip_special_tokens: true})[0] || '';
    }
  } catch {}
  try {
    if (typeof processor.decode === 'function' && inputs?.input_ids?.[0]) {
      return processor.decode(inputs.input_ids[0], {skip_special_tokens: true}) || '';
    }
  } catch {}
  return '';
}

export function extractGemmaOutputText(processor, outputIds, inputs, formattedPrompt) {
  const inputLen = getInputTokenLength(inputs);

  try {
    if (typeof outputIds?.slice === 'function' && inputLen) {
      const generatedTokens = outputIds.slice(null, [inputLen, null]);
      const generated = processor.batch_decode(generatedTokens, {skip_special_tokens: true})[0] || '';
      const trimmed = generated.trim().split('\n')[0].trim();
      if (trimmed) return trimmed;
    }
  } catch {}

  try {
    const fullDecoded = processor.batch_decode(outputIds, {skip_special_tokens: true})[0] || '';
    const inputDecoded = decodeInputText(processor, inputs);
    const afterPrompt = inputDecoded
      ? fullDecoded.slice(inputDecoded.length).trim()
      : fullDecoded.replace(formattedPrompt, '').trim();
    const firstLine = afterPrompt.split('\n')[0].trim();
    if (firstLine) return firstLine;
    const idx = Math.max(fullDecoded.lastIndexOf('보정:'), fullDecoded.lastIndexOf('보정결과만:'));
    if (idx >= 0) return fullDecoded.slice(idx).replace(/보정[결과만]*:/, '').trim().split('\n')[0].trim();
    return fullDecoded.trim().split('\n').slice(-1)[0].trim();
  } catch {
    return '';
  }
}

export async function runGemmaTextCorrection({
  processor,
  model,
  rawText,
  fieldList,
  aliasHints,
  maxNewTokens = 10,
}) {
  const promptText = buildGemmaPrompt(rawText, fieldList, aliasHints);
  const {formattedPrompt, inputs} = await buildGemmaInputs(processor, promptText);
  const startedAt = performance.now();
  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens,
    do_sample: false,
    temperature: 0.1,
  });
  const text = extractGemmaOutputText(processor, outputs, inputs, formattedPrompt);
  return {
    text,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

export async function runGemmaPrompt({
  processor,
  model,
  promptText,
  maxNewTokens = 128,
  doSample = false,
  temperature = 0.1,
}) {
  const {formattedPrompt, inputs} = await buildGemmaInputs(processor, promptText);
  const startedAt = performance.now();
  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens,
    do_sample: doSample,
    temperature,
  });
  const text = extractGemmaOutputText(processor, outputs, inputs, formattedPrompt);
  return {
    text,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

function emitLog(onLog, level, message, detail = '') {
  if (!onLog) return;
  onLog({
    ts: new Date().toISOString(),
    level,
    message,
    detail,
  });
}

function emitState(onStateChange, state) {
  if (!onStateChange) return;
  onStateChange(state);
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}
