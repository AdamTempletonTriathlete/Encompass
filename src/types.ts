export interface Coordinate {
  x: number;
  y: number;
}

export type BiomeId = "meadow" | "forest" | "mountains" | "desert" | "jungle" | "river";
export type ResourceId = "wood" | "herbs" | "stone" | "fiber" | "berries" | "mineral";
export type AwayMode = "travel" | "camp";
export type TravellerStatus = "online" | "travelling" | "camped";

export interface Biome {
  id: BiomeId;
  name: string;
  description: string;
  color: string;
}

export interface Discovery {
  id: string;
  name: string;
  category: string;
  biome: BiomeId;
  description: string;
  symbol: string;
}

export interface ResourceNode extends Coordinate {
  id: string;
  resource: ResourceId;
  discovery: string;
}

export interface Traveller extends Coordinate {
  id: string;
  name: string;
  status: TravellerStatus;
  color: string;
  note: string;
}

export type HatStyle = "ranger" | "cap" | "beanie" | "none";

export interface Appearance {
  outfit: string;
  skin: string;
  hair: string;
  accent: string;
  hat: HatStyle;
  backpack: boolean;
  scarf: boolean;
}
