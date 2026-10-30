import { memo, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useGameStore } from "../store";
import type { BiomeId, Coordinate, ResourceNode, Traveller } from "../types";
import {
  BIOMES,
  CHUNK_SIZE,
  ENCOUNTER_RADIUS,
  distance,
  getBiomeAt,
  getNodesAround,
  getTravellers,
  randomAt,
  regionWeights,
  riverDistance,
  terrainHeight,
} from "../world";

const TERRAIN_SEGMENTS = 12;

function groundColor(x: number, y: number): THREE.Color {
  const color = new THREE.Color(0, 0, 0);
  for (const region of regionWeights(x, y)) {
    color.add(new THREE.Color(BIOMES[region.id].color).multiplyScalar(region.weight));
  }
  const water = THREE.MathUtils.smoothstep(riverDistance(x, y), 2.4, 5);
  color.lerp(new THREE.Color("#729e98"), (1 - water) * 0.88);
  const variation = 0.94 + randomAt(Math.floor(x / 3), Math.floor(y / 3), 101) * 0.1;
  return color.multiplyScalar(variation);
}

const Terrain = memo(function Terrain({ chunkX, chunkY }: { chunkX: number; chunkY: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= TERRAIN_SEGMENTS; row += 1) {
      for (let column = 0; column <= TERRAIN_SEGMENTS; column += 1) {
        const x = (chunkX + column / TERRAIN_SEGMENTS) * CHUNK_SIZE;
        const y = (chunkY + row / TERRAIN_SEGMENTS) * CHUNK_SIZE;
        positions.push(x, terrainHeight(x, y), -y);
        const color = groundColor(x, y);
        colors.push(color.r, color.g, color.b);
        if (row < TERRAIN_SEGMENTS && column < TERRAIN_SEGMENTS) {
          const a = row * (TERRAIN_SEGMENTS + 1) + column;
          const b = a + TERRAIN_SEGMENTS + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [chunkX, chunkY]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
});

interface SceneryItem extends Coordinate {
  id: string;
  biome: BiomeId;
  variant: number;
  scale: number;
}

function Scenery({ item }: { item: SceneryItem }) {
  const { x, y, biome, variant, scale } = item;
  const ground = terrainHeight(x, y);
  const isTree = biome === "forest" || biome === "jungle" || (biome === "meadow" && variant > 0.69);
  if (isTree) {
    const leafy = biome === "jungle";
    return (
      <group position={[x, ground, -y]} scale={scale}>
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, 2, 6]} />
          <meshStandardMaterial color="#796c4d" />
        </mesh>
        <mesh position={[0, 2.45, 0]} castShadow>
          <dodecahedronGeometry args={[leafy ? 1.4 : 1.25, 0]} />
          <meshStandardMaterial color={leafy ? "#547f5d" : variant > 0.85 ? "#78965e" : "#6f8d59"} flatShading />
        </mesh>
        <mesh position={[0.35, 3.05, 0.1]} castShadow>
          <dodecahedronGeometry args={[0.87, 0]} />
          <meshStandardMaterial color={leafy ? "#668c62" : "#88a267"} flatShading />
        </mesh>
      </group>
    );
  }
  if (biome === "mountains" || biome === "desert") {
    return (
      <mesh position={[x, ground + 0.3 * scale, -y]} scale={[scale, scale * 0.65, scale]} rotation={[0, variant * 5, 0]} castShadow>
        <dodecahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial color={biome === "desert" ? "#bba079" : "#92978b"} flatShading />
      </mesh>
    );
  }
  return (
    <group position={[x, ground, -y]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <dodecahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial color={variant > 0.5 ? "#829d65" : "#90a76d"} flatShading />
      </mesh>
      {variant > 0.35 && (
        <mesh position={[0.15, 0.48, 0.1]}>
          <sphereGeometry args={[0.12, 6, 5]} />
          <meshStandardMaterial color={variant > 0.7 ? "#f2d89d" : "#e4b7a3"} />
        </mesh>
      )}
    </group>
  );
}

const SceneryChunk = memo(function SceneryChunk({ chunkX, chunkY }: { chunkX: number; chunkY: number }) {
  const items = useMemo(() => {
    const result: SceneryItem[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const keyX = chunkX * 4 + column;
        const keyY = chunkY * 4 + row;
        const x = (keyX + 0.15 + randomAt(keyX, keyY, 1) * 0.7) * CHUNK_SIZE / 4;
        const y = (keyY + 0.15 + randomAt(keyX, keyY, 2) * 0.7) * CHUNK_SIZE / 4;
        const biome = getBiomeAt(x, y).id;
        if (biome === "river" || Math.hypot(x, y) < 3 || randomAt(keyX, keyY, 5) > 0.78) continue;
        result.push({
          id: `${keyX}:${keyY}`,
          x, y, biome,
          variant: randomAt(keyX, keyY, 3),
          scale: 0.7 + randomAt(keyX, keyY, 4) * 0.7,
        });
      }
    }
    return result;
  }, [chunkX, chunkY]);
  return <>{items.map((item) => <Scenery key={item.id} item={item} />)}</>;
});

function Camp({ color = "#d6b079" }: { color?: string }) {
  return (
    <group position={[1.15, 0, 0.4]} rotation={[0, 0.35, 0]}>
      <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <coneGeometry args={[0.95, 1.15, 4, 1]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 0.12, -0.5]} rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[0.28, 0.48, 3]} />
        <meshStandardMaterial color="#594d3d" />
      </mesh>
    </group>
  );
}

