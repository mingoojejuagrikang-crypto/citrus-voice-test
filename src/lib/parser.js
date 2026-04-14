const UNIT_RE = /(밀리미터|미리미터|밀리|미리|mm|엠엠|브릭스|brix|퍼센트|프로|그램|그람|g|개|번|ml|미리리터)$/i;
const TRAILING_PUNCT_RE = /[.,!?。、，]+$/g;
const INTERNAL_PUNCT_RE = /[!?。、，]/g;
const PARTICLE_RE = /(은|는|이|가|을|를|에|의|으로|로|하고|랑)$/;
const NOISE_NUMBER_RE = /^\d{7,}$/;
const ARABIC_NUMBER_RE = /^\d+(?:\.\d+)?$/;
const DECIMAL_INCOMPLETE_RE = /^(.+?)(?:점|\.)$/;
const EXPLICIT_CORRECTION_RE = /^(수정|정정)\s+(.+)$/;
const NOTE_ALIASES = ['비고', '메모', '참고', '노트', '기타', '비고란'];
const OVERWRITE_WINDOW_MS = 1500;

const KOREAN_DIGITS = {
  영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9,
  하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
};

const COUNTER_DIGITS = {
  ...KOREAN_DIGITS,
  다: 4,
  라: 4,
  로: 5,
  위: 2,
  호: 5,
  고: 5,
  보: 5,
  귀: 1,
  기: 1,
  길: 1,
  무: 2,
  휠: 1,
};

const SINGLE_DIGIT_WORDS = Object.keys(COUNTER_DIGITS).sort((a, b) => b.length - a.length);
const PENDING_MS_BY_FIELD = {
  조사나무: 900,
  조사과실: 900,
  횡경: 1450,
  종경: 1450,
};

