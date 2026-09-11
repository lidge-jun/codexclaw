# 020 wp3: wsl.yml 게이팅과 분할, 문서

## 트리거

```yaml
on:
  push:
    branches: [main, preview, dev]
  workflow_dispatch:
```

pull_request 트리거를 뺀다. cxc-dev-devops §2.1과 opencodex ci.yml의 원칙: 통합 라인 push는 릴리스 경로를 지키고, PR은 리뷰용 증거만 받는다. WSL이 검증하는 drvfs/ext4 진단은 머지 후 dev에서 확인해도 늦지 않다(문제가 나면 dev가 빨간불이 되고 다음 PR이 그것을 고친다). `preview` 브랜치는 아직 없지만 규칙에 맞춰 미리 넣는다(없는 브랜치는 무해).

## 분할

한 잡(817초)을 두 잡으로: `wsl-drvfs`(/mnt/c에서 npm ci + npm test + doctor grep)와 `wsl-ext4`(~로 복사 후 npm ci + npm test + platform-smoke). "wsl.exe 파싱 금지" grep은 drvfs 잡 끝에 붙인다. 각 잡 `timeout-minutes: 20`. setup-wsl과 Node 설치는 두 잡이 각각 한다(캐시 없음; 병렬이므로 벽시계는 절반 근처).

## 문서

README의 CI/Contributing 절(있으면)과 `docs-site` 기여 안내에 표 하나: PR에서 도는 체크(ci 집계, packed-install artifact/install, enforce-target)와 통합 라인 push에서만 도는 체크(WSL). `inventory.json` hooks 수 등은 변하지 않는다.

## 머지 (wp4)

브랜치 `codex/ci-modernization` → PR → 새 ci.yml이 PR 헤드에서 실행되므로 그 결과가 곧 검증. 머지 후 `gh run list --workflow wsl.yml --branch dev`로 두 잡 SUCCESS를 evidence에 저장.
머지 직후 main 룰셋 20884837의 필수 체크를 `ci`, `artifact (ubuntu-latest|windows-latest|macos-latest)`, `install (ubuntu-latest|macos-latest)`로 갱신한다(010 참조). WSL은 룰셋 필수 체크가 아니다(리뷰어 확인).
