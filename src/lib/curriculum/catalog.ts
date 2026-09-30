/**
 * 수학 과목별 단원 순서표 (순수 데이터, 서버·클라이언트 공용).
 *
 *  - 고등(verified: true): ~/.claude/skills/nk-exam-report/skill.md 84~140줄 "교육과정별 단원 분류 체계"를
 *    그대로 옮겼다(대단원·중단원 이름과 순서). 학원 도구의 정리본이라 이게 기준이다.
 *    단, 2026-09-30 코덱스 교차 점검에서 팀장이 확인한 곳은 고쳤다(해당 줄에 주석).
 *    aliases 는 실제 반 진도 기록·교재·매쓰플랫 세부 이름을 흡수하려고 덧붙인 것이다(순서에는 영향 없음).
 *  - 중학교·초등(verified: false): 초안. 반 배정 도우미는 이 과목들로는 "지나감/앞으로"를 판단하지 않는다.
 *
 * track: 같은 과정(내용이 같은 과목)끼리 같은 값. 단원 키 = `${track}:${정규화한 중단원 이름}`.
 *   수학Ⅱ≡미적분Ⅰ(calc1) · 수학Ⅰ≡대수(algebra) · 미적분(2015)≡미적분Ⅱ(calc2)
 *   확률과통계·기하·중학교 같은 학기는 이름이 같은 과목이라 같은 track 으로 둔다.
 */

export type CurriculumYear = "2015" | "2022";

export interface CatalogMinor {
  name: string;
  aliases: string[];
}

export interface CatalogMajor {
  major: string;
  /** 대단원 다른 이름(예: 미분 ← 미분법·다항함수의 미분법) */
  aliases?: string[];
  minors: CatalogMinor[];
}

export interface CatalogSubject {
  id: string;
  label: string;
  curriculum: CurriculumYear;
  verified: boolean;
  /** 같은 과정끼리 같은 값 */
  track: string;
  /** 학교급 — 과목 이름 판별 순서에 쓴다 */
  level: "elementary" | "middle" | "high";
  /** 교재·과정 이름에서 이 과목을 알아보는 이름 */
  aliases: string[];
  units: CatalogMajor[];
}

const m = (name: string, ...aliases: string[]): CatalogMinor => ({ name, aliases });

// ───────────────────────────── 고등 공용 별칭 ─────────────────────────────

