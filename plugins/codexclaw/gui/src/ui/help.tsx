/**
 * help.tsx — per-page help drawer + topic button (B-2).
 *
 * Mirrors the cli-jaw HelpDrawer interaction pattern: right-side drawer with
 * overlay, ESC/overlay-click/X close, focus management. Visual style matches
 * the existing codexclaw GUI kit (tokens from styles.css).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons.tsx";

/* ── topic content ──────────────────────────────────────────────────────── */

export type HelpTopicId = "channels" | "agents" | "subagents" | "dashboard" | "sessions";

export interface HelpEntry {
  title: string;
  subtitle: string;
  body: ReactNode;
}

export const HELP_CONTENT: Record<HelpTopicId, HelpEntry> = {
  channels: {
    title: "Channels",
    subtitle: "메신저 연결 관리",
    body: (
      <>
        <p className="help-lead">
          Telegram 또는 Discord 봇 토큰을 등록하고 채팅을 페어링하는 곳입니다.
        </p>
        <ul className="help-bullets">
          <li>한 번에 하나의 채널만 활성화할 수 있습니다. 다른 채널을 쓰려면 먼저 활성 채널을 해제하세요.</li>
          <li>Connect를 눌러 봇 토큰을 입력하고, 핸드셰이크 링크를 통해 대상 채팅을 페어링합니다.</li>
          <li>페어링이 완료되면 해당 채팅의 메시지가 Codex로 라우팅됩니다.</li>
        </ul>
        <div className="help-section">
          <h4>관련 메신저 명령</h4>
          <ul className="help-bullets">
            <li><code>/help</code> — 사용 가능한 명령 목록</li>
            <li><code>/stop</code> — 진행 중인 작업 중단</li>
            <li><code>/approve</code> — 대기 중인 작업 승인</li>
          </ul>
        </div>
      </>
    ),
  },
  agents: {
    title: "Agents",
    subtitle: "에이전트별 봇 관리",
    body: (
      <>
        <p className="help-lead">
          이름 있는 에이전트를 만들고, 각각에 봇 토큰을 부여해 동시에 운영하는 곳입니다.
        </p>
        <ul className="help-bullets">
          <li>에이전트마다 독립 봇 토큰, 모델, 추론 강도(effort), 하트비트를 설정할 수 있습니다.</li>
          <li>Settings 버튼으로 모델, 추론 강도, 자동 전송, mention-only 등 세부 설정을 변경합니다.</li>
          <li>모드 버튼으로 thread/plain 모드를 전환합니다. thread 모드는 토픽/스레드별 독립 세션, plain 모드는 채팅당 하나의 세션입니다.</li>
          <li>활성화된 에이전트는 모두 동시에 메시지를 수신합니다.</li>
        </ul>
        <div className="help-section">
          <h4>관련 메신저 명령</h4>
          <ul className="help-bullets">
            <li><code>/help</code> — 사용 가능한 명령 목록</li>
            <li><code>/mode</code> — 현재 모드 확인 또는 변경</li>
            <li><code>/model</code> — 모델 확인 또는 변경</li>
            <li><code>/effort</code> — 추론 강도 확인 또는 변경</li>
            <li><code>/stop</code> — 진행 중인 작업 중단</li>
            <li><code>/approve</code> — 대기 중인 작업 승인</li>
          </ul>
        </div>
      </>
    ),
  },
  subagents: {
    title: "Subagents",
    subtitle: "역할별 모델 오버라이드",
    body: (
      <>
        <p className="help-lead">
          Explorer, Reviewer, Executor 세 역할에 대해 모델과 프롬프트를 개별 설정하는 곳입니다.
        </p>
        <ul className="help-bullets">
          <li>기본값은 메인 모델을 그대로 사용합니다. 드롭다운에서 다른 모델을 선택하면 해당 역할만 오버라이드됩니다.</li>
          <li>추론 강도(effort)도 역할별로 다르게 설정할 수 있습니다.</li>
          <li>프롬프트 오버라이드를 입력하면 해당 역할의 시스템 프롬프트가 교체됩니다.</li>
          <li>설정은 <code>.codexclaw/subagents.json</code>에 저장됩니다.</li>
        </ul>
      </>
    ),
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "브릿지 트래픽 모니터링",
    body: (
      <>
        <p className="help-lead">
          메시지 수신, 턴 완료, 에러 등 브릿지의 실시간 상태를 확인하는 곳입니다.
        </p>
        <ul className="help-bullets">
          <li>상단 카드에서 전체 메시지, 턴, 에러 수, 평균 응답 시간을 확인합니다.</li>
          <li>Recent events 테이블에서 개별 이벤트 시간, 유형, 에이전트, 상세 내용을 볼 수 있습니다.</li>
          <li>Agent status 패널에서 각 어댑터의 현재 상태(running, idle, error 등)를 확인합니다.</li>
          <li>데이터는 5초마다 자동 갱신됩니다.</li>
        </ul>
      </>
    ),
  },
  sessions: {
    title: "Sessions",
    subtitle: "바인딩 세션 관리",
    body: (
      <>
        <p className="help-lead">
          채팅과 Codex 세션 간의 바인딩을 확인하고 관리하는 곳입니다.
        </p>
        <ul className="help-bullets">
          <li>각 바인딩은 메신저 채팅 ID와 Codex 세션을 연결합니다.</li>
          <li>워크디렉터리(workdir)를 변경해 Codex가 작업하는 경로를 바꿀 수 있습니다.</li>
          <li>세션 리셋으로 기존 Codex 세션을 초기화하고 새로 시작할 수 있습니다.</li>
          <li>Job history에서 해당 바인딩의 과거 작업 이력을 확인합니다.</li>
        </ul>
        <div className="help-section">
          <h4>관련 메신저 명령</h4>
          <ul className="help-bullets">
            <li><code>/help</code> — 사용 가능한 명령 목록</li>
            <li><code>/stop</code> — 진행 중인 작업 중단</li>
          </ul>
        </div>
      </>
    ),
  },
};

