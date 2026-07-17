export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const ISLAND_WIDTH = 420;
export const ISLAND_HEIGHT = 300;

export type IslandPosition = {
  id: number;
  x: number;
  y: number;
  depth: number;
};

// Hand-authored world coordinates. The stagger is intentional and must not be
// replaced with Grid/Flex layout.
export const ISLAND_POSITIONS: IslandPosition[] = [
  { id: 1, x: 38, y: 148, depth: 10 },
  { id: 2, x: 400, y: 166, depth: 11 },
  { id: 3, x: 762, y: 142, depth: 10 },
  { id: 4, x: 1124, y: 172, depth: 11 },
  { id: 5, x: 84, y: 390, depth: 20 },
  { id: 6, x: 446, y: 410, depth: 21 },
  { id: 7, x: 808, y: 382, depth: 20 },
  { id: 8, x: 1170, y: 406, depth: 21 },
  { id: 9, x: 34, y: 630, depth: 30 },
  { id: 10, x: 396, y: 650, depth: 31 },
  { id: 11, x: 758, y: 624, depth: 30 },
  { id: 12, x: 1120, y: 646, depth: 31 },
];

export function islandCenter(index: number) {
  const island = ISLAND_POSITIONS[Math.max(0, Math.min(11, index))];
  return {
    x: island.x + ISLAND_WIDTH / 2,
    y: island.y + ISLAND_HEIGHT * 0.56,
  };
}
