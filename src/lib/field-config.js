export const FIELD_RANGE_DEFAULTS = {
  int: {allowedMin: 0, allowedMax: 999, warnMin: null, warnMax: null, reconfirmMin: null, reconfirmMax: null},
  float: {allowedMin: 0, allowedMax: 999, warnMin: null, warnMax: null, reconfirmMin: null, reconfirmMax: null},
  text: null,
  enum: null,
  boolean: null,
};

export const BUILTIN_FIELDS = {
  조사나무: {
    type: 'int',
    unit: '번',
    short: '나무',
    aliases: ['나무', '조사나무', '조사 나무', '조사나오', '나무산', '나무 섬', '나무성', '나보', '나보다', '노사 나무', '노사나무', '조사나 무', '좌사나무', '조산나무', '조사나무가', '조사나무는', '나 무', '나 귀'],
    allowedValues: [1, 2, 3, 4, 5],
    validation: {allowedMin: 1, allowedMax: 5, warnMin: 1, warnMax: 5, reconfirmMin: 0, reconfirmMax: 5},
    priority: 120,
  },
  조사과실: {
    type: 'int',
    unit: '번',
    short: '과실',
    aliases: ['과실', '조사과실', '조사 과실', '과실이', '거실', '화실', '과제', '과실로', '과실번호', '조 과실', '조사과일', '좌사과실', '조산과실', '조사괴실', '조사 가실', '조사가 실', '과일', '가실', '마실', '바실', '아실', '과시', '과 시', '마시', '다시', '마실사', '바 실상', '과 시로', '마시로', '가시도', '다시 육', '다시 일', '바질', '바지로', '과이', '화대'],
    allowedValues: [1, 2, 3, 4, 5],
    validation: {allowedMin: 1, allowedMax: 5, warnMin: 1, warnMax: 5, reconfirmMin: 0, reconfirmMax: 5},
    priority: 118,
  },
  횡경: {
    type: 'float',
    unit: 'mm',
    short: '횡',
    aliases: ['횡경', '횡경이', '변경', '변경이', '생경', '성경', '은경', '은경이', '행경', '휑경', '횡', '휑경이', '황경', '왱경', '횡견', '횡겨', '횡격', '횡겸', '형경', '혈경', '흉경', '획경', '횟경', '엔', '엔경', '엔 경', '현경', '인경', '안경', '윤경', '행정', '빙빙경', '경경', '행 경', '행 경대', '행행경', '영 경', '생 경'],
    validation: {allowedMin: 0, allowedMax: 300, warnMin: null, warnMax: 200, reconfirmMin: 0, reconfirmMax: 300},
    priority: 116,
  },
  종경: {
    type: 'float',
    unit: 'mm',
    short: '종',
    aliases: ['종경', '종경이', '존경', '정경', '중경', '동경', '종', '종견', '종겨', '종격', '종겸', '총경', '종교', '송경', '용경', '존경 탐'],
    validation: {allowedMin: 0, allowedMax: 300, warnMin: null, warnMax: 200, reconfirmMin: 0, reconfirmMax: 300},
    priority: 114,
  },
  과중: {type: 'float', unit: 'g', short: null, aliases: ['과종', '과증', '과준', '괴중', '가중', '과충', '과중이', '무게'], validation: {allowedMin: 0, allowedMax: 1000, warnMin: null, warnMax: 500, reconfirmMin: 0, reconfirmMax: 1000}, priority: 60},
  당도: {type: 'float', unit: 'Brix', short: null, aliases: ['당두', '당돋', '단도', '당동', '당독', '당또', '당토', '담도', '브릭스'], validation: {allowedMin: 0, allowedMax: 30, warnMin: null, warnMax: 20, reconfirmMin: 0, reconfirmMax: 30}, priority: 30},
  산도: {type: 'float', unit: '%', short: null, aliases: ['산돋', '산동', '삼도', '선도', '산또', '잔도', '상도'], validation: {allowedMin: 0, allowedMax: 10, warnMin: null, warnMax: 3, reconfirmMin: 0, reconfirmMax: 10}, priority: 32},
  착색: {type: 'int', unit: '', short: null, aliases: ['착생', '착섹', '착쌕', '착색이', '칙색', '탁색'], validation: {allowedMin: 0, allowedMax: 20, warnMin: null, warnMax: 10, reconfirmMin: 0, reconfirmMax: 20}, priority: 58},
  경도: {type: 'float', unit: 'N', short: null, aliases: ['경돋', '견도', '겸도', '경독', '껑도', '격도'], validation: {allowedMin: 0, allowedMax: 50, warnMin: null, warnMax: 30, reconfirmMin: 0, reconfirmMax: 50}, priority: 48},
  과피두께: {type: 'float', unit: 'mm', short: '과피', aliases: ['과피', '과피두게', '과피두깨', '과피 두께', '꽈피두께', '과피 두게', '과피 두깨', '껍질두께', '피두께'], validation: {allowedMin: 0, allowedMax: 20, warnMin: null, warnMax: 10, reconfirmMin: 0, reconfirmMax: 20}, priority: 52},
  비타민C: {type: 'float', unit: 'mg', short: '비타민', aliases: ['비타민씨', '비타민시', '비타민 씨', '비타민', '비타민c', '피타민씨', '비타민 씨가'], validation: {allowedMin: 0, allowedMax: 200, warnMin: null, warnMax: 100, reconfirmMin: 0, reconfirmMax: 200}, priority: 26},
  구연산: {type: 'float', unit: '%', short: null, aliases: ['구연삼', '구년산', '구연산이', '귀연산', '구련산', '규연산'], validation: {allowedMin: 0, allowedMax: 10, warnMin: null, warnMax: 3, reconfirmMin: 0, reconfirmMax: 10}, priority: 28},
  과즙량: {type: 'float', unit: 'mL', short: '과즙', aliases: ['과즙', '과즙량이', '과증량', '과즙양', '과즙 양', '즙량'], validation: {allowedMin: 0, allowedMax: 300, warnMin: null, warnMax: 200, reconfirmMin: 0, reconfirmMax: 300}, priority: 44},
  씨수: {type: 'int', unit: '개', short: null, aliases: ['씨수가', '시수', '씨 수', '씨숫', '씨쑤', '씨앗수'], validation: {allowedMin: 0, allowedMax: 100, warnMin: null, warnMax: 30, reconfirmMin: null, reconfirmMax: 100}, priority: 42},
  비고: {type: 'text', unit: '', short: null, aliases: ['비고란', '메모', '참고', '노트', '기타'], validation: null, noteField: true, priority: 200},
};