/* ── HelpTopicButton ────────────────────────────────────────────────────── */

export function HelpTopicButton({
  topic,
  onOpen,
}: {
  topic: HelpTopicId;
  onOpen: (topic: HelpTopicId) => void;
}) {
  return (
    <button
      type="button"
      className="help-topic-btn"
      aria-label={`${HELP_CONTENT[topic].title} 도움말`}
      title={`${HELP_CONTENT[topic].title} 도움말`}
      onClick={() => onOpen(topic)}
    >
      ?
    </button>
  );
}

/* ── HelpDrawer ─────────────────────────────────────────────────────────── */

export function HelpDrawer({
  open,
  topic,
  onClose,
}: {
  open: boolean;
  topic: HelpTopicId;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const entry = HELP_CONTENT[topic];

  return (
    <>
      <div className="help-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="help-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.title} 도움말`}
      >
        <header className="help-drawer-head">
          <div>
            <span className="help-drawer-eyebrow">{entry.subtitle}</span>
            <h3 className="help-drawer-title">{entry.title}</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="help-drawer-body">{entry.body}</div>
        <footer className="help-drawer-foot">
          <a className="help-drawer-doc-link" href="/readme" target="_blank" rel="noreferrer">
            <Icon name="external" size={14} />
            전체 문서 (README)
          </a>
        </footer>
      </aside>
    </>
  );
}

/* ── useHelp hook — shared by every page ────────────────────────────────── */

export function useHelp(defaultTopic: HelpTopicId) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopicId>(defaultTopic);

  const openHelp = useCallback((topic: HelpTopicId) => {
    setHelpTopic(topic);
    setHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  return { helpOpen, helpTopic, openHelp, closeHelp } as const;
}
