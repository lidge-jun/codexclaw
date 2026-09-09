# 030 — Windows 실측 (wp1)

이전 D의 결론을 인용한다. "Windows 실행 경로는 이 머신에서 검증하지 못했다. 사용자 명령에 bare exit가 있으면 배치가 조기 종료되어 종료 코드가 기록되지 않고, 프로세스 그룹이 없어 cancel이 손자 프로세스를 남긴다." 이 추정을 측정으로 대체한다.

호스트: `ssh desktop-c795oh4` — Microsoft Windows 10.0.26200.9445, MINGW64 기본 셸, node v24.19.0.
전송: `src/`, `test/`, `package.json`을 `~/bgwake-verify`로 tar 파이프. 임시 디렉터리 밖은 건드리지 않았다.

## 1. 기존 테스트는 Windows 경로를 한 번도 돌리지 않는다

```
ℹ tests 37 / pass 29 / fail 0 / skipped 8
﹣ a real command runs detached and records its own exit code  # posix shell path
﹣ an argument with spaces and quotes survives the shell        # posix shell path
﹣ cancel does not overwrite an already finished job            # posix shell path
﹣ on is idempotent and does not move the gate forward          # posix shell path
﹣ off then on gates only what finished while off               # posix shell path
﹣ drain works even while the wake is switched off              # posix shell path
﹣ a half-written exit file keeps the job running               # posix shell path
﹣ run -- exit N still records the code                         # posix shell path
```

실행을 건드리는 테스트가 전부 `t.skip("posix shell path")`였다. 순수 로직 29개는 Windows에서도 통과하지만, **배치 경로는 검증된 적이 없었다.** 그래서 별도 프로브를 썼다.

## 2. 네 항목 실측

### 종료 코드 기록 — 통과

```
[A1 zero]    {"status":"complete","exitCode":0,"want":0}
[A2 nonzero] {"status":"failed","exitCode":3,"want":3}
```

`(call echo %%ERRORLEVEL%%) > tmp` + `move /y`가 실제로 동작한다. 감사에서 "한 줄 파싱 시점에 펼쳐져 이전 값을 쓴다"고 지적받아 `call`로 고쳤던 부분이 맞았다.

### bare exit — 한계 확정

```
[C bare exit] {"status":"failed","exitCode":null}
```

예상대로다. 배치 안의 `exit`는 배치를 끝내므로 ERRORLEVEL 줄에 도달하지 못한다. 코드 미상의 `failed`로 조정된다. POSIX는 서브셸로 막았지만 cmd에는 같은 수단이 없다.

### cancel — 이 회차 기록 (이 경로의 손자 생존은 끝내 미측정)

```
[D cancel] {"pid":9872,"aliveBefore":true,"statusAfter":"cancelled","shellAliveAfter":false}
```

셸 프로세스는 확실히 죽는다. 손자(실제 명령) 생존은 이 회차에서 `tasklist` 필터가 한국어 로케일에서 깨져 못 쟀고, 3절에서 마커 파일로 다시 쟀다. 단 3절 측정은 **헬퍼 경로**의 것이라 이 배치 경로의 손자 생존은 여전히 미측정이다.

### 인자 인용과 출력 캡처 — 이 회차 기록 (3절이 대체)

```
[B quoting] {"sent":["a b","x&y","50%","q\"uote","excl!am"],"got":"","exitCode":0}
```

출력이 비었다. 인용 문제인 줄 알았는데 아니었다. 가장 단순한 `node -e "console.log('hello')"`도 `out: ""`였다.

## 3. 원인 좁히기 (감사 1회차 fail 반영)

1회차 초안은 "detached가 아니라 cmd.exe가 문제"라고 단정했다. 감사가 정확히 반박했다. 같은 회차의 d2(detached + 중첩 `cmd /c`가 리다이렉트 소유)가 **캡처에 성공**했으므로 그 기제와 모순된다. 변수가 분리되지 않은 채였다.

그래서 **부모가 즉시 종료하는 조건으로 통일**해 다섯 변형을 다시 쟀다. 이전 회차의 d1은 부모가 살아 있어 제품 조건이 아니었다.

