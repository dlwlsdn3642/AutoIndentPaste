<div align="center">

# AutoIndentPaste

붙여넣기 시 들여쓰기를 자동 정렬합니다. 언어와 무관하며, 탭/스페이스를 정확히 인식하고 멀티 커서에도 잘 동작합니다.

<br/>

<img src="icon.png" alt="AutoIndentPaste icon" width="96" />

<br/>

<a href="https://code.visualstudio.com/">
  <img alt="VS Code" src="https://img.shields.io/badge/VS%20Code-%E2%89%A51.97.2-007ACC?logo=visualstudiocode&logoColor=white" />
</a>
<a href="LICENSE">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg" />
</a>
<img alt="TypeScript" src="https://img.shields.io/badge/Built%20with-TypeScript-3178C6?logo=typescript&logoColor=white" />

<br/>
<br/>

![AutoIndentPaste Demo](https://github.com/dlwlsdn3642/AutoIndentPaste/raw/main/demo/demo.gif)

<a href="README.md">English</a>

</div>

## 목차

- [특징](#특징)
- [데모](#데모)
- [동작 원리](#동작-원리)
- [예시](#예시)
- [설치](#설치)
- [사용법](#사용법)
- [설정](#설정)
- [알려진 동작과 trade-off](#알려진-동작과-trade-off)
- [문제 해결](#문제-해결)
- [개발](#개발)
- [설계 의도](#설계-의도)
- [라이선스](#라이선스)

## 특징

- 정확한 컬럼 기반 들여쓰기: 현재 `tabSize`를 사용해 선행 공백을 시각적 컬럼으로 환산합니다. 탭/스페이스가 섞여도 원하는 들여쓰기에 맞게 붙여넣습니다.
- 첫 줄 고정, 이후 정렬: 붙여넣은 첫 줄은 그대로 두고, 이후 줄은 커서 위치의 들여쓰기에 맞춰 정렬합니다. 블록 일부만 붙여넣을 때 예측 가능성이 높습니다.
- 멀티 커서 인지: VS Code가 `editor.multiCursorPaste: "spread"`이고, 클립보드의 줄바꿈 개수가 선택 개수와 일치하면 기대 동작을 위해 VS Code 기본 붙여넣기에 위임합니다.
- EOL 유지: 붙여넣기 텍스트의 개행(LF/CRLF)을 대상 문서와 일치시켜 의미 없는 diff를 줄입니다.
- format on paste 친화: `editor.formatOnPaste`가 켜져 있으면, 붙여넣은 구간만 범위 포맷팅을 요청하고 겹치는 영역은 병합해 변경을 최소화합니다.
- 클립보드 안전: 에디터 API로만 텍스트를 삽입하므로 시스템 클립보드는 변경하지 않습니다.

## 동작 원리

1. 클립보드 전처리

   - 각 줄의 선행 공백을 스캔해 `(소비 문자 수, 시각적 컬럼 수)`를 기록합니다.
   - 첫 줄을 제외한 내용 줄의 최소 들여쓰기를 바탕으로 기준선 `B`를 구합니다.
   - 둘째 줄부터 `C = max(0, indent − B)`로 줄별 델타를 계산합니다.

2. 대상 위치 판별

   - 커서 왼쪽이 순수 들여쓰기가 아니면 해당 커서에서는 그대로 붙여넣습니다.

3. 조립

   - 현재 커서 왼쪽 컬럼을 `A`라 할 때 결과는 다음과 같습니다.
   - 첫 줄: 원본 텍스트 그대로
   - 나머지 줄: `makeIndent(A + C, preferTabs)` + 원본 텍스트
   - `preferTabs`는 커서 왼쪽에 탭이 있거나 에디터가 탭 사용 설정일 때 `true`가 됩니다.

4. 사후 처리
   - 삽입된 블록 끝으로 커서를 옮기고 마지막 커서를 보이도록 스크롤한 뒤, 필요 시 해당 범위만 포맷팅을 적용합니다.

> 이 확장은 문법 분석을 하지 않습니다. 오직 컬럼 계산과 에디터 설정만 사용합니다.

## 예시

클립보드

```
class qwe:
class asd:
class zxc:
```

4‑스페이스 들여쓰기 위치에 붙여넣은 결과

```
class qwe:
    class asd:
        class zxc:
```

탭/스페이스 혼용 → 시각적 컬럼 보존

```
\tfoo
bar
```

- 탭으로 들여쓴 줄 아래에 붙여넣으면 계속 탭을, 스페이스면 스페이스를 사용합니다.

들여쓰기 위치가 아닐 때 → 그대로 붙여넣기

```
const x = 1;▮ // 코드 뒤 커서 → 재정렬 없이 그대로 붙여넣음
```

## 설치

이 확장은 마켓플레이스/VSIX로 배포하지 않습니다.

- 소스에서 빌드하여 Extension Development Host로 실행하세요.

```bash
npm install
npm run build
```

- VS Code에서 `F5`로 Extension Development Host를 실행합니다.

## 사용법

- 일반 붙여넣기와 동일하게 `Ctrl+V` / `Cmd+V`를 사용합니다.
- 설정이 활성화되어 있으면 기본 붙여넣기를 본 확장이 대체합니다.
- 커서 중 하나라도 순수 들여쓰기 위치가 아니면 해당 커서에서는 있는 그대로 붙여넣습니다.

## 설정

패키지에서 제공하는 설정 (package.json `contributes`)

```jsonc
"AutoIndentPaste.enableIndentPasteBinding": {
  "type": "boolean",
  "default": true,
  "description": "Enable AutoIndentPaste Paste to replace the default Ctrl/Cmd+V keybinding."
}
```

기본값이 `true`이므로, 커맨드는 `Ctrl+V` / `Cmd+V`에 바인딩됩니다:

```jsonc
{
  "command": "AutoIndentPaste.IndentPaste",
  "key": "ctrl+v",
  "mac": "cmd+v",
  "when": "(editorTextFocus || notebookCellEditorFocused) && !editorReadonly && config.AutoIndentPaste.enableIndentPasteBinding"
}
```

존중하는 에디터 설정:

- `editor.insertSpaces` / `editor.tabSize`
- `editor.multiCursorPaste`
- `editor.formatOnPaste` (format on paste)

## 알려진 동작과 trade-off

- 멀티 커서 “spread”: 줄바꿈 개수가 선택 개수와 일치하는 상황에서 `spread` 모드면, 예상 동작을 위해 VS Code 기본 붙여넣기를 사용합니다.
- 비 들여쓰기 위치: 커서 왼쪽에 공백 이외 문자가 있다면 그 위치에서는 재정렬 없이 그대로 붙여넣습니다.
- formatting: 붙여넣기 후 범위 포맷팅을 수행할 수 있습니다. 포매터가 느리면 약간의 지연이 생길 수 있으니, 원치 않으면 `editor.formatOnPaste`를 비활성화하세요.

## 문제 해결

format on paste가 동작하지 않아요

- 사용자/워크스페이스 설정에 `"editor.formatOnPaste": true`인지 확인하세요.
- 사용하는 언어에 범위 포매터(DocumentRangeFormatting)가 있는지 확인하세요. 일부 포매터는 문서 전체 포맷만 지원합니다.
- 다른 붙여넣기/포맷 관련 확장을 잠시 비활성화하거나 작은 파일에서 재현해 충돌 여부를 확인하세요.

멀티 커서에서 예상과 달라요

- `editor.multiCursorPaste: "spread"`이고, 클립보드의 줄바꿈 수가 선택 개수(또는 마지막 줄바꿈이 없으면 `N-1`)와 같으면 VS Code의 기본 spread 붙여넣기가 의도적으로 작동합니다.

탭과 스페이스가 이상해 보여요

- `editor.tabSize`, `editor.insertSpaces` 값을 확인하세요. 이 확장은 “문자”가 아니라 “시각적 컬럼”을 기준으로 맞춥니다.

## 개발

필수: VS Code 1.97.2+ (엔진: `^1.97.2`)

```bash
npm install
npm run build
npm run dev
```

- VS Code에서 `F5`로 Extension Development Host 실행
- 메인 엔트리: `./out/extension.js`

## 설계 의도

- 결정적: 순수 컬럼 계산만 사용합니다. 문법 분석이나 LSP 연동이 없습니다.
- 안전: 클립보드를 건드리지 않고 `TextEditorEdit`/`WorkspaceEdit`로만 편집합니다.
- 통합: VS Code의 spread 붙여넣기 및 format on paste와 잘 연동합니다.

## 라이선스

MIT — `LICENSE` 파일을 참고하세요.