export function cloneFieldRegistry(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, meta]) => [key, {
      ...meta,
      aliases: [...(meta.aliases || [])],
      options: meta.options ? [...meta.options] : null,
      validation: meta.validation ? {...meta.validation} : null,
      allowedValues: meta.allowedValues ? [...meta.allowedValues] : null,
      noteField: !!meta.noteField,
      priority: meta.priority ?? 50,
      aliasSuggestions: meta.aliasSuggestions ? [...meta.aliasSuggestions] : [],
    }])
  );
}

export function createFieldRegistry(customFields = {}) {
  const merged = cloneFieldRegistry(BUILTIN_FIELDS);
  for (const [name, meta] of Object.entries(customFields)) {
    merged[name] = normalizeCustomFieldDefinition(name, meta);
  }
  return merged;
}

export function normalizeCustomFieldDefinition(name, meta = {}) {
  const type = meta.type || 'text';
  const short = meta.short || null;
  const options = Array.isArray(meta.options) ? meta.options.filter(Boolean) : splitOptions(meta.options);
  const allowedValues = Array.isArray(meta.allowedValues) ? meta.allowedValues : splitScalarOptions(meta.allowedValues);
  const exampleUtterance = meta.exampleUtterance || '';
  const aliases = uniqueStrings([
    ...(meta.aliases || []),
    ...(short ? [short] : []),
    ...generateAliasSuggestions(name, {short, exampleUtterance, type}),
  ]);
  return {
    type,
    unit: meta.unit || '',
    short,
    options,
    allowedValues,
    exampleUtterance,
    aliases,
    aliasSuggestions: uniqueStrings(generateAliasSuggestions(name, {short, exampleUtterance, type, options})),
    validation: buildValidationConfig(type, meta.validation || meta.range || null),
    noteField: !!meta.noteField,
    priority: Number(meta.priority ?? (type === 'text' ? 80 : 70)),
  };
}