```
v1  detached + fd,     대상을 직접 spawn             rc=0  out=[immediate/late/]
v2  detached + ignore, 대상을 직접 spawn             rc=0  out=[]
v3  detached + ignore, 1-hop cmd 배치의 리다이렉트     rc=0  out=[]        <- 현재 제품 경로
v4  detached + ignore, 2-hop 중첩 cmd /c 가 리다이렉트  rc=1  out=[캡처됨]
v5  detached + ignore, 2-hop Node 헬퍼 + fd           rc=0  out=[immediate/late/]
```

이제 말할 수 있는 것만 말한다.

두 개의 **별개** 사실이다. 하나로 합치지 않는다.

- **v1 vs v2 (cmd 없는 직접 spawn):** fd를 주면 남고 `ignore`면 사라진다. 자식이 파일을 직접 열지 않는 한 당연한 결과이고, POSIX에서도 같다. 이 비교가 말하는 것은 "직접 spawn 경로에서 캡처하려면 핸들을 줘야 한다"뿐이다. 3b의 `nodetach+ignore → captured`와 모순되지 않는다. 그쪽은 **cmd 배치의 리다이렉트가 캡처를 담당**하는 다른 경로다.
- **v3 vs v4 (둘 다 ignore, cmd 경유):** 1-hop 배치의 리다이렉트만 비고, 2-hop 중첩 `cmd /c`는 캡처된다. 여기서 갈린 축은 핸들 유무가 아니라 **홉 수**다.

그래서 제품 실패(v3)의 필요조건이 "1-hop 배치 리다이렉트"인지 "Node가 첫 홉에 핸들을 안 줌"인지는 **아직 갈리지 않았다.** 그걸 가르려면 1-hop cmd × fd를 부모 즉시 종료 조건에서 재현해야 하는데, 이번 회차에 하지 않았다. 강등된 d3가 부모 생존 조건에서 `detached+fd, cmd 경유 → out=[]`였을 뿐이다.

수정 방향 자체는 이 미해결에 걸리지 않는다. v5가 제품 조건에서 동작을 보였기 때문이다. 다만 정직하게 적자면, 이 칸이 비어 있어서 **cmd 래퍼를 유지하는 대안이 가능한지 아닌지를 모른다.** 헬퍼로 가는 것은 측정에 의해 강제된 결론이 아니라, 동작이 확인된 경로를 고르는 선택이다.

v4의 `rc=1`은 프로브 자신의 결함이다. 중첩 `cmd /c` 안에서 인용이 겹쳐 안쪽 `node -e` 스크립트가 깨졌고, node가 SyntaxError로 1을 반환했다. 그 에러 텍스트가 `.out`에 남았다는 사실이 곧 캡처 성공의 증거다.

v1과 v5의 `out`은 부모가 죽은 뒤 **별도 ssh 호출**이 10초 뒤에 읽은 값이다. 부모 프로브가 읽은 것이 아니다.

### 인용은 아직 측정되지 않았다

1회차 표는 "인자 인용 / 출력 캡처 실패"를 한 칸에 묶었다. 틀렸다. 관측된 것은 **stdout 파일 유실뿐**이고, 출력이 애초에 비어 있었으므로 인용이 옳았는지는 알 수 없다. 인용 판정은 캡처가 고쳐진 뒤로 미룬다.

### cancel 손자 생존 — 측정함

1회차에서 `tasklist` 필터가 한국어 로케일에서 깨져 못 쟀다. 손자가 1초마다 마커 파일을 쓰게 하고 다시 쟀다.

```
{"helperPid":14996,"markerAtKill":"3","markerAfter1s":"3","markerAfter4s":"3","verdict":"grandchild stopped"}
{"afterTaskkillT":"3","then3s":"3","verdict2":"stopped"}
```

헬퍼를 죽이자 손자도 멈췄다. 다만 이 호스트는 OpenSSH 세션이라 잡 오브젝트가 개입했을 수 있고, 같은 회차에서 비-detached 자식이 부모 종료와 함께 죽은 것도 같은 설명에 들어맞는다. **대화형 로컬 세션에서도 같은지는 측정하지 않았다.** 프로세스 그룹이 없다는 것은 이번 실측이 아니라 플랫폼 사실이다.

