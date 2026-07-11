// 코럴 리디자인 — 미리보기용 mock 데이터 + 데이터 접근 추상화.
// 컴포넌트는 getListItems / getSummary / SUMMARY_LABELS 만 사용한다.
// ★ API 교체 지점: 실제 서비스에서는 getListItems / getSummary 내부만 fetch("/api/...")로 바꾸고
//   반환 타입(ListItem / Summary)만 유지하면 UI는 그대로 동작한다.
// 이름은 전부 가상 인물이며 실존 학생 이름을 쓰지 않는다.

import { type CategoryId } from "@/constants/menu";

export type Grade = "초" | "중" | "고";
export type Status = "대기" | "진행" | "완료";

export interface ListItem {
  id: string;
  grade: Grade;
  title: string;
  /** 부제목 2줄(‘/’로 구분) */
  subtitle: string;
  /** YYYY-MM-DD */
  date: string;
  isNew: boolean;
  status: Status;
}

export interface Summary {
  total: number;
  thisWeek: number;
  waiting: number;
  done: number;
}

/** 카테고리별 요약 카드 라벨(전체/이번주/대기/완료 순). */
export const SUMMARY_LABELS: Record<CategoryId, [string, string, string, string]> = {
  cat1: ["전체 상담", "이번 주 상담", "대기 중", "완료"],
  cat2: ["전체 설문", "이번 주 제출", "분석 대기", "분석 완료"],
  cat3: ["전체 학생", "이번 주 등록", "상담 필요", "재원"],
};

// ── 카테고리별 현실 더미(제목·부제·학년). 날짜·NEW·상태는 아래 stamp에서 파생. ──
type Raw = { grade: Grade; title: string; subtitle: string };

const CAT1_RAW: Raw[] = [
  { grade: "중", title: "홍길동 학생 신규 상담", subtitle: "학부모 상담 요청 · 등록 전 상담 / 희망 과목: 수학 · 담당 미배정" },
  { grade: "고", title: "예약: 7/15(수) 17:00 · 학부모 상담", subtitle: "정규 상담 예약 · 대면 / 상담실 A · 성적표 지참 안내" },
  { grade: "초", title: "김하늘 학생 등록 상담", subtitle: "형제 등록 문의 · 시간표 조율 / 희망 과목: 영어 · 셔틀 이용" },
  { grade: "중", title: "이서준 학생 재상담", subtitle: "지난 상담 후속 · 반 배정 논의 / 수학 B반 검토 중" },
  { grade: "고", title: "예약: 7/16(목) 19:00 · 진학 상담", subtitle: "고3 진학·내신 상담 / 목표: 수시 · 담당 원장" },
  { grade: "중", title: "박지우 학생 신규 상담", subtitle: "지인 추천 유입 · 레벨테스트 예정 / 희망: 수학·영어" },
  { grade: "초", title: "최민재 학생 등록 상담", subtitle: "초등 단과 문의 / 요일: 화·목 · 오후반" },
  { grade: "고", title: "예약: 7/17(금) 18:00 · 학부모 상담", subtitle: "성적 하락 상담 요청 / 최근 모의고사 지참" },
  { grade: "중", title: "정예린 학생 상담 완료", subtitle: "등록 확정 · 반 배정 완료 / 수학 A반 · 7/21 첫 수업" },
  { grade: "고", title: "강도윤 학생 신규 상담", subtitle: "타 학원 이동 문의 / 현재 진도 확인 필요" },
];

