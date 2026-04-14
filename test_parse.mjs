import { createFieldRegistry, normalizeCustomFieldDefinition } from './src/lib/field-config.js';
import { VoiceSurveyParser } from './src/lib/parser.js';

function createParser(customFields = {}) {
  return new VoiceSurveyParser(createFieldRegistry(customFields));
}

function assertResult(parser, input, expected, desc) {
  const result = parser.parseUtterance(input);
  const fieldOk = expected.field === undefined || result?.field === expected.field;
  const valueOk = expected.value === undefined || result?.value === expected.value;
  const methodOk = expected.method === undefined || result?.matchMethod === expected.method;
  const ok = fieldOk && valueOk && methodOk;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status} | ${desc} | "${input}"`);
  if (!ok) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  got: ${JSON.stringify({field: result?.field, value: result?.value, matchMethod: result?.matchMethod, parseKind: result?.parseKind}, null, 2)}`);
    process.exitCode = 1;
  }
}

function assertSeverity(parser, field, value, expectedSeverity, desc) {
  const validation = parser.validateValue(field, value);
  const ok = validation.severity === expectedSeverity;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${desc} | ${field}=${value}`);
  if (!ok) {
    console.log(`  expected severity: ${expectedSeverity}`);
    console.log(`  got: ${JSON.stringify(validation)}`);
    process.exitCode = 1;
  }
}

const parser = createParser();

console.log('\n=== 기본 필드 테스트 ===\n');

assertResult(parser, '나무 일', {field: '조사나무', value: 1}, '조사나무 한글 숫자');
assertResult(parser, '나무이', {field: '조사나무', value: 2}, '조사나무 붙여말하기');
assertResult(parser, '나무삼', {field: '조사나무', value: 3}, '조사나무 붙여말하기 삼');
assertResult(parser, '나무 사', {field: '조사나무', value: 4}, '조사나무 띄어쓰기');
assertResult(parser, '나무로', {field: '조사나무', value: 5}, '조사나무 로=5');
assertResult(parser, '과실이', {field: '조사과실', value: 2}, '조사과실 붙여말하기');
assertResult(parser, '과실삼', {field: '조사과실', value: 3}, '조사과실 붙여말하기 삼');
assertResult(parser, '과실오', {field: '조사과실', value: 5}, '조사과실 붙여말하기 오');
assertResult(parser, '거실 사', {field: '조사과실', value: 4}, '과실 alias 복구');
assertResult(parser, '과실로', {field: '조사과실', value: 5}, '오인식 로=5');

assertResult(parser, '횡경 22.2', {field: '횡경', value: 22.2}, '횡경 기본 소수');
assertResult(parser, '변경 44.4', {field: '횡경', value: 44.4}, '횡경 변경 alias');
assertResult(parser, '생경 122.2', {field: '횡경', value: 122.2}, '횡경 생경 alias');
assertResult(parser, '성경 88.8', {field: '횡경', value: 88.8}, '횡경 성경 alias');
assertResult(parser, '변경백', {field: '횡경', value: 100}, '횡경 백');
assertResult(parser, '변경 200', {field: '횡경', value: 200}, '횡경 200');
assertResult(parser, '변경이백이십이점이', {field: '횡경', value: 222.2}, '횡경 222.2');
assertResult(parser, '행정 211', {field: '횡경', value: 211}, '횡경 행정 alias');
assertResult(parser, '횡 10000000000000000 71.1', {field: '횡경', value: 71.1}, '노이즈 숫자 제거');
assertSeverity(parser, '횡경', 211, 'warn', '횡경 211 주의 범위');

assertResult(parser, '동경 11.1', {field: '종경', value: 11.1}, '종경 동경 alias');
assertResult(parser, '존경 55.5', {field: '종경', value: 55.5}, '종경 존경 alias');
assertResult(parser, '동경 200', {field: '종경', value: 200}, '종경 200');

console.log('\n=== 오매칭 방지 테스트 ===\n');

assertResult(parser, '누가 나무 위', {field: '조사나무', value: 2}, '당도 대신 조사나무 2');
assertResult(parser, '누가 나무 삼', {field: '조사나무', value: 3}, '당도 대신 조사나무 3');
assertResult(parser, '부산 나무빌', {field: null}, '당도/나무 오매칭 금지');

console.log('\n=== pending / overwrite 테스트 ===\n');

const parser2 = createParser();
assertResult(parser2, '횡경 99 점', {field: '횡경', value: null}, '소수점 미완성 pending');
assertResult(parser2, '2', {field: '횡경', value: 99.2}, 'pending decimal 결합');

const parser3 = createParser();
assertResult(parser3, '횡경 22.5', {field: '횡경', value: 22.5}, 'overwrite 기준값');
parser3.setLastNumericTarget({field: '횡경', logId: 'test', setAt: Date.now(), value: 22.5});
assertResult(parser3, '23.5', {field: '횡경', value: 23.5, method: 'overwrite-last-number'}, '숫자만으로 overwrite');
parser3.setLastNumericTarget({field: '횡경', logId: 'test', setAt: Date.now() - 2500, value: 22.5});
assertResult(parser3, '24.5', {field: null}, 'overwrite 시간 제한');

console.log('\n=== 비고 테스트 ===\n');

const parser4 = createParser();
assertResult(parser4, '비고 과실 표면 상처 있음', {field: '비고', value: '과실 표면 상처 있음'}, '비고 직접 입력');
assertResult(parser4, '비고', {field: '비고', value: null, method: 'note-mode-enter'}, '비고 모드 진입');
assertResult(parser4, '바람 강하고 낙과 조금 있음', {field: '비고', value: '바람 강하고 낙과 조금 있음'}, '비고 follow-up');

console.log('\n=== 사용자 정의 항목 테스트 ===\n');

const customFields = {
  착색도: normalizeCustomFieldDefinition('착색도', {
    type: 'int',
    short: '착색',
    exampleUtterance: '착색도 삼',
    validation: {allowedMin: 0, allowedMax: 9, warnMin: null, warnMax: 7, reconfirmMin: null, reconfirmMax: 9},
  }),
  상태메모: normalizeCustomFieldDefinition('상태메모', {
    type: 'text',
    exampleUtterance: '상태메모 바람 영향 있음',
  }),
  등급: normalizeCustomFieldDefinition('등급', {
    type: 'enum',
    options: '상,중,하',
    exampleUtterance: '등급 상',
  }),
};
const parser5 = createParser(customFields);
assertResult(parser5, '착색도삼', {field: '착색도', value: 3}, '사용자 정의 int 붙여말하기');
assertResult(parser5, '착색 도 삼', {field: '착색도', value: 3}, '사용자 정의 int 띄어쓰기');
assertResult(parser5, '상태메모 바람 영향 있음', {field: '상태메모', value: '바람 영향 있음'}, '사용자 정의 text');
assertResult(parser5, '등급 상', {field: '등급', value: '상'}, '사용자 정의 enum');
assertSeverity(parser5, '등급', '특', 'reconfirm', 'enum 허용값 외 거부');
assertSeverity(parser, '조사나무', 7, 'reconfirm', '조사나무 허용값 외 거부');

if (process.exitCode) {
  console.log('\n테스트 실패가 있습니다.\n');
  process.exit(process.exitCode);
}

console.log('\n모든 테스트 통과.\n');