const A = {
  polyOps: ["다항식의 덧셈과 뺄셈", "다항식의 곱셈", "다항식의 나눗셈", "곱셈 공식"],
  remainder: ["나머지정리", "항등식", "항등식과 나머지정리", "인수분해", "조립제법"],
  complex: ["복소수의 뜻", "복소수의 연산", "복소수의 뜻과 연산"],
  quadEq: ["이차방정식의 판별식", "판별식", "근과 계수의 관계"],
  quadFn: ["이차함수의 최대 최소", "이차함수의 최대와 최소", "이차함수의 그래프와 직선의 위치 관계", "이차함수의 그래프와 직선"],
  inequalities: [
    "여러 가지 방정식",
    "여러 가지 방정식과 부등식",
    "삼차방정식과 사차방정식",
    "연립이차방정식",
    "연립일차부등식",
    "이차부등식",
    "연립이차부등식",
    "절댓값을 포함한 부등식",
  ],
  perm: ["경우의 수", "순열", "조합", "원순열", "중복순열", "중복조합", "같은 것이 있는 순열"],
  plane: ["두 점 사이의 거리", "선분의 내분점", "선분의 내분점과 외분점"],
  line: ["두 직선의 위치 관계", "점과 직선 사이의 거리"],
  circle: ["원과 직선의 위치 관계", "원의 접선", "원의 접선의 방정식"],
  moving: ["평행이동", "대칭이동"],
  set: ["집합의 뜻", "집합의 뜻과 표현", "부분집합", "집합의 연산", "집합의 연산법칙", "유한집합의 원소의 개수"],
  prop: ["명제와 조건", "명제의 역과 대우", "충분조건과 필요조건", "명제의 증명", "절대부등식"],
  fn: ["함수의 뜻과 그래프", "합성함수", "역함수", "합성함수와 역함수"],
  ratFn: ["유리식", "유리함수", "무리식", "무리함수", "유리식과 유리함수", "무리식과 무리함수"],
  exp: ["거듭제곱근", "지수의 확장", "지수법칙"],
  log: ["로그의 뜻과 성질", "로그의 성질", "상용로그"],
  expFn: ["지수함수의 그래프", "지수방정식", "지수부등식", "지수방정식과 지수부등식"],
  logFn: ["로그함수의 그래프", "로그방정식", "로그부등식", "로그방정식과 로그부등식"],
  trig: ["일반각과 호도법", "호도법", "삼각함수의 뜻", "삼각함수의 성질", "삼각함수의 뜻과 성질"],
  trigGraph: ["삼각방정식", "삼각부등식", "삼각방정식과 삼각부등식"],
  lawOfSines: ["사인법칙", "코사인법칙", "삼각함수의 활용", "삼각형의 넓이"],
  arith: ["등차수열", "등비수열"],
  sum: ["합의 기호", "시그마", "여러 가지 수열의 합"],
  induction: ["수열의 귀납적 정의", "귀납적 정의"],
  // 수학Ⅱ ≡ 미적분Ⅰ — 매쓰플랫 세부 이름 포함
  limit: ["극한에 대한 성질", "함수의 극한에 대한 성질", "함수의 수렴과 발산", "극한값의 계산", "미정계수의 결정"],
  continuity: ["연속함수의 성질", "연속함수", "함수의 연속성", "사잇값 정리", "최대 최소 정리"],
  derivative: ["미분계수", "도함수", "평균변화율", "미분가능성과 연속성"],
  derivUse: [
    "접선의 방정식",
    "평균값 정리",
    "롤의 정리",
    "함수의 증가와 감소",
    "함수의 극대와 극소",
    "함수의 그래프",
    "함수의 최대와 최소",
    "방정식과 부등식에의 활용",
    "방정식에의 활용",
    "부등식에의 활용",
    "속도와 가속도",
  ],
  integral: ["부정적분", "정적분"],
  integralUse1: ["넓이", "속도와 거리", "곡선과 좌표축 사이의 넓이", "두 곡선 사이의 넓이"],
  // 미적분(2015) ≡ 미적분Ⅱ
  seqLimit: ["수열의 수렴과 발산", "등비수열의 극한"],
  series: ["등비급수"],
  funcDiff: [
    "지수함수와 로그함수의 미분",
    "삼각함수의 미분",
    "지수함수와 로그함수의 극한",
    "삼각함수의 극한",
    "삼각함수의 덧셈정리",
    "덧셈정리",
  ],
  diffMethods: [
    "몫의 미분법",
    "합성함수의 미분법",
    "매개변수로 나타낸 함수의 미분법",
    "음함수의 미분법",
    "역함수의 미분법",
    "이계도함수",
  ],
  derivUse2: ["변곡점", "함수의 그래프의 개형", "이계도함수의 활용"],
  intMethods: ["치환적분법", "부분적분법", "여러 가지 함수의 적분"],
  integralUse2: ["정적분과 급수", "정적분과 급수의 합", "입체도형의 부피", "곡선의 길이"],
  // 확률과통계
  binom: ["파스칼의 삼각형"],
  prob: ["확률의 뜻", "확률의 덧셈정리", "여사건의 확률", "수학적 확률", "통계적 확률"],
  cond: ["사건의 독립과 종속", "독립시행", "확률의 곱셈정리"],
  dist: ["확률변수", "이산확률변수", "이항분포", "연속확률변수", "정규분포"],
  estimate: ["모평균의 추정", "표본평균의 분포", "모집단과 표본"],
  // 기하
  conic: ["포물선", "타원", "쌍곡선", "이차곡선의 접선"],
  planeVec: ["벡터의 연산", "평면벡터의 성분", "평면벡터의 내적", "벡터의 내적"],
  spaceFig: ["직선과 평면의 위치 관계", "삼수선의 정리", "정사영"],
  spaceCoord: ["좌표공간", "구의 방정식"],
  spaceVec: ["공간벡터의 성분", "공간벡터의 내적"],
};

