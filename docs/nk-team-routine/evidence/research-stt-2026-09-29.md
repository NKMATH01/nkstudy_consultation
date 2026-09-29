# 상담 녹음 전사 — 구글 API 조사 (2026-09-29, 리서처 Sonnet 5.5 + 팀장 실측)

## 결론
**Gemini API `gemini-3.5-transcribe`(화자 구분 켬)로 20~25분 조각 단위 전사 → 전사문을 Claude 가 분석.**
- 기존 `GEMINI_API_KEY` 그대로. Google Cloud 프로젝트·GCS·서비스 계정 불필요.
- 화자 구분(diarization)·단어 타임스탬프를 켜면 요청당 30분 제한 → 조각 분할 필수. 조각마다 화자 라벨이 바뀔 수 있어 원장/학부모/학생 매칭은 후처리(Claude).
- 대안: Google Cloud STT V2 `chirp_3`(ko-KR 화자 분리 GA). GCS·서비스 계정 필요, 1시간 제한 → 지금은 과함.

## 팀장 실측 (이 저장소의 GEMINI_API_KEY 로 모델 목록 조회, 읽기만)
| 모델 | 입력 한도 | 출력 한도 | 메서드 |
|---|---|---|---|
| `gemini-3.5-transcribe` | 98,304 | 32,768 | generateContent, countTokens |
| `gemini-3.5-transcribe-live` | 131,072 | 65,536 | bidiGenerateContent (실시간) |
| `gemini-3.8-flash` | 1,048,576 | 65,536 | generateContent 등 |
| `gemini-3.6-flash` (설문 분석에 사용 중) | 1,048,576 | 65,536 | generateContent 등 |

입력 98,304 토큰 ÷ 오디오 32토큰/초 ≈ 51분(25토큰/초면 약 65분) → "요청당 1시간" 문서와 대략 일치. 출력 32,768 토큰 → 한국어 60분 전사문(추정 3만~4만 토큰)을 한 번에 내기엔 부족 → **조각 분할이 필수**.

## 리서처 요지 (출처는 리서처 보고, 수치는 대부분 Google 발표 · 일부 추정)
- 전사 모델: 요청당 1시간, 화자 구분·타임스탬프 켜면 30분, 화자 최대 8명(3명 이상 experimental), ko-KR 지원 — https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe (2026-09-23)
- Files API: 파일당 2GB, 프로젝트당 20GB, 48시간 보관 — https://ai.google.dev/gemini-api/docs/files
- 긴 오디오 알려진 문제: 약 18분 이후 반복 루프·타임스탬프 밀림, 한국어 인터뷰 통째 환각 사례(블로그 수준) → 조각 분할·겹침 병합·프롬프트 제약
- 60분 1건 비용: 3.5 Transcribe 약 $0.54 · 3.8 Flash 약 $0.25~0.3(추정) · Chirp 3 표준 약 $0.96 / Dynamic batch 약 $0.24(2차 자료, 추정)
- 브라우저 녹음: Wake Lock 은 2025-03부터 주요 브라우저 Baseline(탭 숨김 시 해제 → visibilitychange 에서 재요청). iOS Safari 는 화면 잠금·백그라운드에서 녹음 중단 보고 → 녹음 중 화면 켜 두기. 코덱 Chrome webm/opus · Safari mp4/aac(추정) → `MediaRecorder.isTypeSupported()` 분기. 32kbps 60분 ≈ 14.4MB. `start(timeslice)` 조각을 IndexedDB 에 저장 후 주기 업로드 권장. iOS timeslice 조각은 단독 재생 불가 가능 → 서버에서 이어 붙임(https://bugs.webkit.org/show_bug.cgi?id=202233)
- Vercel: 요청 본문 4.5MB → 오디오는 브라우저에서 Supabase Storage 로 직접. 함수 최대 Hobby 300초 · Pro 800초 → 60분 전사를 한 함수에서 기다리면 위험 — https://vercel.com/docs/functions/limitations (2026-08-24)
- 법(일반 권고, 법률 자문 아님): 음성은 개인정보(개인정보보호법 제2조). 녹음 전 목적·항목·보관기간·국외이전(Google·Anthropic) 고지와 동의. 만 14세 미만은 법정대리인 동의(제22조의2). 원본 오디오는 전사 후 단기 삭제(예: 30일) 권고.


## 팀장 실측 2 — 실제 전사 호출 (합성 음성, 개인정보 없음, 2026-09-29 16:28~16:32)
합성 음성: `gemini-3.8-flash-tts` 로 원장(Charon)·학부모(Kore) 한국어 대화 4문장 27.3초 → ffmpeg 로 webm(opus 32k)·mp4(aac 48k).
- **요청 형식 확정**: `POST /v1beta/interactions`, `{"model":"gemini-3.5-transcribe","input":[{"type":"audio","data":"<base64>","mime_type":"audio/webm"}],"generation_config":{"transcription_config":{"language_codes":["ko-KR"],"mode":{"type":"verbatim","diarization_mode":"speaker","timestamp_granularities":["word"]}}}}` — 인라인 필드 이름은 `data`.
- **형식**: audio/webm · audio/mp4 · audio/m4a · audio/aac 모두 200(문서 목록에 없는 audio/mp4 도 됨).
- **응답**: `status:"completed"`, `steps[0].content[0].text` + `annotations[]`(`start_index,end_index,text,start_offset:"0.400s",end_offset,speaker:"spk:0",type:"word_info"`). 화자 라벨은 `spk:0` 형식.
- **정확도**: webm 은 4문장 화자 교대 정확. mp4 는 같은 목소리를 `spk:2` 로 새로 나눈 곳 1개 → 분석 단계 화자 재매칭 필요.
- **속도**: 27초 → 4~7초. **10분 webm(2.47MB) → 24.7초**, 마지막 단어 599.8초(끝까지 누락 없음), 화자 2명 정확. 오디오 25토큰/초(10분 = 15,000), 출력 2,112토큰.
- 결론: 10분 조각 + route `maxDuration=300` 여유 충분(약 12배).
