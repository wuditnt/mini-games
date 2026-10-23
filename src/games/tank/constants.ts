export const TILE = 40;
export const COLS = 24;
export const ROWS = 16;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

/* 地块类型 */
export const EMPTY = 0;
export const BRICK = 1;
export const STEEL = 2;
export const WATER = 3;
export const TREE = 4;

/** # 砖墙（可破坏）  S 钢墙  W 水面（挡车不挡弹）  T 树丛（挡视线、可穿行） */
export const MAP: string[] = [
  '........................',
  '..##....##....##....##..',
  '..##....##....##....##..',
  '........................',
  '....WW....TTTT....WW....',
  '....WW....TTTT....WW....',
  '..SS..##........##..SS..',
  '......##....##..##......',
  '......##....##..##......',
  '..##....##..##....##....',
  '..##....##..##....##....',
  '....TT..........TT......',
  '....TT..........TT......',
  '......##..####..##......',
  '..........#..#..........',
  '..........#..#..........',
];

export const PLAYER_START = { x: WIDTH / 2, y: 11 * TILE + TILE / 2 };
export const BASE_CENTER = { x: WIDTH / 2, y: HEIGHT - TILE };
export const BASE_SIZE = 76;

export const SPAWN_POINTS = [
  { x: 60, y: 60 },
  { x: WIDTH / 2, y: 60 },
  { x: WIDTH - 60, y: 60 },
  { x: 60, y: 340 },
  { x: WIDTH - 60, y: 340 },
];

export const PALETTE = {
  bg: '#0c1016',
  grid: 'rgba(148, 174, 200, 0.045)',
  brick: '#7c4032',
  brickDark: '#54291f',
  brickLight: '#96503d',
  steel: '#69758a',
  steelLight: '#94a2b8',
  steelDark: '#454f61',
  water: '#173f5a',
  waterLight: '#2a7095',
  tree: '#235338',
  treeLight: '#3b8257',
  playerHull: '#dfe7f2',
  playerTrim: '#f2a63b',
  base: '#f2a63b',
};