// ───────────────────────────── 고등 2015 ─────────────────────────────

const HIGH_2015: CatalogSubject[] = [
  {
    id: "h2015-math-upper",
    label: "수학(상)",
    curriculum: "2015",
    verified: true,
    track: "math-upper",
    level: "high",
    aliases: ["수학(상)", "수학 상"],
    units: [
      { major: "다항식", minors: [m("다항식의 연산", ...A.polyOps), m("나머지정리와 인수분해", ...A.remainder)] },
      {
        major: "방정식과 부등식",
        aliases: ["방정식", "부등식"],
        minors: [
          m("복소수", ...A.complex),
          m("이차방정식", ...A.quadEq),
          m("이차방정식과 이차함수", ...A.quadFn),
          m("여러 가지 방정식과 부등식", "여러 가지 부등식", ...A.inequalities), // 2026-09-30 코덱스 교차 점검 반영
        ],
      },
      {
        major: "도형의 방정식", // 2026-09-30 코덱스 교차 점검 반영
        minors: [
          m("평면좌표", ...A.plane),
          m("직선의 방정식", ...A.line),
          m("원의 방정식", ...A.circle),
          m("도형의 이동", ...A.moving),
        ],
      },
    ],
  },
  {
    id: "h2015-math-lower",
    label: "수학(하)",
    curriculum: "2015",
    verified: true,
    track: "math-lower",
    level: "high",
    aliases: ["수학(하)", "수학 하"],
    units: [
      // 도형의 방정식은 수학(상)으로 옮김 // 2026-09-30 코덱스 교차 점검 반영
      { major: "집합과 명제", minors: [m("집합", ...A.set), m("명제", ...A.prop)] },
      { major: "함수", aliases: ["함수와 그래프"], minors: [m("함수", ...A.fn), m("유리함수와 무리함수", ...A.ratFn)] },
      {
        major: "경우의 수", // 2026-09-30 코덱스 교차 점검 반영
        minors: [
          m("경우의 수", "합의 법칙", "곱의 법칙", "합의 법칙과 곱의 법칙"), // 2026-09-30 코덱스 교차 점검 반영
          m("순열과 조합", "순열", "조합"), // 2026-09-30 코덱스 교차 점검 반영
        ],
      },
    ],
  },
  {
    id: "h2015-math1",
    label: "수학Ⅰ",
    curriculum: "2015",
    verified: true,
    track: "algebra",
    level: "high",
    aliases: ["수학Ⅰ", "수학1", "수1"],
    units: [
      {
        major: "지수함수와 로그함수",
        minors: [m("지수", ...A.exp), m("로그", ...A.log), m("지수함수", ...A.expFn), m("로그함수", ...A.logFn)],
      },
      {
        major: "삼각함수",
        minors: [
          m("삼각함수", ...A.trig),
          m("삼각함수의 그래프", ...A.trigGraph),
          m("삼각함수의 활용", "사인법칙과 코사인법칙", ...A.lawOfSines), // 2026-09-30 코덱스 교차 점검 반영
        ],
      },
      {
        major: "수열",
        minors: [m("등차수열과 등비수열", ...A.arith), m("수열의 합", ...A.sum), m("수학적 귀납법", ...A.induction)],
      },
    ],
  },
  {
    id: "h2015-math2",
    label: "수학Ⅱ",
    curriculum: "2015",
    verified: true,
    track: "calc1",
    level: "high",
    aliases: ["수학Ⅱ", "수학2", "수2"],
    units: [
      {
        major: "함수의 극한과 연속",
        aliases: ["극한과 연속"],
        minors: [m("함수의 극한", ...A.limit), m("함수의 연속", ...A.continuity)],
      },
      {
        major: "미분",
        aliases: ["미분법", "다항함수의 미분법"],
        minors: [m("미분계수와 도함수", ...A.derivative), m("도함수의 활용", ...A.derivUse)],
      },
      {
        major: "적분",
        aliases: ["적분법", "다항함수의 적분법"],
        minors: [m("부정적분과 정적분", ...A.integral), m("정적분의 활용", ...A.integralUse1)],
      },
    ],
  },
  {
    id: "h2015-calculus",
    label: "미적분",
    curriculum: "2015",
    verified: true,
    track: "calc2",
    level: "high",
    aliases: ["미적분"],
    units: [
      { major: "수열의 극한", minors: [m("수열의 극한", ...A.seqLimit), m("급수", ...A.series)] },
      {
        major: "미분법",
        minors: [
          m("여러 가지 함수의 미분", ...A.funcDiff),
          m("여러 가지 미분법", ...A.diffMethods),
          m("도함수의 활용", ...A.derivUse2),
        ],
      },
      { major: "적분법", minors: [m("여러 가지 적분법", ...A.intMethods), m("정적분의 활용", ...A.integralUse2)] },
    ],
  },
  {
    id: "h2015-prob-stat",
    label: "확률과통계",
    curriculum: "2015",
    verified: true,
    track: "prob-stat",
    level: "high",
    aliases: ["확률과통계", "확률과 통계", "확률통계", "확통"],
    units: [
      { major: "경우의 수", minors: [m("순열과 조합", ...A.perm), m("이항정리", ...A.binom)] },
      { major: "확률", minors: [m("확률의 뜻과 활용", "확률", ...A.prob), m("조건부확률", ...A.cond)] },
      { major: "통계", minors: [m("확률분포", ...A.dist), m("통계적 추정", ...A.estimate)] },
    ],
  },
  {
    id: "h2015-geometry",
    label: "기하",
    curriculum: "2015",
    verified: true,
    track: "geometry",
    level: "high",
    aliases: ["기하"],
    units: [
      { major: "이차곡선", minors: [m("이차곡선", ...A.conic)] },
      {
        major: "평면벡터",
        // 평면운동 삭제, 평면벡터의 연산·평면벡터의 성분과 내적 // 2026-09-30 코덱스 교차 점검 반영
        minors: [
          m("평면벡터의 연산", "평면벡터", "벡터의 연산", "벡터의 덧셈과 뺄셈", "벡터의 실수배"), // 2026-09-30 코덱스 교차 점검 반영
          m("평면벡터의 성분과 내적", "평면벡터의 성분", "평면벡터의 내적", "벡터의 내적", "직선과 원의 벡터방정식"), // 2026-09-30 코덱스 교차 점검 반영
        ],
      },
      { major: "공간도형과 공간좌표", minors: [m("공간도형", ...A.spaceFig), m("공간좌표", ...A.spaceCoord)] },
    ],
  },
];