const CAT2_RAW: Raw[] = [
  { grade: "중", title: "김하늘 학습 성향 설문 제출", subtitle: "7-Factor 설문 완료 · 분석 대기 / 제출 시각 오후 3:20" },
  { grade: "고", title: "성향분석 완료 · 결과지 생성됨", subtitle: "이서준 학생 · AI 분석 완료 / 결과지 공유 대기" },
  { grade: "초", title: "박지우 학습 성향 설문 제출", subtitle: "V2 학습 프로필 설문 · 분석 대기 / 진단 과목: 수학" },
  { grade: "중", title: "홍길동 설문 미완료 · 재요청 발송", subtitle: "진행률 30% · 리마인드 알림 발송함 / 마감 안내 포함" },
  { grade: "고", title: "성향분석 완료 · 결과지 생성됨", subtitle: "최민재 학생 · 상담자용/학부모용 생성 / 카카오 공유 준비" },
  { grade: "중", title: "정예린 학습 성향 설문 제출", subtitle: "설문 제출 완료 · 분석 대기 / 진단 과목: 수학·영어" },
  { grade: "초", title: "설문 피드백 응답 도착", subtitle: "학부모 만족도 응답 · 확인 필요 / 드립 설문 3회차" },
  { grade: "고", title: "강도윤 진도 현황 업데이트", subtitle: "주간 진도 80% · 목표 대비 양호 / 클리닉 참여 3회" },
  { grade: "중", title: "윤소율 학습 성향 설문 제출", subtitle: "설문 완료 · 분석 대기 / MBTI 보조 정보 포함" },
  { grade: "고", title: "성향분석 완료 · 결과지 생성됨", subtitle: "임하준 학생 · 분석 완료 / 등록 안내문 생성 대기" },
];

const CAT3_RAW: Raw[] = [
  { grade: "중", title: "중2 수학B반 배정 변경", subtitle: "정예린 학생 · A반 → B반 이동 / 사유: 레벨 조정" },
  { grade: "초", title: "김하늘 신규 학생 등록", subtitle: "초4 영어 단과 · 화·목반 / 셔틀 이용 · 담당 배정 완료" },
  { grade: "고", title: "고1 국어반 신설 검토", subtitle: "수요 조사 결과 · 개설 대기 / 예상 인원 8명" },
  { grade: "중", title: "이서준 반 이동 요청", subtitle: "학부모 요청 · 시간표 조율 중 / 수학 C반 검토" },
  { grade: "고", title: "선생님 권한 변경", subtitle: "박선생 · 조회 권한 → 편집 권한 / 반 관리 담당" },
  { grade: "중", title: "박지우 상담 필요 표시", subtitle: "최근 결석 3회 · 상담 권장 / 담임 확인 요망" },
  { grade: "초", title: "최민재 재원 상태 갱신", subtitle: "휴원 → 재원 전환 / 7/22 복귀 예정" },
  { grade: "고", title: "강도윤 퇴원 처리 예정", subtitle: "학부모 통보 · 퇴원 상담 필요 / 사유 확인 중" },
  { grade: "중", title: "신규 선생님 계정 생성", subtitle: "윤선생 · 수학 담당 배정 / 초기 권한 설정 완료" },
  { grade: "고", title: "임하준 신규 학생 등록", subtitle: "고2 수학 종합 · 월수금반 / 레벨테스트 통과" },
];

// ── 파생 필드(날짜·NEW·상태) 부여 ──────────────────────────────────────────
const TODAY = new Date("2026-07-11T00:00:00Z");
const STATUSES: Status[] = ["대기", "진행", "완료"];

function isoMinusDays(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(TODAY.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function stamp(raw: Raw[], seed: number): ListItem[] {
  return raw.map((r, i) => ({
    id: `${seed}-${i + 1}`,
    grade: r.grade,
    title: r.title,
    subtitle: r.subtitle,
    date: isoMinusDays(i * 2 + (seed % 2)),
    isNew: i < 2, // 최근 2건만 NEW
    status: STATUSES[(i * 2 + seed) % STATUSES.length],
  }));
}

const MOCK_BY_CATEGORY: Record<CategoryId, ListItem[]> = {
  cat1: stamp(CAT1_RAW, 0),
  cat2: stamp(CAT2_RAW, 1),
  cat3: stamp(CAT3_RAW, 2),
};

/** ★ API 교체 지점 — 목록 조회. 실제 서비스에선 서버/DB 조회로 대체. */
export function getListItems(categoryId: CategoryId): ListItem[] {
  return MOCK_BY_CATEGORY[categoryId];
}

/** ★ API 교체 지점 — 요약 수치(목록에서 파생). 실제 서비스에선 서버 집계로 대체 가능. */
export function getSummary(categoryId: CategoryId): Summary {
  const items = MOCK_BY_CATEGORY[categoryId];
  const weekAgo = new Date(TODAY);
  weekAgo.setUTCDate(TODAY.getUTCDate() - 7);
  return {
    total: items.length,
    thisWeek: items.filter((i) => new Date(i.date) >= weekAgo).length,
    waiting: items.filter((i) => i.status === "대기").length,
    done: items.filter((i) => i.status === "완료").length,
  };
}
