// Self-verification test for v6 parsing logic
// Extracted from index.html to run in Node.js

const FIELDS = {
  '조사나무': {type:'int',   range:[1,100], unit:'번', short:'나무', aliases:['나무','나무번호','조사 나무','노사 나무','노사나무','조사나 무','좌사나무','조산나무','조사나무가','조사나무는']},
  '조사과실': {type:'int',   range:[1,50],  unit:'번', short:'과실', aliases:['과실','과실번호','조사 과실','조 과실','조사과일','좌사과실','조산과실','조사괴실','조사 가실','조사가 실','조사 과제','과일','거실','가실','마실','바실','아실','화실','과시','과 시','마시','다시','마실사','바 실상','과 시로','마시로','가시도','다시 육','다시 일']},
  '횡경':    {type:'float', range:[10,120], unit:'mm', short:'횡',  aliases:['횡','횡경이','휑경','휑경이','행경','황경','왱경','횡견','횡겨','횡격','횡겸','형경','혈경','흉경','획경','횟경','변경','생경','엔','엔경','엔 경','은경','현경','인경','안경','윤경','행정','빙빙경','경경','행 경','행 경대','행행경']},
  '종경':    {type:'float', range:[10,120], unit:'mm', short:'종',  aliases:['종','종경이','종견','종겨','종격','종겸','존경','정경','동경','중경','총경','종교','송경','용경','존경 탐']},
  '과중':    {type:'float', range:[30,500], unit:'g',  short:null,  aliases:['과종','과증','과준','괴중','가중','과충','과중이','무게']},
  '당도':    {type:'float', range:[5,20],   unit:'Brix',short:null, aliases:['당두','당돋','단도','당동','당독','당또','당토','담도','브릭스']},
  '산도':    {type:'float', range:[0.3,3.0],unit:'%',  short:null,  aliases:['산돋','산동','삼도','선도','산또','잔도','상도']},
  '착색':    {type:'int',   range:[1,10],   unit:'',   short:null,  aliases:['착생','착섹','착쌕','착색이','칙색','탁색']},
  '경도':    {type:'float', range:[0.1,30], unit:'N',  short:null,  aliases:['경돋','견도','겸도','경독','껑도','격도']},
  '과피두께':{type:'float', range:[0.5,10], unit:'mm', short:'과피', aliases:['과피','과피두게','과피두깨','과피 두께','꽈피두께','과피 두게','과피 두깨','껍질두께','피두께']},
  '비타민C': {type:'float', range:[10,100], unit:'mg', short:'비타민',aliases:['비타민씨','비타민시','비타민 씨','비타민','비타민c','피타민씨','비타민 씨가']},
  '구연산':  {type:'float', range:[0.1,3.0],unit:'%',  short:null,  aliases:['구연삼','구년산','구연산이','귀연산','구련산','규연산']},
  '과즙량':  {type:'float', range:[10,200], unit:'mL', short:'과즙', aliases:['과즙','과즙량이','과증량','과즙양','과즙 양','즙량']},
  '씨수':    {type:'int',   range:[0,30],   unit:'개', short:null,  aliases:['씨수가','시수','씨 수','씨숫','씨쑤','씨앗수']},
  '비고':    {type:'text',  range:null,     unit:'',   short:null,  aliases:['비고란','메모','참고','노트','기타']},
};

const KOREAN_DIGITS = {'영':0,'공':0,'일':1,'이':2,'삼':3,'사':4,'오':5,'육':6,'륙':6,'칠':7,'팔':8,'구':9,'하나':1,'둘':2,'셋':3,'넷':4,'다섯':5,'여섯':6,'일곱':7,'여덟':8,'아홉':9};
const COUNTER_DIGITS = {...KOREAN_DIGITS, '다':4, '라':4, '로':5, '휠':1};
const PARTICLE_RE = /(은|는|이|가|을|를|에|의|으로|로|하고|랑)$/;
const UNIT_RE = /(밀리미터|미리미터|밀리|미리|mm|엠엠|브릭스|brix|퍼센트|프로|그램|그람|g|개|번|ml|미리리터)$/i;

let pendingField = null;
let lastNumericTarget = null;