// ───────────────────────────── 고등 2022 ─────────────────────────────

const HIGH_2022: CatalogSubject[] = [
  {
    id: "h2022-common1",
    label: "공통수학1",
    curriculum: "2022",
    verified: true,
    track: "common1",
    level: "high",
    aliases: ["공통수학1", "공수1"],
    units: [
      { major: "다항식", minors: [m("다항식의 연산", ...A.polyOps), m("나머지정리와 인수분해", ...A.remainder)] },
      {
        major: "방정식과 부등식",
        aliases: ["방정식", "부등식"],
        minors: [
          m("복소수와 이차방정식", "복소수", "이차방정식", ...A.complex, ...A.quadEq),
          m("이차방정식과 이차함수", ...A.quadFn),
          m("여러 가지 방정식과 부등식", "여러 가지 부등식", ...A.inequalities), // 2026-09-30 코덱스 교차 점검 반영
        ],
      },
      { major: "경우의 수", minors: [m("순열과 조합", ...A.perm)] },
      { major: "행렬", minors: [m("행렬과 그 연산", "행렬", "행렬과 연립일차방정식", "행렬의 연산", "행렬의 곱셈")] }, // 2026-09-30 코덱스 교차 점검 반영
    ],
  },
  {
    id: "h2022-common2",
    label: "공통수학2",
    curriculum: "2022",
    verified: true,
    track: "common2",
    level: "high",
    aliases: ["공통수학2", "공수2"],
    units: [
      {
        major: "도형의 방정식",
        minors: [
          m("직선과 원의 방정식", "평면좌표", "직선의 방정식", "원의 방정식", ...A.plane, ...A.line, ...A.circle),
          m("도형의 이동", ...A.moving),
        ],
      },
      { major: "집합과 명제", minors: [m("집합", ...A.set), m("명제", ...A.prop)] },
      { major: "함수와 그래프", aliases: ["함수"], minors: [m("함수", ...A.fn), m("유리함수와 무리함수", ...A.ratFn)] },
    ],
  },
  {
    id: "h2022-algebra",
    label: "대수",
    curriculum: "2022",
    verified: true,
    track: "algebra",
    level: "high",
    aliases: ["대수"],
    units: [
      {
        major: "지수함수와 로그함수",
        minors: [
          m("지수와 로그", "지수", "로그", ...A.exp, ...A.log),
          m("지수함수와 로그함수", "지수함수", "로그함수", ...A.expFn, ...A.logFn),
        ],
      },
      {
        major: "삼각함수",
        minors: [
          m("삼각함수", "삼각함수의 그래프", ...A.trig, ...A.trigGraph),
          m("사인법칙과 코사인법칙", ...A.lawOfSines),
        ],
      },
      {
        major: "수열",
        minors: [m("등차수열과 등비수열", ...A.arith), m("수열의 합", ...A.sum), m("수학적 귀납법", ...A.induction)],
      },
    ],
  },
  {
    id: "h2022-calc1",
    label: "미적분Ⅰ",
    curriculum: "2022",
    verified: true,
    track: "calc1",
    level: "high",
    aliases: ["미적분Ⅰ", "미적분1", "미적1"],
    units: [
      {
        major: "함수의 극한과 연속",
        aliases: ["극한과 연속"],
        minors: [m("함수의 극한", ...A.limit), m("함수의 연속", ...A.continuity)],
      },
      {
        major: "미분",
        aliases: ["미분법", "다항함수의 미분법"],
        minors: [m("미분계수와 도함수", ...A.derivative), m("도함수의 활용", ...A.derivUse)],
      },
      {
        major: "적분",
        aliases: ["적분법", "다항함수의 적분법"],
        minors: [m("부정적분과 정적분", ...A.integral), m("정적분의 활용", ...A.integralUse1)], // 2026-09-30 코덱스 교차 점검 반영
      },
    ],
  },
  {
    id: "h2022-prob-stat",
    label: "확률과통계",
    curriculum: "2022",
    verified: true,
    track: "prob-stat",
    level: "high",
    aliases: ["확률과통계", "확률과 통계", "확률통계", "확통"],
    units: [
      { major: "경우의 수", minors: [m("순열과 조합", ...A.perm), m("이항정리", ...A.binom)] },
      { major: "확률", minors: [m("확률", "확률의 뜻과 활용", ...A.prob), m("조건부확률", ...A.cond)] },
      {
        major: "통계",
        minors: [
          m("확률분포", ...A.dist),
          m("통계적 추정", ...A.estimate),
          m("모비율의 추정", "표본비율의 분포", "모비율"),
        ],
      },
    ],
  },
  {
    id: "h2022-calc2",
    label: "미적분Ⅱ",
    curriculum: "2022",
    verified: true,
    track: "calc2",
    level: "high",
    aliases: ["미적분Ⅱ", "미적분2", "미적2"],
    units: [
      { major: "수열의 극한", minors: [m("수열의 극한", ...A.seqLimit), m("급수", ...A.series)] },
      {
        major: "미분법",
        minors: [
          m("여러 가지 미분법", "여러 가지 함수의 미분", ...A.funcDiff, ...A.diffMethods),
          m("도함수의 활용", ...A.derivUse2),
        ],
      },
      { major: "적분법", minors: [m("여러 가지 적분법", ...A.intMethods), m("정적분의 활용", ...A.integralUse2)] },
    ],
  },
  {
    id: "h2022-geometry",
    label: "기하",
    curriculum: "2022",
    verified: true,
    track: "geometry",
    level: "high",
    aliases: ["기하"],
    // 순서: 이차곡선 → 공간도형과 공간좌표 → 벡터 // 2026-09-30 코덱스 교차 점검 반영
    units: [
      { major: "이차곡선", minors: [m("이차곡선", ...A.conic)] },
      { major: "공간도형과 공간좌표", aliases: ["공간도형"], minors: [m("공간도형", ...A.spaceFig, ...A.spaceCoord)] }, // 2026-09-30 코덱스 교차 점검 반영
      { major: "벡터", minors: [m("평면벡터", ...A.planeVec), m("공간벡터", ...A.spaceVec)] }, // 2026-09-30 코덱스 교차 점검 반영
    ],
  },
];