function Explorer({ position, color, heading = 0, camping = false }: {
  position: Coordinate;
  color: string;
  heading?: number;
  camping?: boolean;
}) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (body.current) body.current.position.y = camping ? 0 : Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.06;
  });
  return (
    <group position={[position.x, terrainHeight(position.x, position.y), -position.y]}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.65, 24]} />
        <meshBasicMaterial color="#293b2c" transparent opacity={0.22} />
      </mesh>
      <group ref={body} rotation={[0, heading * Math.PI / 180, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.31, 0.52, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.34, 0]} castShadow>
          <sphereGeometry args={[0.23, 10, 8]} />
          <meshStandardMaterial color="#e1bd9b" />
        </mesh>
        <mesh position={[0, 1.58, 0]} castShadow>
          <coneGeometry args={[0.35, 0.25, 8]} />
          <meshStandardMaterial color="#485d43" />
        </mesh>
        <mesh position={[0, 0.78, 0.29]} castShadow>
          <boxGeometry args={[0.43, 0.5, 0.2]} />
          <meshStandardMaterial color="#9b754e" />
        </mesh>
      </group>
      {camping && <Camp />}
    </group>
  );
}

function FindMarker({ node }: { node: ResourceNode }) {
  const marker = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (marker.current) {
      marker.current.rotation.y = clock.elapsedTime * 0.6;
      marker.current.position.y = terrainHeight(node.x, node.y) + 0.85 + Math.sin(clock.elapsedTime * 2) * 0.12;
    }
  });
  return (
    <group ref={marker} position={[node.x, terrainHeight(node.x, node.y) + 0.85, -node.y]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f4dc9d" emissive="#d4ae68" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function TravellerFigure({ traveller }: { traveller: Traveller }) {
  const markerColor = traveller.status === "online" ? "#b9d995" : traveller.status === "travelling" ? "#edc882" : "#b7c8d1";
  return (
    <>
      <Explorer position={traveller} color={traveller.color} camping={traveller.status === "camped"} />
      <mesh position={[traveller.x, terrainHeight(traveller.x, traveller.y) + 2.1, -traveller.y]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial color={markerColor} />
      </mesh>
    </>
  );
}

function FollowingControls({ initial }: { initial: Coordinate }) {
  const controls = useRef<OrbitControlsImpl>(null);
  useFrame((_, delta) => {
    const instance = controls.current;
    if (!instance) return;
    const { position } = useGameStore.getState();
    const target = new THREE.Vector3(position.x, terrainHeight(position.x, position.y) + 0.6, -position.y);
    const shift = target.sub(instance.target).multiplyScalar(Math.min(1, delta * 4));
    instance.target.add(shift);
    instance.object.position.add(shift);
    instance.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[initial.x, terrainHeight(initial.x, initial.y), -initial.y]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={13}
      maxDistance={29}
      minPolarAngle={0.55}
      maxPolarAngle={1.18}
    />
  );
}

function Sunlight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const { position } = useGameStore.getState();
    target.position.set(position.x, terrainHeight(position.x, position.y), -position.y);
    if (light.current) light.current.position.set(position.x + 15, 25, -position.y + 10);
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} target={target} position={[15, 25, 10]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} />
    </>
  );
}

export default function Scene3D() {
  const position = useGameStore((state) => state.position);
  const heading = useGameStore((state) => state.heading);
  const camping = useGameStore((state) => state.camping);
  const collected = useGameStore((state) => state.collected);
  const chunkX = Math.floor(position.x / CHUNK_SIZE);
  const chunkY = Math.floor(position.y / CHUNK_SIZE);
  const chunks = useMemo(() => {
    const result: { x: number; y: number }[] = [];
    for (let x = chunkX - 2; x <= chunkX + 2; x += 1) {
      for (let y = chunkY - 2; y <= chunkY + 2; y += 1) result.push({ x, y });
    }
    return result;
  }, [chunkX, chunkY]);
  const nodes = useMemo(() => getNodesAround(position).filter((node) => !collected.includes(node.id) && distance(position, node) < 25), [chunkX, chunkY, collected, position]);
  const travellers = getTravellers(Date.now()).filter((traveller) => distance(position, traveller) < ENCOUNTER_RADIUS + 12);
  const initial = useMemo(() => ({ ...position }), []);

  return (
    <div className="scene-canvas" aria-label="A continuous three-dimensional landscape with your explorer and nearby travellers">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [initial.x + 12, 17, -initial.y + 20], fov: 40, near: 0.1, far: 130 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <color attach="background" args={["#c6d4ba"]} />
        <fog attach="fog" args={["#c6d4ba", 36, 82]} />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#fff1d2", "#718c70", 0.9]} />
        <Sunlight />
        {chunks.map(({ x, y }) => (
          <group key={`${x}:${y}`}>
            <Terrain chunkX={x} chunkY={y} />
            <SceneryChunk chunkX={x} chunkY={y} />
          </group>
        ))}
        {nodes.map((node) => <FindMarker key={node.id} node={node} />)}
        {travellers.map((traveller) => <TravellerFigure key={traveller.id} traveller={traveller} />)}
        <Explorer position={position} color="#c87952" heading={heading} camping={camping} />
        <FollowingControls initial={initial} />
      </Canvas>
    </div>
  );
}