## 3b. 1회차 원시 기록 (참고)


배치 자체는 멀쩡하다. 같은 배치를 `spawnSync`(비-detached)로 돌리면 전부 잡힌다.

```
t1_paren_parens | spawnStatus=0 | rcFile=0 | out="hello1\n"
t4_paren_version | spawnStatus=0 | rcFile=0 | out="v24.19.0\r\n"
t7_echo_paren   | spawnStatus=0 | rcFile=0 | out="hi7\r\n"
```

조합을 갈랐다.

```
detached+ignore      | rc=0 | out=""
detached+ignore+hide | rc=0 | out=""
nodetach+ignore      | rc=0 | out="captured\n"
detached+pipe        | rc=0 | out=""
```

그런데 `detached`를 빼면 이번엔 **부모가 죽을 때 자식도 죽는다.**

```
A (detached:false) → run.cmd 만 남음. rc 없음, out 없음
B (detached:true)  → rc=0, out 없음
```

여기까지가 막다른 길처럼 보였다. 마지막으로 cmd를 빼고 대상을 직접 띄웠다.

```
d1 (detached + fd, node를 직접 spawn)        rc=[0] out=[immediate/late/]
d2 (detached + 중첩 cmd /c 가 리다이렉트 소유)  출력 캡처됨
d3 (detached + fd, cmd 경유)                 rc=[0] out=[]
```

(이 회차의 d1은 부모가 살아 있어 제품 조건이 아니었다. d2는 3절 v4와 같은 방향의 결과이고, 당시 초안의 인과 서술과 어긋났던 것이다. 부모 즉시 종료로 통일한 3절 v 시리즈가 이 기록을 대체한다.)

## 4. 판정

| 항목 | 판정 |
|---|---|
| 종료 코드 기록 | **현재 cmd 배치 경로 기준** 통과. wp2가 그 경로를 폐기하므로 헬퍼 경로에서 다시 확인해야 한다 |
| bare exit | **현재 cmd 배치 경로의** 확정 한계. cmd에는 POSIX 서브셸 대응물이 없다. 헬퍼 경로에서는 이 한계가 사라지고 대신 cmd 내장 명령 미실행이라는 다른 한계가 들어선다 |
| cancel (현재 배치 경로) | 셸 사망 확인. 이 경로의 손자 생존은 미측정 |
| cancel (헬퍼 경로) | 헬퍼를 죽이면 손자도 멈춤을 3절에서 마커 파일로 측정. 단 SSH 잡 오브젝트 개입 가능성이 있어 대화형 세션은 미확인 |
| 출력 캡처 | **실패. 수정 필요** (v3) |
| 인자 인용 | 미측정. 캡처가 비어 있어 판정 불가 |
| 1-hop cmd × fd | 미측정 (부모 즉시 종료 조건). 원인 축을 완전히 가르지 못한 지점 |

## 5. wp2가 할 일

Windows에서 첫 홉을 Node 헬퍼로 바꾼다. 헬퍼는 `stdio:"ignore"`로 detached 실행되고, **헬퍼 자신이** 출력 파일을 열어 그 핸들로 사용자 명령을 argv 직접 spawn한 뒤, 종료 코드를 원자적으로 쓴다. CLI 부모는 핸들을 열지 않는다. **v5가 부모 종료 후 조건에서 이 방식의 동작을 보였다.**

헬퍼가 필요한 이유를 적는다. 캡처만이라면 v1처럼 1-hop + fd로도 된다. 그런데 v1에는 **종료 코드를 파일에 쓰는 주체가 없다.** v1의 `rc=0`은 프로브가 손으로 써 넣은 값이지 제품형 exit 파일이 아니다. 그러니 v1은 "캡처는 1-hop으로도 된다"만 말하고, 종료 코드 기록에 대해서는 아무 말도 하지 않는다.