// ───────────────────────────── 중학교 (초안, verified: false) ─────────────────────────────

const MS = {
  primeFactor: m("소인수분해", "거듭제곱", "소수와 합성수", "최대공약수와 최소공배수", "최대공약수", "최소공배수"),
  integers: m(
    "정수와 유리수",
    "정수와 유리수의 계산",
    "정수와 유리수의 덧셈과 뺄셈",
    "정수와 유리수의 곱셈과 나눗셈",
    "수직선"
  ),
  letters: m("문자의 사용과 식의 계산", "문자의 사용", "일차식의 계산", "식의 값", "문자의 사용과 식"),
  linearEq: m("일차방정식", "일차방정식의 풀이", "일차방정식의 활용", "방정식과 그 해"),
  coord: m("좌표와 그래프", "좌표평면과 그래프", "순서쌍과 좌표"),
  proportion: m("정비례와 반비례", "정비례", "반비례"),
  basicFig: m("기본 도형", "점 선 면 각", "점과 선", "각"),
  position: m("위치 관계", "평행선의 성질", "평행선"),
  construct: m("작도와 합동", "작도", "삼각형의 작도", "삼각형의 합동"),
  polygon: m("다각형", "다각형의 내각과 외각"),
  sector: m("원과 부채꼴", "부채꼴의 호의 길이와 넓이"),
  polyhedron: m("다면체와 회전체", "다면체", "회전체"),
  solidArea: m("입체도형의 겉넓이와 부피", "겉넓이와 부피"),
  dataStat: m("자료의 정리와 해석", "줄기와 잎 그림", "도수분포표", "히스토그램", "상대도수"),
  repeating: m("유리수와 순환소수", "유리수와 소수", "순환소수"),
  exprCalc: m("식의 계산", "단항식의 계산", "다항식의 계산", "지수법칙"),
  linearIneq: m("일차부등식", "부등식의 성질", "일차부등식의 활용", "연립부등식"),
  simulEq: m("연립일차방정식", "연립방정식", "연립방정식의 활용", "연립일차방정식의 활용"),
  linearFn: m("일차함수와 그래프", "일차함수", "일차함수의 그래프", "일차함수의 활용", "함수와 함숫값"),
  linearFnEq: m("일차함수와 일차방정식의 관계", "일차함수와 일차방정식", "연립일차방정식과 그래프"),
  triangle: m("삼각형의 성질", "이등변삼각형의 성질", "삼각형의 외심과 내심", "외심과 내심"),
  quadrilateral: m("사각형의 성질", "평행사변형", "평행사변형의 성질", "여러 가지 사각형"),
  similarity: m("도형의 닮음", "닮은 도형", "삼각형의 닮음 조건"),
  similarityUse: m("닮음의 활용", "평행선과 선분의 길이의 비", "삼각형의 무게중심", "닮은 도형의 넓이와 부피"),
  pythagoras: m("피타고라스 정리", "피타고라스 정리의 활용"),
  cases: m("경우의 수"),
  probability: m("확률", "확률의 계산", "확률과 그 기본 성질"),
};