function normalizeTranscript(text) {
  return text.replace(/[""]/g,'"').replace(/['']/g,"'").replace(/[.,!?。、，]+$/g,'').replace(/\s+/g,' ').trim();
}
function fieldKey(value) {
  return String(value||'').toLowerCase().replace(/\s+/g,'').replace(/[.,!?。、，]/g,'').replace(UNIT_RE,'').replace(PARTICLE_RE,'');
}
function levenshtein(a,b){const m=a.length;const n=b.length;const d=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)d[i][0]=i;for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);return d[m][n]}
function similarity(a,b){const max=Math.max(a.length,b.length);return max===0?1:1-levenshtein(a,b)/max}
function fieldAliases(field,meta){return[field,meta.short,...(meta.aliases||[])].filter(Boolean)}
function isRegisteredField(field){return Object.prototype.hasOwnProperty.call(FIELDS,field)}

function matchField(input){
  const key=fieldKey(input);
  let best={field:input,score:0,method:'new',rawField:input,candidates:[]};
  const candidates=[];
  for(const[field,meta]of Object.entries(FIELDS)){
    for(const alias of fieldAliases(field,meta)){
      const aliasKey=fieldKey(alias);
      let score=0;let method='fuzzy';
      if(key===aliasKey){score=alias===field?1:0.98;method=alias===field?'exact':'alias'}
      else if(key.includes(aliasKey)&&aliasKey.length>=2){score=Math.max(0.82,aliasKey.length/Math.max(key.length,aliasKey.length));method='contains-alias'}
      else if(aliasKey.includes(key)&&key.length>=2){score=Math.max(0.74,key.length/aliasKey.length-0.04);method='prefix-alias'}
      else score=similarity(key,aliasKey);
      if(score>=0.48)candidates.push({field,alias,score:Number(score.toFixed(4)),method});
      if(score>best.score)best={field,score,method,rawField:input};
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  best.candidates=candidates.slice(0,5);
  return best.score>=0.55?best:{field:input,score:0,method:'new',rawField:input,candidates:candidates.slice(0,5)};
}

function koreanWordToNumber(value){
  if(!value)return null;
  let text=String(value).trim().replace(/\s+/g,'').replace(UNIT_RE,'');
  text=text.replace(/쩜|점/g,'.').replace(/,/g,'.');
  if(/^\d+(\.\d+)?$/.test(text))return Number(text);
  if(text.includes('.')){const[left,right]=text.split('.');if(!left||!right)return null;const intValue=koreanInteger(left);const decimal=koreanDecimal(right);if(intValue!==null&&decimal!==null)return Number(`${intValue}.${decimal}`);return null}
  return koreanInteger(text);
}
function koreanInteger(text){
  if(text==='')return null;
  if(/^\d+$/.test(text))return Number(text);
  if(KOREAN_DIGITS[text]!==undefined)return KOREAN_DIGITS[text];
  const units={'십':10,'백':100,'천':1000};let result=0;let current=0;let consumed=false;
  for(const ch of text){if(KOREAN_DIGITS[ch]!==undefined){current=KOREAN_DIGITS[ch];consumed=true}else if(units[ch]){result+=(current||1)*units[ch];current=0;consumed=true}else return null}
  result+=current;return consumed?result:null;
}
function koreanDecimal(text){if(text==='')return null;if(/^\d+$/.test(text))return text;let out='';for(const ch of text){if(KOREAN_DIGITS[ch]===undefined)return null;out+=KOREAN_DIGITS[ch]}return out}

function makeCandidate(match,value,method){return{rawField:match.rawField,field:match.field,value,matchScore:match.score,matchMethod:method+':'+match.method,candidates:match.candidates}}
function makeOverwriteResult(rawText,normalizedText,value){
  if(!lastNumericTarget||Date.now()-lastNumericTarget.setAt>=60000)return null;
  const field=lastNumericTarget.field;
  return{rawText,normalizedText,rawField:`[수정:${field}]`,field,value,matchScore:0.94,matchMethod:'overwrite-last-number',replacesLogId:lastNumericTarget.logId,candidates:[{field,score:0.94,method:'overwrite-last-number'}]};
}
function parseExplicitCorrection(normalized,rawText){
  const match=normalized.match(/^(수정|정정)\s+(.+)$/);
  if(!match)return null;
  const rest=match[2];const value=koreanWordToNumber(rest);
  if(value!==null)return makeOverwriteResult(rawText,normalized,value);
  const withField=rest.match(/^(.+?)\s*([0-9]+(?:[.,][0-9]+)?)\s*(밀리미터|미리미터|밀리|미리|mm|브릭스|brix|퍼센트|프로|그램|그람|g|개|번|ml|미리리터)?$/i);
  if(!withField)return null;
  const fieldMatch=matchField(withField[1]);
  if(!isRegisteredField(fieldMatch.field))return null;
  return{rawText,normalizedText:normalized,rawField:`[수정:${fieldMatch.field}]`,field:fieldMatch.field,value:Number(withField[2].replace(',','.')),matchScore:fieldMatch.score,matchMethod:'explicit-correction',replacesLogId:null,candidates:fieldMatch.candidates};
}
function parseMemo(normalized,rawText){
  const aliases=fieldAliases('비고',FIELDS['비고']).sort((a,b)=>b.length-a.length);
  for(const alias of aliases){
    const re=new RegExp('^'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+(.+)$','i');
    const match=normalized.match(re);
    if(match)return{rawText,normalizedText:normalized,rawField:alias,field:'비고',value:match[1].trim(),matchScore:alias==='비고'?1:0.98,matchMethod:'memo-text',candidates:[]};
  }
  return null;
}

function parseUtterance(rawText){
  if(pendingField&&Date.now()-pendingField.setAt>15000)pendingField=null;
  const text=normalizeTranscript(rawText);
  if(!text)return null;
  const candidates=[];
  const normalized=text.replace(/([0-9])\s+([0-9])/g,'$1$2');
  const memo=parseMemo(normalized,rawText);if(memo)return memo;
  const explicitCorrection=parseExplicitCorrection(normalized,rawText);if(explicitCorrection)return explicitCorrection;
  const arabic=normalized.match(/^(.+?)\s*([0-9]+(?:[.,][0-9]+)?)\s*(밀리미터|미리미터|밀리|미리|mm|브릭스|brix|퍼센트|프로|그램|그람|g|개|번|ml|미리리터)?$/i);
  if(arabic){const match=matchField(arabic[1]);if(isRegisteredField(match.field))candidates.push(makeCandidate(match,Number(arabic[2].replace(',','.')),'arabic-suffix'))}
  const words=normalized.split(/\s+/).filter(Boolean);
  for(let take=1;take<=Math.min(4,words.length-1);take++){
    const numberText=words.slice(-take).join('');let value=koreanWordToNumber(numberText);if(value===null)continue;
    const fieldText=words.slice(0,-take).join(' ');const match=matchField(fieldText);
    if(match.score>=0.55&&isRegisteredField(match.field))candidates.push(makeCandidate(match,value,'korean-suffix'));
  }
  for(const word of words.slice(-1)){
    if(COUNTER_DIGITS[word]===undefined)continue;
    const fieldText=words.slice(0,-1).join(' ');const match=matchField(fieldText);
    if(match.score>=0.55&&isRegisteredField(match.field)&&FIELDS[match.field].type==='int')candidates.push(makeCandidate(match,COUNTER_DIGITS[word],'counter-suffix'));
  }
  const compactRaw=normalized.toLowerCase().replace(/\s+/g,'').replace(/[.,!?。、，]/g,'').replace(UNIT_RE,'');
  const digitWords=Object.keys(COUNTER_DIGITS).sort((a,b)=>b.length-a.length);
  for(const digitWord of digitWords){
    if(!compactRaw.endsWith(digitWord)||compactRaw.length<=digitWord.length)continue;
    const fieldText=compactRaw.slice(0,-digitWord.length);const match=matchField(fieldText);
    if(match.score>=0.55&&isRegisteredField(match.field)&&FIELDS[match.field].type==='int')candidates.push(makeCandidate(match,COUNTER_DIGITS[digitWord],'attached-korean-digit'));
  }
  const compact=fieldKey(normalized);
  for(let cut=1;cut<=Math.min(8,compact.length-1);cut++){
    const numberText=compact.slice(-cut);const value=koreanWordToNumber(numberText);if(value===null)continue;
    const fieldText=compact.slice(0,-cut);const match=matchField(fieldText);
    if(match.score>=0.62&&isRegisteredField(match.field))candidates.push(makeCandidate(match,value,'compact-korean'));
  }
  const numOnly=koreanWordToNumber(normalized);
  if(numOnly!==null){
    if(pendingField){const field=pendingField.field;pendingField=null;return{rawText,normalizedText:normalized,rawField:`[이전:${field}]`,field,value:numOnly,matchScore:0.96,matchMethod:'pending',candidates:[]}}
    const overwrite=makeOverwriteResult(rawText,normalized,numOnly);
    if(overwrite)return overwrite;
    candidates.push({rawField:null,field:null,value:numOnly,matchScore:0,matchMethod:'number-only',candidates:[]});
  }
  if(candidates.length===0){
    const match=matchField(normalized);
    if(match.score>=0.62&&FIELDS[match.field]){pendingField={field:match.field,setAt:Date.now(),rawText};return{rawText,normalizedText:normalized,rawField:normalized,field:match.field,value:null,matchScore:match.score,matchMethod:'pending-set',candidates:match.candidates}}
    return{rawText,normalizedText:normalized,rawField:normalized,field:null,value:null,matchScore:match.score,matchMethod:'unmatched',candidates:match.candidates};
  }
  candidates.sort((a,b)=>b.matchScore-a.matchScore);
  const best=candidates[0];
  if(best.field)pendingField=null;
  return{...best,rawText,normalizedText:normalized};
}

// --- TEST CASES ---
const tests = [
  {input: '변경 22.5',   expectField: '횡경',      expectValue: 22.5,  desc: '별칭 변경→횡경'},
  {input: '존경 35.7',   expectField: '종경',      expectValue: 35.7,  desc: '별칭 존경→종경'},
  {input: '나무 일',     expectField: '조사나무',   expectValue: 1,     desc: '약칭+한국어숫자'},
  {input: '과실이',      expectField: '조사과실',   expectValue: 2,     desc: '붙은 한국어숫자(이)'},
  {input: '마실 사',     expectField: '조사과실',   expectValue: 4,     desc: '새 별칭 마실→과실'},
  {input: '거실 삼',     expectField: '조사과실',   expectValue: 3,     desc: '기존 별칭 거실→과실'},
  {input: '횡경 22.5',   expectField: '횡경',      expectValue: 22.5,  desc: '정확 매칭'},
  {input: '다시 육',     expectField: '조사과실',   expectValue: 6,     desc: '새 별칭 다시 육'},
  {input: '행행경 50.0', expectField: '횡경',      expectValue: 50.0,  desc: '새 별칭 행행경→횡경'},
  {input: '존경 탐 20.1',expectField: '종경',      expectValue: 20.1,  desc: '공백 포함 별칭 존경 탐→종경'},
];

let pass = 0; let fail = 0;
console.log('\n=== v6 파싱 로직 테스트 ===\n');

// Reset state between tests
for (const t of tests) {
  pendingField = null;
  lastNumericTarget = null;
  const result = parseUtterance(t.input);
  const fieldOk = result?.field === t.expectField;
  const valueOk = t.expectValue === null || result?.value === t.expectValue;
  const ok = fieldOk && valueOk;
  if (ok) pass++;
  else fail++;
  const status = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} | "${t.input}" | desc: ${t.desc}`);
  if (!ok) {
    console.log(`       expect: field=${t.expectField}, value=${t.expectValue}`);
    console.log(`       got:    field=${result?.field ?? 'null'}, value=${result?.value ?? 'null'}, method=${result?.matchMethod}`);
    if (result?.candidates?.length) console.log(`       top candidates: ${result.candidates.slice(0,3).map(c=>`${c.field}(${c.score})`).join(', ')}`);
  }
}

// Overwrite test
pendingField = null;
lastNumericTarget = null;
const r1 = parseUtterance('횡경 22.5');
lastNumericTarget = {field: r1.field, logId: 'test-id', setAt: Date.now(), value: r1.value};
const r2 = parseUtterance('23.5');
const overwriteOk = r2?.matchMethod === 'overwrite-last-number' && r2?.field === '횡경' && r2?.value === 23.5;
if (overwriteOk) pass++;
else fail++;
console.log(`${overwriteOk ? '✓ PASS' : '✗ FAIL'} | "23.5" after 횡경 22.5 | desc: 숫자만 입력 시 overwrite`);
if (!overwriteOk) console.log(`  got: field=${r2?.field}, value=${r2?.value}, method=${r2?.matchMethod}`);

// number-only test (no lastNumericTarget)
pendingField = null;
lastNumericTarget = null;
const r3 = parseUtterance('23.5');
const numOnlyOk = r3?.matchMethod === 'number-only';
if (numOnlyOk) pass++;
else fail++;
console.log(`${numOnlyOk ? '✓ PASS' : '✗ FAIL'} | "23.5" (no target) | desc: number-only 동작 확인`);
if (!numOnlyOk) console.log(`  got: method=${r3?.matchMethod}, field=${r3?.field}`);

console.log(`\n=== 결과: ${pass} PASS / ${fail} FAIL / ${pass + fail} TOTAL ===\n`);

if (fail > 0) process.exit(1);