따라서 헬퍼는 **종료 코드를 대신 기록할 누군가**로서 필요하다. POSIX에서는 셸이 그 일을 했고, Windows에서는 cmd가 그 일을 하려다 출력을 잃었다. 2-hop cmd(v4)가 종료 코드까지 제대로 쓰는지는 이번 표에 없다. 이것도 측정이 아니라 선택임을 명시해 둔다.

새로 생기는 위험을 미리 적는다. 확정된 설계가 아니라 wp2에서 검증할 대상이다.

- 헬퍼가 종료 코드를 쓰기 전에 죽으면 exit 파일이 없다. 현재의 `failed` + `exitCode: null` 경로로 접히는데, 그건 한계가 아니라 헬퍼 수명 버그다.
- 기록되는 pid가 헬퍼 pid가 된다. `cancel`과 `startToken`의 의미가 셸 pid에서 헬퍼 pid로 바뀐다.
- POSIX는 `/bin/sh -c` + 프로세스 그룹, Windows는 헬퍼로 **이원화**된다. 계약 문서의 "셸이 스스로 쓴다"와 `<id>.out.cmd` 레이아웃을 함께 개정해야 한다.
- argv 직접 spawn이므로 **cmd 내장 명령이 실행되지 않는다.** `echo`, `dir`, `exit` 같은 것은 사용자가 `cmd /c ...`로 감싸야 한다. bare `exit` 한계는 사라지지만 그 자리에 다른 한계가 들어선다.

POSIX 경로는 측정으로 동작이 확인되어 있으므로 건드리지 않는다.


## 6. 수정 후 재측정 (wp2)

Windows 첫 홉을 cmd 배치에서 Node 헬퍼로 바꾼 뒤, 같은 호스트에서 다시 쟀다. 전부 제품 코드 경로(`runBackground` / `cancel`)를 그대로 호출한다.

```
platform=win32
[exit0]                          {"status":"complete","exitCode":0,"want":0}
[exit3]                          {"status":"failed","exitCode":3,"want":3}
[capture]                        {"out":["captured stdout","captured stderr"]}
[quoting]                        {"sent":["a b","x&y","50%","q\"uote","excl!am","semi;colon"],
                                  "got": ["a b","x&y","50%","q\"uote","excl!am","semi;colon"],"match":true}
[missing binary]                 {"status":"failed","exitCode":127}
[cmd builtin (known limitation)] {"status":"failed","exitCode":1}
[cmd /c wrapper]                 {"exitCode":0,"out":"wrapped builtin"}
[cancel]                         {"aliveBefore":true,"status":"cancelled","helperAliveAfter":false}
```

### 판정 갱신

| 항목 | wp1 판정 | wp2 판정 |
|---|---|---|
| 출력 캡처 | 실패 | **통과.** stdout과 stderr 모두 파일에 남는다 |
| 인자 인용 | 미측정 | **통과.** 공백, `&`, `%`, 큰따옴표, `!`, `;` 가 전부 바이트 그대로 도착한다 |
| 종료 코드 기록 | 현재 cmd 경로 기준 통과 | **헬퍼 경로에서 다시 통과.** 0과 3을 정확히 기록 |
| bare exit | cmd 배치의 확정 한계 | **사라졌다.** cmd가 없으므로 배치 조기 종료라는 개념이 없다 |
| cmd 내장 명령 | (해당 없음) | **새 한계.** `echo`를 직접 넘기면 `failed`로 끝난다(측정값 exit 1). `cmd /c echo ...`로 감싸면 정상 동작하고 출력도 잡힌다 |
| 없는 실행 파일 | (미측정) | `failed` + `exitCode 127`. POSIX의 not-found 관례와 같다 |
| cancel | 배치 경로 손자 미측정 | 헬퍼가 죽고 작업이 `cancelled`로 남는다. SSH 잡 오브젝트 caveat는 그대로 |

### 남은 미측정

- 대화형 로컬 Windows 세션(SSH 아님)에서의 생존과 cancel. 이 회차도 OpenSSH를 통했다.
- 1-hop cmd × fd (부모 즉시 종료 조건). cmd 래퍼 유지 대안이 가능했는지는 끝내 모른다. 헬퍼 경로가 동작하므로 더 파지 않았다.