export function buildValidationConfig(type, source) {
  if (type === 'text' || type === 'enum' || type === 'boolean') return null;
  const base = {...FIELD_RANGE_DEFAULTS[type]};
  if (!source) return base;
  if (Array.isArray(source) && source.length === 2) {
    return {...base, allowedMin: Number(source[0]), allowedMax: Number(source[1]), warnMin: Number(source[0]), warnMax: Number(source[1]), reconfirmMin: Number(source[0]), reconfirmMax: Number(source[1])};
  }
  return {...base, ...source};
}

export function generateAliasSuggestions(name, {short = '', exampleUtterance = '', type = 'text', options = []} = {}) {
  const canonical = String(name || '').trim();
  if (!canonical) return [];
  const compact = canonical.replace(/\s+/g, '');
  const spaced = splitHangulForSpeech(compact);
  const fieldPart = extractFieldPartFromExample(exampleUtterance, canonical);
  const variants = uniqueStrings([
    canonical,
    compact,
    spaced,
    short,
    fieldPart,
    fieldPart ? splitHangulForSpeech(fieldPart) : '',
    ...applyCommonPhoneticTransforms(compact),
    ...(fieldPart ? applyCommonPhoneticTransforms(fieldPart) : []),
    ...(type === 'enum' ? options : []),
  ]);
  return variants.filter((item) => item && item.length <= 20);
}

export function createDefaultSchemaPreset() {
  return cloneFieldRegistry(BUILTIN_FIELDS);
}

export function serializeFieldSchema(meta = {}) {
  return {
    type: meta.type || 'text',
    unit: meta.unit || '',
    aliases: [...(meta.aliases || [])],
    short: meta.short || null,
    options: meta.options ? [...meta.options] : [],
    allowedValues: meta.allowedValues ? [...meta.allowedValues] : [],
    validation: meta.validation ? {...meta.validation} : null,
    exampleUtterance: meta.exampleUtterance || '',
    noteField: !!meta.noteField,
    priority: meta.priority ?? 50,
  };
}

function extractFieldPartFromExample(exampleUtterance, canonical) {
  const text = String(exampleUtterance || '').trim();
  if (!text) return canonical;
  const match = text.match(/^([^\d"']+)/);
  return (match?.[1] || canonical).trim();
}

function splitHangulForSpeech(text) {
  if (!text || text.includes(' ')) return text;
  if (text.length <= 2) return text;
  return `${text.slice(0, -1)} ${text.slice(-1)}`;
}

function applyCommonPhoneticTransforms(text) {
  const rules = [
    [/도/g, '또'],
    [/도/g, '토'],
    [/색/g, '섹'],
    [/색/g, '쌕'],
    [/경/g, '견'],
    [/경/g, '겸'],
    [/실/g, '질'],
    [/수/g, '쑤'],
  ];
  const out = [text];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(text)) out.push(text.replace(pattern, replacement));
  }
  return out;
}

function splitOptions(value) {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function splitScalarOptions(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const num = Number(item);
      return Number.isFinite(num) && item !== '' ? num : item;
    });
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}
