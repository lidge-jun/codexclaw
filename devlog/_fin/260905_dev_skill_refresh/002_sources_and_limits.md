# 원문 확인과 한계

2026-09-05에 추가 확인했다. 이전 감사의 S01–S10은 배경 근거로 유지하되, 공식 ASVS baseline은 움직이는 master가 아니라 실제 release tag에서 다시 읽었다.

| 대상 | 확인한 원문 | 결과 |
|---|---|---|
| ASVS release | https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release | 실제 tag는 v5.0.0_release이며 초기 5.x release 설명 확인 |
| Authentication | https://github.com/OWASP/ASVS/blob/v5.0.0_release/5.0/en/0x15-V6-Authentication.md | V6.3.3의 MFA/복합 인증 요구와 Level 2 확인 |
| Session Management | https://github.com/OWASP/ASVS/blob/v5.0.0_release/5.0/en/0x16-V7-Session-Management.md | V7.2.1 신뢰 backend 검증, V7.4.1 종료 세션 재사용 방지, 둘 다 Level 1 확인 |

도구: `agbrowse fetch <url> --json --browser never --no-public-endpoints`. 세 원문 모두 `ok=true`, `source=fetch`였고 해당 requirement와 바로 뒤 level 값을 읽었다. 처음 default public endpoint 응답은 release가 아니라 repository metadata라 증거로 기각했다.

이 패치는 전체 ASVS requirement를 구현하거나 인증하지 않는다. 자체 checklist와 formal assessment를 분리하고 실제 version/requirement/applicability/evidence를 요구하도록 고친다.

## 비교 기준

- 저장소 dev family는 조사 baseline 그대로였다. 설치된 diagram cache는 저장소와 다르므로 복사하지 않고 현재 host 계약 위임으로 설계했다.
- visualize 1.0.29의 실제 설치된 source를 이전 감사에서 확인했다. 고정 1 MB/response syntax를 새 보편 규칙으로 복제하지 않는다.
- Windows 실제 실행은 이번 macOS 작업의 증거가 아니다. 배포 안내가 선택 도구를 필수로 강제하지 않는 것과 Windows runtime을 시험한 것은 구분한다.
- 초기 Python frontmatter validator는 PyYAML 미설치로 실패. 새 dependency 설치 없이 Ruby YAML parser와 repo manifest 검사를 사용한다.
- 전체 제품 suite를 실행했다는 주장을 하지 않는다. 직접 영향을 받는 helper fixture와 metadata/계획 정합성, 독립 의미 검토가 이 작업의 gate다.
