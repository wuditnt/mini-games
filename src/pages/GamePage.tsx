import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { games } from '../games/registry';
import type { GameHandle } from '../games/types';
import { sfx } from '../engine/audio';
import { SoundButton } from '../components/SoundButton';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meta = games.find((g) => g.id === id && g.status === 'ready');
  const hostRef = useRef<HTMLDivElement>(null);
  const [gateDismissed, setGateDismissed] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!meta?.loader) return;
    let cancelled = false;
    let handle: GameHandle | null = null;

    document.title = `${meta.title} · ARCADE`;
    sfx.unlock();
    sfx.click();

    void meta.loader().then((mod) => {
      if (cancelled || !hostRef.current) return;
      handle = mod.mount(hostRef.current, {
        onExit: () => setLeaveConfirm(true),
      });
    });

    return () => {
      cancelled = true;
      handle?.destroy();
      document.title = 'ARCADE · 游戏大厅';
    };
  }, [meta, navigate]);

  if (!meta) return <Navigate to="/lobby" replace />;

  return (
    <section className={`game-shell${gateDismissed ? ' gate-dismissed' : ''}`}>
      <header className="game-bar">
        <button className="back-btn" type="button" onClick={() => setLeaveConfirm(true)}>
          ← 返回大厅
        </button>
        <div className="game-bar-title">
          {meta.title}
          <span>{meta.mode}</span>
        </div>
        <div className="spacer" />
        <SoundButton variant="ghost" />
      </header>

      <div className="stage" ref={hostRef} />

      {leaveConfirm && (
        <div className="leave-confirm" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="leave-card">
            <p className="ov-kicker">LEAVE GAME</p>
            <h2 id="leave-title">返回大厅？</h2>
            <p className="ov-desc">离开后当前对局将结束，确定要返回大厅吗？</p>
            <div className="btn-row">
              <button
                className="btn-primary"
                type="button"
                autoFocus
                onClick={() => setLeaveConfirm(false)}
              >
                继续游戏
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => navigate('/lobby')}
              >
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rotate-gate">
        <div className="rotate-card">
          <svg className="rotate-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="21" y="10" width="22" height="44" rx="6" stroke="currentColor" strokeWidth="2.5" />
            <path d="M29 47.5h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M50 22a20 20 0 0 1 0 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path
              d="M46.5 21.5 51 22l-.5-4.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2>横屏体验更好</h2>
          <p>旋转手机后可以获得更完整的游戏视野与更大的操作区域。</p>
          <button className="btn-secondary" type="button" onClick={() => setGateDismissed(true)}>
            继续竖屏
          </button>
        </div>
      </div>
    </section>
  );
}