const midCommon = (grade: 1 | 2, sem: 1 | 2): CatalogMajor[] => {
  if (grade === 1 && sem === 1) {
    return [
      { major: "수와 연산", aliases: ["수와 식"], minors: [MS.primeFactor, MS.integers] },
      { major: "문자와 식", minors: [MS.letters, MS.linearEq] },
      { major: "좌표평면과 그래프", aliases: ["함수"], minors: [MS.coord, MS.proportion] },
    ];
  }
  if (grade === 1) {
    return [
      { major: "기본 도형", minors: [MS.basicFig, MS.position, MS.construct] },
      { major: "평면도형", aliases: ["평면도형의 성질"], minors: [MS.polygon, MS.sector] },
      { major: "입체도형", aliases: ["입체도형의 성질"], minors: [MS.polyhedron, MS.solidArea] },
      { major: "통계", aliases: ["자료의 정리와 해석"], minors: [MS.dataStat] },
    ];
  }
  if (sem === 1) {
    return [
      { major: "수와 식", aliases: ["수와 연산"], minors: [MS.repeating, MS.exprCalc] },
      { major: "부등식과 연립방정식", aliases: ["부등식", "연립방정식", "방정식"], minors: [MS.linearIneq, MS.simulEq] },
      { major: "일차함수", aliases: ["함수"], minors: [MS.linearFn, MS.linearFnEq] },
    ];
  }
  return [
    { major: "도형의 성질", minors: [MS.triangle, MS.quadrilateral] },
    { major: "도형의 닮음", aliases: ["도형의 닮음과 피타고라스 정리"], minors: [MS.similarity, MS.similarityUse, MS.pythagoras] },
    { major: "확률", minors: [MS.cases, MS.probability] },
  ];
};

