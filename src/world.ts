import type {
  Biome,
  BiomeId,
  Coordinate,
  Discovery,
  ResourceId,
  ResourceNode,
  Traveller,
} from "./types";

export const ONLINE_SPEED = 0.9;
export const OFFLINE_SPEED = 0.35;
export const UPGRADED_OFFLINE_SPEED = 0.55;
export const INVENTORY_CAPACITY = 24;
export const GATHER_RADIUS = 4;
export const ENCOUNTER_RADIUS = 13;
export const CHUNK_SIZE = 18;

export const BIOMES: Record<BiomeId, Biome> = {
  meadow: { id: "meadow", name: "Sunlit Meadow", description: "A little room to wander.", color: "#a9b97a" },
  forest: { id: "forest", name: "Whispering Woods", description: "A world beneath the leaves.", color: "#688459" },
  mountains: { id: "mountains", name: "Highland Ridge", description: "The long way up is worth it.", color: "#a6a18a" },
  desert: { id: "desert", name: "Amber Expanse", description: "Follow the warmth of the sand.", color: "#d0b17a" },
  jungle: { id: "jungle", name: "Emerald Wilds", description: "Something grows around every bend.", color: "#59836b" },
  river: { id: "river", name: "Willow River", description: "Let the water lead the way.", color: "#78a7a0" },
};

export const RESOURCES: Record<ResourceId, { name: string; symbol: string; color: string }> = {
  wood: { name: "Wood", symbol: "⌁", color: "#b88a5d" },
  herbs: { name: "Herbs", symbol: "✿", color: "#a9be81" },
  stone: { name: "Stone", symbol: "◆", color: "#a7a59a" },
  fiber: { name: "Fiber", symbol: "≋", color: "#d5c490" },
  berries: { name: "Berries", symbol: "●", color: "#c7847b" },
  mineral: { name: "Mineral", symbol: "◇", color: "#9cbab3" },
};

export const DISCOVERIES: Discovery[] = [
  { id: "daisy", name: "Meadow daisy", category: "Flora", biome: "meadow", description: "A small sun, growing in the grass.", symbol: "✿" },
  { id: "clover", name: "Wild clover", category: "Flora", biome: "meadow", description: "A little luck for the road.", symbol: "☘" },
  { id: "mushroom", name: "Ambercap mushroom", category: "Flora", biome: "forest", description: "Often found beneath old trees.", symbol: "♟" },
  { id: "berry", name: "Woodland berries", category: "Flora", biome: "forest", description: "A bright spot in the undergrowth.", symbol: "●" },
  { id: "quartz", name: "Cloud quartz", category: "Stones", biome: "mountains", description: "A fragment of the high places.", symbol: "◇" },
  { id: "slate", name: "Mountain slate", category: "Stones", biome: "mountains", description: "Layered by time and weather.", symbol: "◆" },
  { id: "sandrose", name: "Desert rose", category: "Stones", biome: "desert", description: "A flower made of sand and stone.", symbol: "✧" },
  { id: "sungrass", name: "Sungrass", category: "Flora", biome: "desert", description: "Resilient, even in the heat.", symbol: "❋" },
  { id: "fern", name: "Wild fern", category: "Flora", biome: "jungle", description: "A green curl reaching for the light.", symbol: "❧" },
  { id: "orchid", name: "Canopy orchid", category: "Flora", biome: "jungle", description: "A rare flash of color in the wilds.", symbol: "✾" },
  { id: "reed", name: "River reed", category: "Waterside", biome: "river", description: "Swaying along the water's edge.", symbol: "≋" },
  { id: "riverstone", name: "Skipping stone", category: "Waterside", biome: "river", description: "Smoothed by a long journey.", symbol: "◒" },
];

const FINDS: Record<BiomeId, { resource: ResourceId; discovery: string }[]> = {
  meadow: [{ resource: "herbs", discovery: "daisy" }, { resource: "fiber", discovery: "clover" }],
  forest: [{ resource: "wood", discovery: "mushroom" }, { resource: "berries", discovery: "berry" }],
  mountains: [{ resource: "mineral", discovery: "quartz" }, { resource: "stone", discovery: "slate" }],
  desert: [{ resource: "stone", discovery: "sandrose" }, { resource: "fiber", discovery: "sungrass" }],
  jungle: [{ resource: "wood", discovery: "fern" }, { resource: "herbs", discovery: "orchid" }],
  river: [{ resource: "fiber", discovery: "reed" }, { resource: "stone", discovery: "riverstone" }],
};

const REGIONS: { id: Exclude<BiomeId, "river">; x: number; y: number }[] = [
  { id: "meadow", x: 0, y: 0 },
  { id: "forest", x: 35, y: 25 },
  { id: "mountains", x: 42, y: -38 },
  { id: "desert", x: -45, y: -35 },
  { id: "jungle", x: -35, y: 65 },
];

