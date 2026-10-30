import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

let server;
let store;
let world;

const emptyInventory = () => ({ wood: 0, herbs: 0, stone: 0, fiber: 0, berries: 0, mineral: 0 });

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  world = await server.ssrLoadModule("/src/world.ts");
  ({ useGameStore: store } = await server.ssrLoadModule("/src/store.ts"));
});

after(async () => {
  await server?.close();
});

test("headings move continuously with north as zero and east as ninety", () => {
  assert.deepEqual(world.movePosition({ x: 2, y: 3 }, 0, 10, 1), { x: 2, y: 13 });
  const east = world.movePosition({ x: 2, y: 3 }, 90, 10, 1);
  assert.ok(Math.abs(east.x - 12) < 1e-10);
  assert.ok(Math.abs(east.y - 3) < 1e-10);
  const diagonal = world.movePosition({ x: 0, y: 0 }, 45, 1, 1);
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-10);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2) < 1e-10);
});

test("leaving and returning preserves position and applies the correct speed", () => {
  store.setState({ position: { x: 0, y: 0 }, heading: 90, active: true, camping: false, awayMode: "travel", trailBoots: false, lastUpdatedAt: 1000 });
  store.getState().tick(11000);
  assert.ok(Math.abs(store.getState().position.x - 11.5) < 1e-10);
  store.getState().leaveWorld(11000);
  store.getState().enterWorld(21000);
  assert.ok(Math.abs(store.getState().position.x - 15) < 1e-10);
  store.setState({ position: { x: 0, y: 0 }, heading: 0, active: false, camping: false, awayMode: "travel", trailBoots: true, lastUpdatedAt: 1000 });
  store.getState().enterWorld(11000);
  assert.ok(Math.abs(store.getState().position.y - 5.5) < 1e-10);
});

test("camp remains stationary and a backwards clock does not duplicate travel", () => {
  store.setState({ position: { x: 3, y: 7 }, heading: 0, active: false, camping: true, awayMode: "camp", lastUpdatedAt: 1000 });
  store.getState().enterWorld(11000);
  store.getState().tick(21000);
  assert.deepEqual(store.getState().position, { x: 3, y: 7 });
  store.setState({ camping: false, lastUpdatedAt: 21000 });
  store.getState().tick(20000);
  assert.deepEqual(store.getState().position, { x: 3, y: 7 });
  assert.equal(store.getState().lastUpdatedAt, 21000);
});

test("turning and setting camp settle the previous movement first", () => {
  const originalNow = Date.now;
  try {
    store.setState({ position: { x: 0, y: 0 }, heading: 0, active: true, camping: false, awayMode: "travel", lastUpdatedAt: 1000 });
    Date.now = () => 11000;
    store.getState().setHeading(90);
    assert.ok(Math.abs(store.getState().position.y - 11.5) < 1e-10);
    Date.now = () => 21000;
    store.getState().setAwayMode("camp");
    assert.ok(Math.abs(store.getState().position.x - 11.5) < 1e-10);
    assert.equal(store.getState().camping, true);
    const saved = JSON.parse(storage.get("encompass-journey-v1")).state;
    assert.equal(saved.heading, 90);
    assert.equal(saved.awayMode, "camp");
    assert.equal("active" in saved, false);
  } finally {
    Date.now = originalNow;
  }
});

test("gathering records a discovery once and respects distance and capacity", () => {
  store.setState({ position: { x: 2, y: 2 }, inventory: emptyInventory(), discoveries: [], collected: [] });
  const daisy = world.getNodesAround({ x: 2, y: 2 }).find((node) => node.id === "first-daisy");
  store.getState().gather(daisy);
  store.getState().gather(daisy);
  assert.equal(store.getState().inventory.herbs, 1);
  assert.deepEqual(store.getState().discoveries, ["daisy"]);
  assert.deepEqual(store.getState().collected, ["first-daisy"]);
  const clover = world.getNodesAround({ x: -3, y: 4 }).find((node) => node.id === "first-clover");
  store.setState({ position: { x: 100, y: 100 }, collected: [] });
  store.getState().gather(clover);
  assert.deepEqual(store.getState().collected, []);
  store.setState({ position: { x: -3, y: 4 }, inventory: { ...emptyInventory(), wood: world.INVENTORY_CAPACITY } });
  store.getState().gather(clover);
  assert.deepEqual(store.getState().collected, []);
  assert.equal(store.getState().inventory.fiber, 0);
  store.getState().discardResource("wood");
  assert.equal(store.getState().inventory.wood, world.INVENTORY_CAPACITY - 1);
  store.getState().gather(clover);
  assert.equal(store.getState().inventory.fiber, 1);
  store.getState().discardResource("herbs");
  assert.equal(store.getState().inventory.herbs, 0);
});

test("trail boots require and consume materials exactly once", () => {
  store.setState({ inventory: { ...emptyInventory(), wood: 1, herbs: 2 }, trailBoots: false });
  store.getState().craftBoots();
  assert.equal(store.getState().trailBoots, false);
  store.setState({ inventory: { ...emptyInventory(), wood: 2, herbs: 2 } });
  store.getState().craftBoots();
  store.getState().craftBoots();
  assert.equal(store.getState().trailBoots, true);
  assert.equal(store.getState().inventory.wood, 0);
  assert.equal(store.getState().inventory.herbs, 0);
});
