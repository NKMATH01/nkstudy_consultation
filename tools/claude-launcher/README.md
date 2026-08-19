# Claude Code 바로 열기 (상단 바 버튼)

등록·퇴원 프로그램 상단 바(GNB) 오른쪽의 **Claude Code** 버튼을 누르면 이 PC 에서
이 저장소를 연 Claude Code CLI 가 열린다.

원본은 업무보고 저장소의 `tools/claude-launcher/` 이고, 이 폴더는 그 복제본이다.
**프로토콜 이름만 이 앱 것(`claudecode-consult`)으로 바뀌어 있다.**

## 왜 이런 방식인가

브라우저는 보안상 로컬 프로그램을 직접 실행할 수 없다. 대신 **Windows 에 등록된 URL 프로토콜**을
여는 것은 허용된다 — `vscode://`·`zoommtg://` 링크가 프로그램을 여는 것과 같은 방식이다.
그래서 `claudecode-consult://` 를 이 PC 에 한 번 등록해 두고, 웹 화면은 그 링크를 열기만 한다.

**서버(Vercel)에서는 아무것도 실행되지 않는다.** 서버리스라 터미널을 띄울 수 없기도 하고,
띄운다면 그 화면에 들어온 사람이 Supabase 키와 학생·학부모 데이터를 전부 만지게 된다.
실행은 **그 PC 안에서만** 일어나고, 웹 앱은 셸 권한을 갖지 않는다.

구독으로 쓰는 Claude Code 를 그대로 띄우므로 **API 키도, 추가 과금도 필요 없다.**

## 앱마다 프로토콜 이름이 다르다

프로토콜 등록은 `HKCU\Software\Classes\<프로토콜>` 한 자리를 차지한다. NK 프로그램이 전부
`claudecode://` 를 쓰면 **마지막에 등록한 저장소가 이기고**, 어느 프로그램에서 눌러도 같은
저장소가 열린다. 그래서 등록·퇴원은 `claudecode-consult` 를 쓴다.

| 프로그램 | 프로토콜 |
|---|---|
| 업무보고 | `claudecode` (기존 유지) |
| 보강관리 | `claudecode-bogang` |
| 학습관리 | `claudecode-lms` |
| 숙제관리 | `claudecode-homework` |
| 학생상담 | `claudecode-counseling` |
| **등록·퇴원** | **`claudecode-consult`** |
| 설문조사 | `claudecode-survey` |
| 클리닉 강사 관리 | `claudecode-clinic` |

## 설치 (PC 마다 한 번)

이 저장소 폴더에서 PowerShell 을 열고:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\claude-launcher\register.ps1"
```

관리자 권한은 필요 없다(현재 사용자 레지스트리 `HKCU` 에만 쓴다).

설치 뒤 상단 바에서 버튼을 누르면 브라우저가 *"이 사이트에서 Claude Code 를 여시겠습니까?"* 라고
묻는다. 허용하면 Windows Terminal(없으면 명령 프롬프트)이 이 저장소 폴더에서 `claude` 로 열린다.

## 해제

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\claude-launcher\unregister.ps1"
```

## 알아둘 것

- **PC 마다 · 저장소마다 등록해야 한다.** 등록은 그 PC 에만 남는다. 등록 안 된 PC 에서는 버튼을
  눌러도 브라우저가 조용히 무시한다.
- **휴대폰에서는 열리지 않는다.**
- **Claude Code 가 먼저 설치·로그인돼 있어야 한다.** `claude` 명령이 없으면 창만 뜨고 끝난다.
- **무엇을 열지는 이 폴더의 위치로 정해진다.** `register.ps1` 이 `$PSScriptRoot` 기준으로 저장소
  루트를 찾아 레지스트리에 절대 경로를 박는다. 저장소를 옮기면 **다시 등록**해야 한다.

## 줄바꿈·인코딩 주의 (건드릴 때) — 업무보고에서 실제로 한 번 깨졌다

### `.cmd` 는 반드시 CRLF 줄바꿈으로 저장한다

**엉뚱한 폴더에서 열리던 버그의 진짜 원인은 줄바꿈이었다.** `cmd.exe` 는 `goto`/라벨을 만나면
**파일을 바이트 오프셋으로 되짚어** 다음 줄을 찾는데, 그 계산이 줄바꿈을 CRLF(2바이트)로 전제한다.
LF(1바이트)만 있는 파일에서는 줄을 넘어갈 때마다 오프셋이 밀려서, 결국 **파일이 엉뚱한 위치에서
조각나 실행된다** — `REM` 주석 일부가 명령으로 실행되고 `start` 줄이 깨진다.

다른 PC 에서 체크아웃할 때 다시 LF 로 풀리지 않도록 저장소 루트 `.gitattributes` 에 못박아 뒀다:

```
*.cmd text eol=crlf
```

편집기가 LF 로 저장해 버렸다면 이렇게 되돌린다:

```powershell
$f = ".\tools\claude-launcher\open-claude.cmd"
$t = [IO.File]::ReadAllText((Resolve-Path $f))
[IO.File]::WriteAllText((Resolve-Path $f), ($t -replace "`r?`n", "`r`n"))
```

### `.cmd` 는 ASCII 로만 쓴다 (사유는 CRLF 와 다르다)

`cmd.exe` 는 `.cmd` 를 **콘솔 코드페이지**(한국어 Windows 는 `cp949`)로 읽는데 파일은 UTF-8 로
저장되므로, 한글을 넣으면 줄바꿈과는 별개의 깨짐이 생긴다. 그래서 `open-claude.cmd` 의 주석·출력은
전부 영문이다. 설명이 필요하면 **이 README 에** 쓴다.

> 두 규칙을 하나로 묶어 기억하지 마라 — 사유가 다르고, 하나만 고치면 안 낫는다.
> 예전에 원인을 "비 ASCII 바이트"로 진단하고 주석만 영어로 바꾼 커밋이 있었는데 그 진단은 틀렸다.
> 진짜 원인은 위의 CRLF 였다. 다만 코드페이지 문제는 별개로 존재하므로 ASCII 규약은 그대로 지킨다.

이 README 는 UTF-8 그대로 둔다. ASCII 규약은 `.cmd` 파일에만 해당한다.

### `register.ps1`·`unregister.ps1` 은 UTF-8 BOM + CRLF 로 저장한다

Windows PowerShell 5.1 은 BOM 이 없는 `.ps1` 을 시스템 ANSI 코드페이지로 읽어서 한글 안내문이
전부 깨진다. 편집기가 BOM 을 떼고 저장했다면 이렇게 되돌린다:

```powershell
$f = ".\tools\claude-launcher\register.ps1"
$t = [IO.File]::ReadAllText((Resolve-Path $f), [Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Resolve-Path $f), $t, (New-Object Text.UTF8Encoding($true)))
```

## 보안에서 지킨 것

`open-claude.cmd` 는 **URL 인자(`%1`)를 절대 쓰지 않는다.** 열 폴더나 실행할 명령을 URL 이 정하게
하면 아무 웹사이트나 `claudecode-consult://...` 링크 하나로 이 PC 의 임의 폴더를 열거나 명령을
끼워 넣을 수 있다. 무엇을 열지는 **런처 파일이 놓인 위치**로만 정한다.
