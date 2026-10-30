import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AwayMode, Coordinate, ResourceId, ResourceNode } from "./types";
import {
  DISCOVERIES,
  GATHER_RADIUS,
  INVENTORY_CAPACITY,
  OFFLINE_SPEED,
  ONLINE_SPEED,
  RESOURCES,
  UPGRADED_OFFLINE_SPEED,
  distance,
  getNodesAround,
  movePosition,
} from "./world";

interface GameState {
  position: Coordinate;
  heading: number;
  awayMode: AwayMode;
  camping: boolean;
  active: boolean;
  lastUpdatedAt: number;
  inventory: Record<ResourceId, number>;
  discoveries: string[];
  collected: string[];
  trailBoots: boolean;
  message: string | null;
  enterWorld: (now: number) => void;
  leaveWorld: (now: number) => void;
  tick: (now: number) => void;
  setHeading: (heading: number) => void;
  setAwayMode: (mode: AwayMode) => void;
  gather: (node: ResourceNode) => void;
  discardResource: (resource: ResourceId) => void;
  craftBoots: () => void;
  clearMessage: () => void;
}

const initialState = () => ({
  position: { x: 0, y: 0 },
  heading: 35,
  awayMode: "travel" as AwayMode,
  camping: false,
  active: false,
  lastUpdatedAt: Date.now(),
  inventory: { wood: 0, herbs: 0, stone: 0, fiber: 0, berries: 0, mineral: 0 },
  discoveries: [] as string[],
  collected: [] as string[],
  trailBoots: false,
  message: null as string | null,
});

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      enterWorld: (now) => {
        const state = get();
        if (state.active) return;
        const elapsed = Math.max(0, now - state.lastUpdatedAt) / 1000;
        const speed = state.trailBoots ? UPGRADED_OFFLINE_SPEED : OFFLINE_SPEED;
        const travelled = state.awayMode === "travel" && !state.camping && elapsed > 0;
        set({
          position: travelled ? movePosition(state.position, state.heading, elapsed, speed) : state.position,
          lastUpdatedAt: Math.max(now, state.lastUpdatedAt),
          active: true,
          message: elapsed > 10
            ? travelled
              ? "Your journey continued while you were away."
              : "Your camp kept you safe while you were away."
            : state.message,
        });
      },
      leaveWorld: (now) => {
        if (!get().active) return;
        get().tick(now);
        set({ active: false });
      },
      tick: (now) => {
        const state = get();
        if (!state.active || now <= state.lastUpdatedAt) return;
        const elapsed = (now - state.lastUpdatedAt) / 1000;
        set({
          position: state.camping ? state.position : movePosition(state.position, state.heading, elapsed, ONLINE_SPEED),
          lastUpdatedAt: now,
        });
      },
      setHeading: (heading) => {
        if (!Number.isFinite(heading)) {
          set({ message: "That heading could not be set." });
          return;
        }
        get().tick(Date.now());
        set({ heading: ((Math.round(heading) % 360) + 360) % 360 });
      },
      setAwayMode: (mode) => {
        get().tick(Date.now());
        set({
          awayMode: mode,
          camping: mode === "camp",
          message: mode === "camp"
            ? "Camp is set. You are stationary and protected."
            : "On the move. Your journey will continue while you are away.",
        });
      },
      gather: (node) => {
        const state = get();
        const currentNode = getNodesAround(state.position).find((item) => item.id === node.id);
        if (!currentNode || distance(state.position, currentNode) > GATHER_RADIUS || state.collected.includes(node.id)) {
          set({ message: "That find is no longer within reach." });
          return;
        }
        const count = Object.values(state.inventory).reduce((sum, amount) => sum + amount, 0);
        if (count >= INVENTORY_CAPACITY) {
          set({ message: "Your satchel is full. Craft or discard resources to make room." });
          return;
        }
        const discovery = DISCOVERIES.find((item) => item.id === currentNode.discovery);
        if (!discovery) {
          set({ message: "This discovery could not be recorded." });
          return;
        }
        const isNew = !state.discoveries.includes(discovery.id);
        set({
          inventory: { ...state.inventory, [currentNode.resource]: state.inventory[currentNode.resource] + 1 },
          discoveries: isNew ? [...state.discoveries, discovery.id] : state.discoveries,
          collected: [...state.collected, currentNode.id],
          message: isNew
            ? `${discovery.name} added to your field notes. +1 ${RESOURCES[currentNode.resource].name.toLowerCase()}.`
            : `Collected 1 ${RESOURCES[currentNode.resource].name.toLowerCase()}.`,
        });
      },
      discardResource: (resource) => {
        const state = get();
        if (state.inventory[resource] <= 0) {
          set({ message: `You have no ${RESOURCES[resource].name.toLowerCase()} to discard.` });
          return;
        }
        set({
          inventory: { ...state.inventory, [resource]: state.inventory[resource] - 1 },
          message: `Discarded 1 ${RESOURCES[resource].name.toLowerCase()}.`,
        });
      },
      craftBoots: () => {
        const state = get();
        if (state.trailBoots) {
          set({ message: "Your trail boots are already equipped." });
        } else if (state.inventory.wood < 2 || state.inventory.herbs < 2) {
          set({ message: "Trail boots need 2 wood and 2 herbs." });
        } else {
          set({
            inventory: { ...state.inventory, wood: state.inventory.wood - 2, herbs: state.inventory.herbs - 2 },
            trailBoots: true,
            message: "Trail boots equipped. Your away travel is faster.",
          });
        }
      },
      clearMessage: () => set({ message: null }),
    }),
    {
      name: "encompass-journey-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        position: state.position,
        heading: state.heading,
        awayMode: state.awayMode,
        camping: state.camping,
        lastUpdatedAt: state.lastUpdatedAt,
        inventory: state.inventory,
        discoveries: state.discoveries,
        collected: state.collected,
        trailBoots: state.trailBoots,
      }),
    },
  ),
);