const midSubject = (curriculum: CurriculumYear, grade: 1 | 2 | 3, sem: 1 | 2, units: CatalogMajor[]): CatalogSubject => ({
  id: `m${curriculum}-${grade}-${sem}`,
  label: `중${grade}-${sem}`,
  curriculum,
  verified: false,
  track: `중${grade}-${sem}`,
  level: "middle",
  aliases: [`중${grade}-${sem}`],
  units,
});

const MIDDLE: CatalogSubject[] = [
  // 2015 개정 — 중1·중2 단원은 2022 초안과 같게 두었다. 확인 필요
  midSubject("2015", 1, 1, midCommon(1, 1)),
  midSubject("2015", 1, 2, midCommon(1, 2)),
  midSubject("2015", 2, 1, midCommon(2, 1)),
  midSubject("2015", 2, 2, midCommon(2, 2)),
  midSubject("2015", 3, 1, [
    {
      major: "실수와 그 연산",
      aliases: ["제곱근과 실수", "실수와 그 계산"],
      minors: [
        m("제곱근과 실수", "제곱근의 뜻과 성질", "제곱근의 뜻과 정의", "무리수와 실수", "제곱근의 대소 관계"),
        m("근호를 포함한 식의 계산", "제곱근의 곱셈과 나눗셈", "제곱근의 덧셈과 뺄셈", "분모의 유리화"),
      ],
    },
    {
      major: "다항식의 곱셈과 인수분해",
      minors: [
        m("다항식의 곱셈", "곱셈 공식", "곱셈 공식의 활용"),
        m("인수분해", "인수분해 공식", "인수분해 공식의 활용", "인수분해의 활용"),
      ],
    },
    { major: "이차방정식", minors: [m("이차방정식", "이차방정식의 풀이", "이차방정식의 활용", "근의 공식")] },
    { major: "이차함수", minors: [m("이차함수와 그래프", "이차함수의 그래프", "이차함수의 활용")] },
  ]),
  midSubject("2015", 3, 2, [
    { major: "삼각비", minors: [m("삼각비", "삼각비의 뜻", "삼각비의 값"), m("삼각비의 활용")] },
    {
      major: "원의 성질",
      minors: [m("원과 직선", "원의 현", "원의 접선"), m("원주각", "원주각의 성질", "원주각의 활용", "원에 내접하는 사각형")],
    },
    {
      major: "통계",
      minors: [m("대푯값과 산포도", "대푯값", "산포도", "분산과 표준편차"), m("상관관계", "산점도", "산점도와 상관관계")],
    },
  ]),
  // 2022 개정 — 확인 필요(중1-2 통계 대푯값만 반영, 나머지 세부 차이 미반영)
  midSubject("2022", 1, 1, midCommon(1, 1)),
  midSubject("2022", 1, 2, [
    ...midCommon(1, 2).slice(0, 3),
    {
      major: "통계",
      aliases: ["자료의 정리와 해석"],
      minors: [
        m("대푯값", "평균", "중앙값", "최빈값", "평균, 중앙값, 최빈값"), // 2026-09-30 코덱스 교차 점검 반영
        MS.dataStat,
      ],
    },
  ]),
  midSubject("2022", 2, 1, midCommon(2, 1)),
  midSubject("2022", 2, 2, midCommon(2, 2)),
];