export function normalizeTranscript(text) {
  return String(text || '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(TRAILING_PUNCT_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fieldKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(INTERNAL_PUNCT_RE, '')
    .replace(UNIT_RE, '')
    .replace(PARTICLE_RE, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({length: m + 1}, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}

function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - (levenshtein(a, b) / max);
}

function buildAliasRegex(alias) {
  const compact = String(alias || '').replace(/\s+/g, '');
  return new RegExp(`^${compact.split('').map(escapeRegExp).join('\\s*')}(.*)$`, 'i');
}

function splitTokens(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function stripUnits(text) {
  return String(text || '').trim().replace(UNIT_RE, '').trim();
}

function collapseNoiseTokens(text) {
  const tokens = splitTokens(text).filter((token, index, list) => {
    const numeric = token.replace(/[,\s]/g, '');
    if (!NOISE_NUMBER_RE.test(numeric)) return true;
    const otherNumericExists = list.some((other, otherIndex) => otherIndex !== index && /[\d점.]/.test(other));
    return !otherNumericExists;
  });
  return tokens.join(' ').trim();
}

function normalizeNumberPhrase(text) {
  return collapseNoiseTokens(
    stripUnits(text)
      .replace(/,/g, '')
      .replace(/\s*쩜\s*/g, '점')
      .replace(/\s*점\s*/g, '점')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s+/g, ' ')
  );
}

function parseKoreanInteger(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return Number(source);
  if (KOREAN_DIGITS[source] !== undefined) return KOREAN_DIGITS[source];

  let result = 0;
  let current = 0;
  let currentDigit = 0;
  let consumed = false;

  for (const ch of source) {
    if (KOREAN_DIGITS[ch] !== undefined) {
      currentDigit = KOREAN_DIGITS[ch];
      consumed = true;
      continue;
    }
    if (ch === '십') {
      current += (currentDigit || 1) * 10;
      currentDigit = 0;
      consumed = true;
      continue;
    }
    if (ch === '백') {
      current += (currentDigit || 1) * 100;
      currentDigit = 0;
      consumed = true;
      continue;
    }
    if (ch === '천') {
      current += (currentDigit || 1) * 1000;
      currentDigit = 0;
      consumed = true;
      continue;
    }
    return null;
  }

  result += current + currentDigit;
  return consumed ? result : null;
}

function parseKoreanDecimalDigits(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return source;
  let digits = '';
  let cursor = source;
  while (cursor) {
    const matched = SINGLE_DIGIT_WORDS.find((word) => cursor.startsWith(word));
    if (!matched) return null;
    digits += String(COUNTER_DIGITS[matched]);
    cursor = cursor.slice(matched.length);
  }
  return digits || null;
}

function parseSingleCounterDigit(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  if (COUNTER_DIGITS[source] !== undefined) return COUNTER_DIGITS[source];
  return null;
}

function parseIntegerValue(text) {
  const normalized = normalizeNumberPhrase(text).replace(/\s+/g, '');
  if (!normalized) return {kind: 'empty'};
  const single = parseSingleCounterDigit(normalized);
  if (single !== null) return {kind: 'value', value: single, parseKind: 'counter-digit'};
  if (/^\d+$/.test(normalized)) return {kind: 'value', value: Number(normalized), parseKind: 'arabic-int'};
  const parsed = parseKoreanInteger(normalized);
  if (parsed !== null) return {kind: 'value', value: parsed, parseKind: 'korean-int'};
  return {kind: 'invalid'};
}

function parseFloatValue(text) {
  const normalized = normalizeNumberPhrase(text);
  const compact = normalized.replace(/\s+/g, '');
  if (!compact) return {kind: 'empty'};

  const decimalIncomplete = compact.match(DECIMAL_INCOMPLETE_RE);
  if (decimalIncomplete) {
    const integerPart = parseIntegerValue(decimalIncomplete[1]);
    if (integerPart.kind === 'value') {
      return {
        kind: 'decimal-incomplete',
        integerPart: integerPart.value,
        parseKind: `${integerPart.parseKind}-decimal-incomplete`,
      };
    }
  }

  if (ARABIC_NUMBER_RE.test(compact)) {
    return {kind: 'value', value: Number(compact), parseKind: compact.includes('.') ? 'arabic-float' : 'arabic-int'};
  }

  if (compact.includes('점') || compact.includes('.')) {
    const delimiter = compact.includes('점') ? '점' : '.';
    const [left, right] = compact.split(delimiter);
    if (!left || !right) return {kind: 'invalid'};
    const integerPart = parseIntegerValue(left);
    const decimalPart = parseKoreanDecimalDigits(right);
    if (integerPart.kind === 'value' && decimalPart) {
      return {
        kind: 'value',
        value: Number(`${integerPart.value}.${decimalPart}`),
        parseKind: `${integerPart.parseKind}-decimal`,
      };
    }
    return {kind: 'invalid'};
  }

  const integerPart = parseIntegerValue(compact);
  if (integerPart.kind === 'value') {
    return {kind: 'value', value: integerPart.value, parseKind: integerPart.parseKind};
  }
  return {kind: 'invalid'};
}

function parseEnumValue(options, text) {
  const raw = normalizeTranscript(text);
  if (!raw) return {kind: 'empty'};
  const normalized = fieldKey(raw);
  const matches = (options || [])
    .map((option) => {
      const candidate = String(option || '').trim();
      const key = fieldKey(candidate);
      if (!key) return null;
      let score = 0;
      let method = 'enum-fuzzy';
      if (normalized === key) {
        score = 1;
        method = 'enum-exact';
      } else if (normalized.startsWith(key) || key.startsWith(normalized)) {
        score = 0.92;
        method = 'enum-prefix';
      } else {
        score = similarity(normalized, key);
      }
      return {candidate, score, method};
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (matches[0]?.score >= 0.72) {
    return {kind: 'value', value: matches[0].candidate, parseKind: matches[0].method};
  }
  return {kind: 'invalid'};
}

function parseBooleanValue(text) {
  const normalized = fieldKey(text);
  const truthy = ['예', '네', '응', '있음', '있다', 'true', 'on', '사용', '체크'];
  const falsy = ['아니오', '아니', '없음', '없다', 'false', 'off', '해제'];
  if (truthy.includes(normalized)) return {kind: 'value', value: true, parseKind: 'boolean-true'};
  if (falsy.includes(normalized)) return {kind: 'value', value: false, parseKind: 'boolean-false'};
  return {kind: 'invalid'};
}

function getPendingMs(field) {
  return PENDING_MS_BY_FIELD[field] || 1100;
}

function createFieldCatalog(fields) {
  const entries = [];
  for (const [field, meta] of Object.entries(fields || {})) {
    const aliases = uniqueStrings([field, meta.short, ...(meta.aliases || [])]).sort((a, b) => b.length - a.length);
    entries.push({
      field,
      meta,
      aliases: aliases.map((alias) => ({
        alias,
        aliasKey: fieldKey(alias),
        regex: buildAliasRegex(alias),
        priority: meta.priority ?? 50,
      })),
    });
  }
  entries.sort((a, b) => (b.meta.priority ?? 50) - (a.meta.priority ?? 50) || b.field.length - a.field.length);
  return entries;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function buildCandidate({rawText, normalizedText, field, rawField, value, matchScore, matchMethod, candidates = [], parseKind = null, replacesLogId = null, pending = null, noteMode = false}) {
  return {
    rawText,
    normalizedText,
    field,
    rawField,
    value,
    matchScore,
    matchMethod,
    candidates,
    parseKind,
    replacesLogId,
    pending,
    noteMode,
  };
}

function matchFieldFuzzy(fields, input) {
  const key = fieldKey(input);
  let best = {field: null, score: 0, method: 'unmatched', candidates: []};
  const candidates = [];
  for (const entry of createFieldCatalog(fields)) {
    for (const alias of entry.aliases) {
      let score = 0;
      let method = 'fuzzy';
      if (key === alias.aliasKey) {
        score = alias.alias === entry.field ? 0.97 : 0.95;
        method = 'exact';
      } else if (key.startsWith(alias.aliasKey) || alias.aliasKey.startsWith(key)) {
        score = 0.84;
        method = 'prefix-alias';
      } else {
        score = similarity(key, alias.aliasKey);
      }
      score += Math.min((entry.meta.priority ?? 50) / 1000, 0.15);
      if (score >= 0.55) {
        candidates.push({field: entry.field, alias: alias.alias, score: Number(score.toFixed(4)), method});
      }
      if (score > best.score) {
        best = {field: entry.field, score, method, alias: alias.alias};
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return {...best, candidates: candidates.slice(0, 5)};
}

function parseValueByType(meta, text) {
  if (!meta) return {kind: 'invalid'};
  if (meta.type === 'int') return parseIntegerValue(text);
  if (meta.type === 'float') return parseFloatValue(text);
  if (meta.type === 'enum') return parseEnumValue(meta.options, text);
  if (meta.type === 'boolean') return parseBooleanValue(text);
  if (meta.type === 'text') {
    const normalized = normalizeTranscript(text);
    return normalized ? {kind: 'value', value: normalized, parseKind: 'text'} : {kind: 'empty'};
  }
  return {kind: 'invalid'};
}

function looksNumericPrefix(text) {
  return /^[0-9영공일이삼사오육륙칠팔구하나둘셋넷다섯여섯일곱여덟아홉십백천점.]/.test(String(text || '').trim());
}

function derivePromptLabel(field, fields) {
  const meta = fields[field];
  return meta?.short || field;
}

export class VoiceSurveyParser {
  constructor(fields = {}) {
    this.setFields(fields);
    this.clearState();
  }

  setFields(fields = {}) {
    this.fields = fields;
    this.catalog = createFieldCatalog(fields);
  }

  clearState() {
    this.pendingField = null;
    this.lastNumericTarget = null;
    this.noteMode = null;
  }

  getState() {
    return {
      pendingField: this.pendingField ? {...this.pendingField} : null,
      lastNumericTarget: this.lastNumericTarget ? {...this.lastNumericTarget} : null,
      noteMode: this.noteMode ? {...this.noteMode} : null,
    };
  }

  setLastNumericTarget(target) {
    this.lastNumericTarget = target ? {...target} : null;
  }

  rankFieldCandidates(rawText, limit = 4) {
    const normalized = normalizeTranscript(rawText);
    const words = splitTokens(normalized);
    const hits = [];
    for (const entry of this.catalog) {
      for (const alias of entry.aliases) {
        if (fieldKey(normalized).includes(alias.aliasKey)) {
          hits.push({field: entry.field, alias: alias.alias, score: 0.98 + Math.min(alias.priority / 1000, 0.12), method: 'contains-alias'});
          continue;
        }
        for (let start = 0; start < words.length; start++) {
          for (let len = 1; len <= Math.min(3, words.length - start); len++) {
            const sample = words.slice(start, start + len).join(' ');
            const match = matchFieldFuzzy(this.fields, sample);
            if (match.field === entry.field && match.score >= 0.7) {
              hits.push({field: entry.field, alias: match.alias || alias.alias, score: match.score, method: match.method});
            }
          }
        }
      }
    }
    return hits
      .sort((a, b) => b.score - a.score)
      .filter((item, index, list) => list.findIndex((other) => other.field === item.field) === index)
      .slice(0, limit);
  }

  parseUtterance(rawText, {commit = true, now = Date.now()} = {}) {
    const normalizedText = normalizeTranscript(rawText);
    if (!normalizedText) return null;
    this.expireState(now);

    const directNote = this.parseDirectNote(rawText, normalizedText, now, commit);
    if (directNote) return directNote;

    const explicitCorrection = this.parseExplicitCorrection(rawText, normalizedText, now);
    if (explicitCorrection) {
      if (commit) this.pendingField = null;
      return explicitCorrection;
    }

    const direct = this.parseFieldPrefix(rawText, normalizedText, now, commit);
    if (direct) return direct;

    const pending = this.parsePendingValue(rawText, normalizedText, now, commit);
    if (pending) return pending;

    const fuzzy = this.parseFuzzyFieldValue(rawText, normalizedText, now, commit);
    if (fuzzy) return fuzzy;

    const fieldOnly = matchFieldFuzzy(this.fields, normalizedText);
    if (fieldOnly.field && fieldOnly.score >= 0.82 && (this.fields[fieldOnly.field]?.priority ?? 0) >= 100) {
      const pendingInfo = this.makePending(fieldOnly.field, now, 'value');
      if (commit) this.pendingField = pendingInfo;
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: normalizedText,
        field: fieldOnly.field,
        value: null,
        matchScore: Number(fieldOnly.score.toFixed(4)),
        matchMethod: 'pending-set:fuzzy',
        candidates: fieldOnly.candidates,
        pending: pendingInfo,
      });
    }

    return buildCandidate({
      rawText,
      normalizedText,
      rawField: normalizedText,
      field: null,
      value: null,
      matchScore: Number((fieldOnly.score || 0).toFixed(4)),
      matchMethod: 'unmatched',
      candidates: fieldOnly.candidates || [],
    });
  }

  preview(rawText, options = {}) {
    return this.parseUtterance(rawText, {...options, commit: false});
  }

  validateValue(field, value) {
    const meta = this.fields[field];
    if (!meta || value === null || value === undefined) return {severity: 'ok', message: ''};
    if (meta.type === 'int' && !Number.isInteger(value)) {
      return {severity: 'fail', message: '정수 항목입니다'};
    }
    if (meta.allowedValues?.length) {
      const normalizedAllowed = meta.allowedValues.map((item) => String(item));
      if (!normalizedAllowed.includes(String(value))) {
        return {severity: 'reconfirm', message: `${field} 허용값 외 입력`};
      }
    }
    if (meta.type === 'enum' && meta.options?.length && !meta.options.includes(value)) {
      return {severity: 'reconfirm', message: `${field} 허용 선택지 외 입력`};
    }
    if (meta.type === 'boolean' && typeof value !== 'boolean') {
      return {severity: 'fail', message: '예/아니오만 허용됩니다'};
    }
    const rules = meta.validation;
    if (!rules || typeof value !== 'number') return {severity: 'ok', message: ''};

    if ((rules.reconfirmMin !== null && value <= rules.reconfirmMin) || (rules.reconfirmMax !== null && value > rules.reconfirmMax)) {
      return {severity: 'reconfirm', message: `${field} 값 재확인 필요`};
    }
    if ((rules.allowedMin !== null && value < rules.allowedMin) || (rules.allowedMax !== null && value > rules.allowedMax)) {
      return {severity: 'reconfirm', message: `${field} 허용 범위 확인`};
    }
    if ((rules.warnMin !== null && value < rules.warnMin) || (rules.warnMax !== null && value > rules.warnMax)) {
      return {severity: 'warn', message: `${field} 주의 범위`};
    }
    return {severity: 'ok', message: ''};
  }

  describeValue(field, value) {
    if (value === null || value === undefined) return derivePromptLabel(field, this.fields);
    return `${derivePromptLabel(field, this.fields)} ${value}`;
  }

  expireState(now) {
    if (this.pendingField && this.pendingField.expiresAt <= now) this.pendingField = null;
    if (this.noteMode && this.noteMode.expiresAt <= now) this.noteMode = null;
    if (this.lastNumericTarget && now - this.lastNumericTarget.setAt > OVERWRITE_WINDOW_MS) this.lastNumericTarget = null;
  }

  makePending(field, now, kind, extra = {}) {
    return {
      field,
      kind,
      setAt: now,
      expiresAt: now + getPendingMs(field),
      ...extra,
    };
  }

  parseDirectNote(rawText, normalizedText, now, commit) {
    const noteEntries = this.catalog.filter((entry) => entry.meta.noteField || entry.field === '비고');
    const noteAliases = noteEntries.flatMap((entry) => [entry.field, ...(entry.meta.aliases || []), ...(entry.meta.short ? [entry.meta.short] : [])]);
    const fuzzyNote = noteAliases.find((alias) => fieldKey(normalizedText) === fieldKey(alias));
    if (fuzzyNote) {
      const targetField = noteEntries.find((entry) => [entry.field, entry.meta.short, ...(entry.meta.aliases || [])].filter(Boolean).some((alias) => fieldKey(alias) === fieldKey(fuzzyNote)))?.field || '비고';
      const noteMode = {field: targetField, setAt: now, expiresAt: now + 15000};
      if (commit) this.noteMode = noteMode;
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: fuzzyNote,
        field: targetField,
        value: null,
        matchScore: 1,
        matchMethod: 'note-mode-enter',
        pending: noteMode,
        noteMode: true,
      });
    }

    for (const entry of noteEntries) {
      for (const alias of [entry.field, entry.meta.short, ...(entry.meta.aliases || [])].filter(Boolean)) {
      const regex = buildAliasRegex(alias);
      const match = normalizedText.match(regex);
      if (!match) continue;
      const suffix = normalizeTranscript(match[1]);
      if (!suffix) continue;
      if (commit) this.noteMode = null;
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: alias,
        field: entry.field,
        value: suffix,
        matchScore: alias === entry.field ? 1 : 0.98,
        matchMethod: 'note-direct',
        parseKind: 'text',
      });
      }
    }

    if (this.noteMode) {
      const noteMode = {...this.noteMode};
      if (commit) this.noteMode = null;
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: '[비고모드]',
        field: noteMode.field,
        value: normalizedText,
        matchScore: 0.96,
        matchMethod: 'note-followup',
        parseKind: 'text',
      });
    }

    return null;
  }

  parseExplicitCorrection(rawText, normalizedText) {
    const match = normalizedText.match(EXPLICIT_CORRECTION_RE);
    if (!match) return null;
    const rest = match[2];
    const withField = this.parseFieldPrefix(rawText, rest, Date.now(), false, true);
    if (withField?.field && withField.value !== null && withField.value !== undefined) {
      return {...withField, matchMethod: 'explicit-correction', replacesLogId: this.lastNumericTarget?.field === withField.field ? this.lastNumericTarget.logId : null};
    }
    const numberOnly = parseFloatValue(rest);
    if (numberOnly.kind === 'value' && this.lastNumericTarget) {
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: `[수정:${this.lastNumericTarget.field}]`,
        field: this.lastNumericTarget.field,
        value: numberOnly.value,
        matchScore: 0.94,
        matchMethod: 'overwrite-last-number',
        replacesLogId: this.lastNumericTarget.logId,
      });
    }
    return null;
  }

  parseFieldPrefix(rawText, normalizedText, now, commit, bypassState = false) {
    const candidates = [];
    const compactText = fieldKey(normalizedText);

    for (const entry of this.catalog) {
      for (const alias of entry.aliases) {
        const match = normalizedText.match(alias.regex);
        if (!match) continue;
        const suffixRaw = normalizeTranscript(match[1]);
        const matchCandidates = [{field: entry.field, alias: alias.alias, score: 0.99, method: suffixRaw ? 'prefix-alias' : 'exact-alias'}];

        if (!suffixRaw) {
          candidates.push(buildCandidate({
            rawText,
            normalizedText,
            rawField: alias.alias,
            field: entry.field,
            value: null,
            matchScore: alias.alias === entry.field ? 0.99 : 0.97,
            matchMethod: 'pending-set:alias',
            candidates: matchCandidates,
            pending: this.makePending(entry.field, now, 'value'),
          }));
          continue;
        }

        const valueResult = parseValueByType(entry.meta, suffixRaw);
        if (valueResult.kind === 'value') {
          const aliasPenalty = looksNumericPrefix(suffixRaw) && /[일이삼사오육륙칠팔구영공]$/u.test(alias.alias) ? 0.035 : 0;
          candidates.push(buildCandidate({
            rawText,
            normalizedText,
            rawField: alias.alias,
            field: entry.field,
            value: valueResult.value,
            matchScore: (alias.alias === entry.field ? 0.995 : 0.98) - aliasPenalty + Math.min((entry.meta.priority ?? 50) / 1000, 0.12),
            matchMethod: suffixRaw.includes(' ') ? 'prefix-value' : 'attached-value',
            parseKind: valueResult.parseKind,
            candidates: matchCandidates,
          }));
        } else if (valueResult.kind === 'decimal-incomplete') {
          const aliasPenalty = looksNumericPrefix(suffixRaw) && /[일이삼사오육륙칠팔구영공]$/u.test(alias.alias) ? 0.035 : 0;
          candidates.push(buildCandidate({
            rawText,
            normalizedText,
            rawField: alias.alias,
            field: entry.field,
            value: null,
            matchScore: 0.97 - aliasPenalty + Math.min((entry.meta.priority ?? 50) / 1000, 0.12),
            matchMethod: 'pending-set:decimal-incomplete',
            parseKind: valueResult.parseKind,
            candidates: matchCandidates,
            pending: this.makePending(entry.field, now, 'decimal-incomplete', {integerPart: valueResult.integerPart}),
          }));
        }

        if (!compactText.includes(alias.aliasKey)) continue;
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    const best = candidates[0];
    if (commit && !bypassState) {
      if (best.pending) this.pendingField = best.pending;
      else this.pendingField = null;
    }
    return best;
  }

  parsePendingValue(rawText, normalizedText, now, commit) {
    if (this.pendingField) {
      const pending = {...this.pendingField};
      const meta = this.fields[pending.field];
      if (!meta) return null;
      const valueResult = parseValueByType(meta, normalizedText);

      if (pending.kind === 'decimal-incomplete') {
        const decimalDigits = parseKoreanDecimalDigits(normalizeNumberPhrase(normalizedText).replace(/\s+/g, ''));
        if (decimalDigits) {
          const combined = Number(`${pending.integerPart}.${decimalDigits}`);
          if (commit) this.pendingField = null;
          return buildCandidate({
            rawText,
            normalizedText,
            rawField: `[이전:${pending.field}]`,
            field: pending.field,
            value: combined,
            matchScore: 0.97,
            matchMethod: 'pending-decimal',
            parseKind: 'pending-decimal',
          });
        }
      }

      if (valueResult.kind === 'value') {
        if (commit) this.pendingField = null;
        return buildCandidate({
          rawText,
          normalizedText,
          rawField: `[이전:${pending.field}]`,
          field: pending.field,
          value: valueResult.value,
          matchScore: 0.96,
          matchMethod: 'pending-value',
          parseKind: valueResult.parseKind,
        });
      }
    }

    const numericOnly = parseFloatValue(normalizedText);
    if (numericOnly.kind === 'value' && this.lastNumericTarget && now - this.lastNumericTarget.setAt <= OVERWRITE_WINDOW_MS && !NOISE_NUMBER_RE.test(String(normalizedText).replace(/[,\s]/g, ''))) {
      const validation = this.validateValue(this.lastNumericTarget.field, numericOnly.value);
      if (validation.severity === 'ok' || validation.severity === 'warn') {
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: `[수정:${this.lastNumericTarget.field}]`,
        field: this.lastNumericTarget.field,
        value: numericOnly.value,
        matchScore: 0.94,
        matchMethod: 'overwrite-last-number',
        replacesLogId: this.lastNumericTarget.logId,
        parseKind: numericOnly.parseKind,
      });
      }
    }

    if (numericOnly.kind === 'value') {
      return buildCandidate({
        rawText,
        normalizedText,
        rawField: null,
        field: null,
        value: numericOnly.value,
        matchScore: 0,
        matchMethod: 'number-only',
        parseKind: numericOnly.parseKind,
      });
    }

    return null;
  }

  parseFuzzyFieldValue(rawText, normalizedText, now, commit) {
    const words = splitTokens(normalizedText);
    if (words.length < 2) return null;
    const candidates = [];

    for (let start = 0; start < words.length - 1; start++) {
      for (let take = 1; take <= Math.min(words.length - start - 1, 3); take++) {
        const fieldText = words.slice(start, start + take).join(' ');
        const valueText = words.slice(start + take).join('');
        const fieldMatch = matchFieldFuzzy(this.fields, fieldText);
        if (!fieldMatch.field || fieldMatch.score < 0.72) continue;
        const meta = this.fields[fieldMatch.field];
        const parsedValue = parseValueByType(meta, valueText);
        if (parsedValue.kind === 'value') {
          const validation = this.validateValue(fieldMatch.field, parsedValue.value);
          if (validation.severity === 'reconfirm' && meta.allowedValues?.length) continue;
          candidates.push(buildCandidate({
            rawText,
            normalizedText,
            rawField: fieldText,
            field: fieldMatch.field,
            value: parsedValue.value,
            matchScore: Number(fieldMatch.score.toFixed(4)),
            matchMethod: `fuzzy-value:${fieldMatch.method}`,
            parseKind: parsedValue.parseKind,
            candidates: fieldMatch.candidates,
          }));
        } else if (parsedValue.kind === 'decimal-incomplete') {
          candidates.push(buildCandidate({
            rawText,
            normalizedText,
            rawField: fieldText,
            field: fieldMatch.field,
            value: null,
            matchScore: Number(fieldMatch.score.toFixed(4)),
            matchMethod: `pending-set:decimal-fuzzy:${fieldMatch.method}`,
            parseKind: parsedValue.parseKind,
            candidates: fieldMatch.candidates,
            pending: this.makePending(fieldMatch.field, now, 'decimal-incomplete', {integerPart: parsedValue.integerPart}),
          }));
        }
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    const best = candidates[0];
    if (commit) {
      if (best.pending) this.pendingField = best.pending;
      else this.pendingField = null;
    }
    return best;
  }
}
