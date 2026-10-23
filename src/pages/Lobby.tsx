import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { games } from '../games/registry';
import { sfx } from '../engine/audio';
import { isMobileDevice } from '../lib/device';

export default function Lobby() {
  const navigate = useNavigate();
  const ready = games.filter((g) => g.status === 'ready');
  const soon = games.filter((g) => g.status === 'soon');
  const uniform = ready.length >= 4;
  const wideLast = uniform && ready.length % 2 === 1;
  const touch = isMobileDevice();

  const open = (id: string) => {
    sfx.unlock();
    sfx.click();
    navigate(`/play/${id}`);
  };

  return (
    <div className="page lobby-page">
      <section className="lobby-hero">
        <p className="eyebrow">SINGLE PLAYER · WEB ARCADE</p>
        <h1>
          选一个战场，
          <br />
          随时开打。
        </h1>
        <p className="hero-sub">轻量网页小游戏集合，打开即玩。更多游戏会陆续上线。</p>
      </section>

      <section className="lobby-grid">
        {ready.map((g, i) => (
          <Card
            key={g.id}
            hoverable
            className={`game-card ${
              (!uniform && i === 0) || (wideLast && i === ready.length - 1)
                ? 'game-card-featured'
                : 'game-card-compact'
            }`}
            styles={{ body: { padding: 0 } }}
            onClick={() => open(g.id)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(g.id);
              }
            }}
          >
            <div className="game-art" dangerouslySetInnerHTML={{ __html: g.art ?? '' }} />
            <div className="game-body">
              <div className="game-top">
                <Tag color="gold">已上线</Tag>
                <span className="game-index">{g.index}</span>
              </div>
              <h2>{g.title}</h2>
              <p>{g.description}</p>
              <div className="game-tags">
                {g.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <div className="game-cta">
                <Button type="primary" size="large" icon={<PlayCircleOutlined />}>
                  开始游戏
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {soon.map((g) => (
          <Card key={g.id} className="game-card game-card-soon">
            <div className="game-top">
              <Tag>即将上线</Tag>
              <span className="game-index">{g.index}</span>
            </div>
            <h3>{g.title}</h3>
            <p>{g.description}</p>
            <div className="soon-foot">IN DEVELOPMENT</div>
          </Card>
        ))}
      </section>

      <div className="page-foot">
        <span>
          共 {ready.length} 款可用
          {soon.length > 0 ? ` · ${soon.length} 款筹备中` : ''}
        </span>
        <span>单人模式 · {touch ? '支持触屏与键盘鼠标' : '建议使用键盘与鼠标'}</span>
      </div>
    </div>
  );
}