// ───────────────────────────── 초등 2022 (초안, verified: false) ─────────────────────────────

// 단원 이름은 2015 개정 교과서 기준 기억에 의존한 초안이다. 2022 개정 새 교과서와 다를 수 있음 — 확인 필요
const ELEMENTARY_UNITS: Record<string, string[]> = {
  "3-1": ["덧셈과 뺄셈", "평면도형", "나눗셈", "곱셈", "길이와 시간", "분수와 소수"],
  "3-2": ["곱셈", "나눗셈", "원", "분수", "들이와 무게", "자료의 정리"],
  "4-1": ["큰 수", "각도", "곱셈과 나눗셈", "평면도형의 이동", "막대그래프", "규칙 찾기"],
  "4-2": ["분수의 덧셈과 뺄셈", "삼각형", "소수의 덧셈과 뺄셈", "사각형", "꺾은선그래프", "다각형"],
  "5-1": ["자연수의 혼합 계산", "약수와 배수", "규칙과 대응", "약분과 통분", "분수의 덧셈과 뺄셈", "다각형의 둘레와 넓이"],
  "5-2": ["수의 범위와 어림하기", "분수의 곱셈", "합동과 대칭", "소수의 곱셈", "직육면체", "평균과 가능성"],
  "6-1": ["분수의 나눗셈", "각기둥과 각뿔", "소수의 나눗셈", "비와 비율", "여러 가지 그래프", "직육면체의 부피와 겉넓이"],
  "6-2": ["분수의 나눗셈", "소수의 나눗셈", "공간과 입체", "비례식과 비례배분", "원의 넓이", "원기둥, 원뿔, 구"],
};

/** 초등 단원 별칭 — `${학기}:${단원}` */
const ELEMENTARY_ALIASES: Record<string, string[]> = {
  "3-2:자료의 정리": ["그림그래프"], // 2026-09-30 코덱스 교차 점검 반영
};

const ELEMENTARY: CatalogSubject[] = Object.entries(ELEMENTARY_UNITS).map(([term, names]) => ({
  id: `e2022-${term}`,
  label: `초${term}`,
  curriculum: "2022" as const,
  verified: false,
  track: `초${term}`,
  level: "elementary" as const,
  aliases: [`초${term}`],
  units: names.map((name) => ({ major: name, minors: [m(name, ...(ELEMENTARY_ALIASES[`${term}:${name}`] ?? []))] })),
}));

export const CURRICULUM_CATALOG: CatalogSubject[] = [...ELEMENTARY, ...MIDDLE, ...HIGH_2015, ...HIGH_2022];

export function getSubjectById(id: string): CatalogSubject | undefined {
  return CURRICULUM_CATALOG.find((s) => s.id === id);
}