export function randomAt(x: number, y: number, salt = 0): number {
  let value = Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x119de1f3) ^ Math.imul(salt | 0, 0x3449f5);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, scale: number, salt: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = randomAt(ix, iy, salt) * (1 - u) + randomAt(ix + 1, iy, salt) * u;
  const b = randomAt(ix, iy + 1, salt) * (1 - u) + randomAt(ix + 1, iy + 1, salt) * u;
  return a * (1 - v) + b * v;
}

export function riverDistance(x: number, y: number): number {
  return Math.abs(x - (-23 + Math.sin(y / 27) * 7 + Math.sin(y / 11) * 2));
}

export function regionWeights(x: number, y: number): { id: Exclude<BiomeId, "river">; weight: number }[] {
  const warpedX = x + (smoothNoise(x, y, 24, 11) - 0.5) * 12;
  const warpedY = y + (smoothNoise(x, y, 24, 12) - 0.5) * 12;
  const weights = REGIONS.map((region) => ({
    id: region.id,
    weight: 1 / Math.pow(180 + (warpedX - region.x) ** 2 + (warpedY - region.y) ** 2, 1.8),
  }));
  const total = weights.reduce((sum, region) => sum + region.weight, 0);
  return weights.map((region) => ({ ...region, weight: region.weight / total }));
}

export function getBiomeAt(x: number, y: number): Biome {
  if (riverDistance(x, y) < 4.2) return BIOMES.river;
  const region = regionWeights(x, y).reduce((best, current) => current.weight > best.weight ? current : best);
  return BIOMES[region.id];
}

export function terrainHeight(x: number, y: number): number {
  const mountain = regionWeights(x, y).find((region) => region.id === "mountains")?.weight ?? 0;
  const hills = (smoothNoise(x, y, 22, 21) - 0.5) * 2.4 + (smoothNoise(x, y, 8, 22) - 0.5) * 0.7;
  const mountainHeight = mountain * (2 + smoothNoise(x, y, 12, 23) * 4);
  const water = Math.min(1, Math.max(0, (riverDistance(x, y) - 2) / 4));
  return (hills + mountainHeight) * water - (1 - water) * 0.25;
}

export function movePosition(position: Coordinate, heading: number, seconds: number, speed: number): Coordinate {
  const radians = heading * Math.PI / 180;
  return {
    x: position.x + Math.sin(radians) * seconds * speed,
    y: position.y + Math.cos(radians) * seconds * speed,
  };
}

export function distance(a: Coordinate, b: Coordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function headingLabel(heading: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8];
}

export function getNodesAround(position: Coordinate): ResourceNode[] {
  const nodes: ResourceNode[] = [
    { id: "first-daisy", x: 2, y: 2, resource: "herbs", discovery: "daisy" },
    { id: "first-clover", x: -3, y: 4, resource: "fiber", discovery: "clover" },
    { id: "first-wood", x: 21, y: 15, resource: "wood", discovery: "mushroom" },
  ];
  const centerX = Math.floor(position.x / CHUNK_SIZE);
  const centerY = Math.floor(position.y / CHUNK_SIZE);
  for (let x = centerX - 1; x <= centerX + 1; x += 1) {
    for (let y = centerY - 1; y <= centerY + 1; y += 1) {
      for (let index = 0; index < 3; index += 1) {
        const px = (x + 0.12 + randomAt(x, y, index * 2 + 31) * 0.76) * CHUNK_SIZE;
        const py = (y + 0.12 + randomAt(x, y, index * 2 + 32) * 0.76) * CHUNK_SIZE;
        const biome = getBiomeAt(px, py).id;
        const find = FINDS[biome][randomAt(x, y, index + 47) < 0.5 ? 0 : 1];
        nodes.push({ id: `${x}:${y}:${index}`, x: px, y: py, ...find });
      }
    }
  }
  return nodes;
}

export function getTravellers(now: number): Traveller[] {
  const time = now / 1000;
  return [
    { id: "mira", name: "Mira", status: "online", x: 7 + Math.sin(time / 24) * 2, y: 5 + Math.cos(time / 24) * 2, color: "#d5a173", note: "Taking the scenic route." },
    { id: "rowan", name: "Rowan", status: "travelling", x: -9 + Math.sin(time / 50) * 4, y: 4 + Math.cos(time / 50) * 4, color: "#85a9a0", note: "Still wandering while away." },
    { id: "sol", name: "Sol", status: "camped", x: 4, y: -11, color: "#d3b77b", note: "Resting under the open sky." },
    { id: "jun", name: "Jun", status: "online", x: 34 + Math.sin(time / 32) * 3, y: 29 + Math.cos(time / 32) * 3, color: "#b8887f", note: "Following the forest paths." },
  ];
}
