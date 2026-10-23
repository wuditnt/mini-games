import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Empty, Grid, Popconfirm, Row, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  clearRuns,
  formatDuration,
  loadRuns,
  RUNS_EVENT,
  summarize,
  type GameRun,
} from '../data/runs';

function TrendChart({ runs }: { runs: GameRun[] }) {
  const W = 760;
  const H = 200;
  const pad = 26;
  const series = runs.slice().reverse();
  const max = Math.max(...series.map((r) => r.score), 1);
  const step = series.length > 1 ? (W - pad * 2) / (series.length - 1) : 0;
  const points = series.map((r, i) => ({
    x: pad + step * i,
    y: H - pad - (r.score / max) * (H - pad * 2),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = points.length > 1 ? `${pad},${H - pad} ${line} ${points[points.length - 1].x},${H - pad}` : '';

  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="得分趋势">
      {[0, 1, 2, 3, 4].map((i) => {
        const y = pad + ((H - pad * 2) * i) / 4;
        return (
          <line key={i} x1={pad} x2={W - pad} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
        );
      })}
      {area && <polygon points={area} fill="rgba(242,166,59,0.12)" />}
      <polyline
        points={line}
        fill="none"
        stroke="#f2a63b"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0b0e13" stroke="#f2a63b" strokeWidth="2" />
      ))}
      <text x={pad} y={pad - 9} fill="#8b94a3" fontSize="11">
        {max}
      </text>
      <text x={pad} y={H - 6} fill="#5d6674" fontSize="11">
        最早
      </text>
      <text x={W - pad} y={H - 6} fill="#5d6674" fontSize="11" textAnchor="end">
        最近
      </text>
    </svg>
  );
}

export default function Stats() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [runs, setRuns] = useState<GameRun[]>(() => loadRuns());

  const refresh = useCallback(() => setRuns(loadRuns()), []);

  useEffect(() => {
    window.addEventListener(RUNS_EVENT, refresh);
    return () => window.removeEventListener(RUNS_EVENT, refresh);
  }, [refresh]);

  const stats = useMemo(() => summarize(runs), [runs]);

  const columns: ColumnsType<GameRun> = [
    {
      title: '时间',
      dataIndex: 'at',
      width: 178,
      render: (v: number) =>
        new Date(v).toLocaleString('zh-CN', { hour12: false }),
    },
    { title: '游戏', dataIndex: 'gameTitle', width: 120 },
    {
      title: '得分',
      dataIndex: 'score',
      align: 'right',
      width: 110,
      sorter: (a, b) => a.score - b.score,
      render: (v: number) => <strong className="score-cell">{v}</strong>,
    },
    { title: '波次', dataIndex: 'wave', align: 'right', width: 90 },
    {
      title: '时长',
      dataIndex: 'duration',
      align: 'right',
      width: 100,
      render: (v: number) => formatDuration(v),
    },
    {
      title: '结果',
      dataIndex: 'result',
      width: 150,
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ];

  return (
    <div className="page stats-page">
      <div className="page-head">
        <div>
          <h2>数据统计</h2>
          <p>记录每一局的结果与走势，数据保存在当前浏览器。</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => navigate('/lobby')}>去玩一局</Button>
          {runs.length > 0 && (
            <Popconfirm
              title="清空所有对局记录？"
              okText="清空"
              cancelText="取消"
              onConfirm={clearRuns}
            >
              <Button danger>清空记录</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="总对局" value={stats.total} suffix="局" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="最高分" value={stats.best} styles={{ content: { color: '#f2a63b' } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="平均分" value={stats.avgScore} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="最长生存" value={formatDuration(stats.longest)} />
          </Card>
        </Col>
      </Row>

      <Card
        title="得分趋势"
        extra={<span className="card-extra">最近 {Math.min(runs.length, 20)} 局</span>}
      >
        {runs.length ? (
          <TrendChart runs={runs.slice(0, 20)} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有对局记录" />
        )}
      </Card>

      <Card title="对局记录" extra={<span className="card-extra">共 {runs.length} 条</span>}>
        <Table
          rowKey="id"
          size="small"
          dataSource={runs}
          columns={columns}
          scroll={screens.md ? undefined : { x: 680 }}
          pagination={runs.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
          locale={{ emptyText: '完成一局坦克大战后，这里会出现记录' }}
        />
      </Card>
    </div>
  );
}
