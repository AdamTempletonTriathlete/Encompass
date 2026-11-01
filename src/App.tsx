import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  ArrowRight,
  Backpack,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Footprints,
  Leaf,
  MapPin,
  Minus,
  Shirt,
  Sparkles,
  TentTree,
  UsersRound,
  Wind,
  X,
} from "lucide-react";
import { view } from "./view";
import Scene3D from "./components/Scene3D";
import { useGameStore } from "./store";
import type { AwayMode, BiomeId, ResourceId, Traveller } from "./types";
import {
  ACCENT_COLORS,
  BIOMES,
  DISCOVERIES,
  HAIR_COLORS,
  HAT_STYLES,
  OUTFIT_COLORS,
  SKIN_TONES,
  ENCOUNTER_RADIUS,
  INVENTORY_CAPACITY,
  OFFLINE_SPEED,
  RESOURCES,
  UPGRADED_OFFLINE_SPEED,
  distance,
  getBiomeAt,
  getTravellers,
  headingLabel,
} from "./world";

type Panel = "notes" | "style" | "satchel" | "away" | "encounter" | null;

const STATUS_LABELS = {
  online: "Exploring online",
  travelling: "Travelling away",
  camped: "Camped & protected",
};

function CompassDial({ heading, onChange }: { heading: number; onChange: (heading: number) => void }) {
  const setFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < 10) return;
    onChange(Math.atan2(dx, -dy) * 180 / Math.PI + view.heading);
  };
  const face = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const headingRef = useRef(heading);
  headingRef.current = heading;
  // Drive the rotation straight from the DOM each frame; the camera eases continuously.
  useEffect(() => {
    let frame = 0;
    let last = "";
    const update = () => {
      const key = `${view.heading.toFixed(2)}|${headingRef.current}`;
      if (key !== last) {
        last = key;
        const relative = ((((headingRef.current - view.heading) % 360) + 540) % 360) - 180;
        if (face.current) face.current.style.transform = `rotate(${-view.heading}deg)`;
        if (needle.current) needle.current.style.transform = `rotate(${relative}deg)`;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);
  const release = () => { view.steering = false; view.holdUntil = 0; };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === "ArrowRight" || key === "ArrowUp") onChange(heading + (event.shiftKey ? 15 : 1));
    else if (key === "ArrowLeft" || key === "ArrowDown") onChange(heading - (event.shiftKey ? 15 : 1));
    else if (key === "Home") onChange(0);
    else if (key === "End") onChange(359);
    else return;
    event.preventDefault();
  };
  return (
    <div
      className="compass-dial"
      role="slider"
      tabIndex={0}
      aria-label="Compass heading"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={heading}
      aria-valuetext={`${heading} degrees ${headingLabel(heading)}`}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        view.steering = true;
        setFromPointer(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event);
      }}
    >
      <div className="dial-inner" />
      <div className="dial-face" ref={face}>
        {Array.from({ length: 36 }, (_, index) => (
          <span key={index} className={`dial-tick ${index % 9 === 0 ? "major" : index % 3 === 0 ? "medium" : ""}`} style={{ transform: `rotate(${index * 10}deg)` }} />
        ))}
        <span className="dial-cardinal north">N</span>
        <span className="dial-cardinal east">E</span>
        <span className="dial-cardinal south">S</span>
        <span className="dial-cardinal west">W</span>
      </div>
      <div className="dial-needle" ref={needle}><span className="needle-point" /></div>
      <span className="dial-degrees">{String(heading).padStart(3, "0")}°</span>
    </div>
  );
}

function Sheet({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    sheetRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sheet-header">
          <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
          <button className="icon-button sheet-close" onClick={onClose} aria-label={`Close ${title}`}><X size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FieldNotes({ onClose }: { onClose: () => void }) {
  const discoveries = useGameStore((state) => state.discoveries);
  const groups: BiomeId[] = ["meadow", "forest", "mountains", "desert", "jungle", "river"];
  return (
    <Sheet title="Field notes" eyebrow="YOUR COLLECTION" onClose={onClose}>
      <p className="sheet-intro">A little record of everything you find out there. There is always more to discover.</p>
      <div className="collection-progress">
        <span>YOUR DISCOVERIES</span><strong>{String(discoveries.length).padStart(2, "0")} <small>/ {DISCOVERIES.length}</small></strong>
        <div><i style={{ width: `${discoveries.length / DISCOVERIES.length * 100}%` }} /></div>
      </div>
      <div className="notes-list">
        {groups.map((biome) => (
          <section className="notes-group" key={biome}>
            <div className="group-heading"><span>{BIOMES[biome].name}</span><small>{DISCOVERIES.filter((item) => item.biome === biome && discoveries.includes(item.id)).length} / 2</small></div>
            <div className="discovery-grid">
              {DISCOVERIES.filter((item) => item.biome === biome).map((item) => {
                const found = discoveries.includes(item.id);
                return (
                  <div className={`discovery ${found ? "found" : ""}`} key={item.id}>
                    <span className="discovery-symbol">{found ? item.symbol : "?"}</span>
                    <div><strong>{found ? item.name : "Undiscovered"}</strong><small>{found ? item.description : `Find in ${BIOMES[biome].name}`}</small></div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function Satchel({ onClose }: { onClose: () => void }) {
  const inventory = useGameStore((state) => state.inventory);
  const trailBoots = useGameStore((state) => state.trailBoots);
  const discardResource = useGameStore((state) => state.discardResource);
  const craftBoots = useGameStore((state) => state.craftBoots);
  const count = Object.values(inventory).reduce((sum, amount) => sum + amount, 0);
  return (
    <Sheet title="Your satchel" eyebrow="CARRY A LITTLE, FIND A LOT" onClose={onClose}>
      <p className="sheet-intro">Gather useful things as you wander. Every little find has a purpose.</p>
      <div className="satchel-capacity"><span>INVENTORY SPACE</span><strong>{count} <small>/ {INVENTORY_CAPACITY}</small></strong></div>
      <div className="capacity-bar"><i style={{ width: `${count / INVENTORY_CAPACITY * 100}%` }} /></div>
      <div className="resource-grid">
        {(Object.keys(RESOURCES) as ResourceId[]).map((id) => (
          <div className="resource-item" key={id}>
            <span className="resource-symbol" style={{ color: RESOURCES[id].color }}>{RESOURCES[id].symbol}</span>
            <div><strong>{RESOURCES[id].name}</strong><small>RESOURCE</small></div>
            <b>{String(inventory[id]).padStart(2, "0")}</b>
            <button className="discard-button" onClick={() => discardResource(id)} disabled={inventory[id] === 0} aria-label={`Discard one ${RESOURCES[id].name.toLowerCase()}`} title={`Discard one ${RESOURCES[id].name.toLowerCase()}`}><Minus size={13} /></button>
          </div>
        ))}
      </div>
      <p className="resource-hint">Use the minus button to leave one resource behind.</p>
      <div className="sheet-section-title"><span>EQUIPMENT & CRAFTING</span><span>01 / 05</span></div>
      <div className="equipment-feature">
        <div className="equipment-icon"><Footprints size={24} /></div>
        <div className="equipment-copy"><strong>Trail boots</strong><p>A little extra distance while you're away.</p><small>2 WOOD&nbsp;&nbsp; + &nbsp;&nbsp;2 HERBS</small></div>
        <button className="craft-button" onClick={craftBoots} disabled={trailBoots}>{trailBoots ? "Equipped" : "Craft"}</button>
      </div>
      <div className="equipment-slots">
        <span>BACKPACK <small>Coming later</small></span><span>COMPASS <small>Coming later</small></span><span>TOOLS <small>Coming later</small></span><span>CLOTHING <small>Coming later</small></span>
      </div>
    </Sheet>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (color: string) => void }) {
  return (
    <div className="style-row">
      <span>{label}</span>
      <div className="swatches">
        {colors.map((color) => (
          <button key={color} type="button" className={`swatch ${value === color ? "selected" : ""}`} style={{ background: color }} aria-label={`${label} ${color}`} aria-pressed={value === color} onClick={() => onPick(color)} />
        ))}
      </div>
    </div>
  );
}

function StyleSheet({ onClose }: { onClose: () => void }) {
  const appearance = useGameStore((state) => state.appearance);
  const setAppearance = useGameStore((state) => state.setAppearance);
  return (
    <Sheet title="Make it yours." eyebrow="EXPLORER STYLE" onClose={onClose}>
      <p className="sheet-intro">Choose how your explorer looks out in the world. Changes appear instantly.</p>
      <Swatches label="OUTFIT" colors={OUTFIT_COLORS} value={appearance.outfit} onPick={(outfit) => setAppearance({ outfit })} />
      <Swatches label="ACCENT" colors={ACCENT_COLORS} value={appearance.accent} onPick={(accent) => setAppearance({ accent })} />
      <Swatches label="SKIN" colors={SKIN_TONES} value={appearance.skin} onPick={(skin) => setAppearance({ skin })} />
      <Swatches label="HAIR" colors={HAIR_COLORS} value={appearance.hair} onPick={(hair) => setAppearance({ hair })} />
      <div className="style-row">
        <span>HAT</span>
        <div className="style-options">
          {HAT_STYLES.map((hat) => (
            <button key={hat.id} type="button" className={appearance.hat === hat.id ? "selected" : ""} aria-pressed={appearance.hat === hat.id} onClick={() => setAppearance({ hat: hat.id })}>{hat.name}</button>
          ))}
        </div>
      </div>
      <div className="style-row">
        <span>EXTRAS</span>
        <div className="style-options">
          <button type="button" className={appearance.scarf ? "selected" : ""} aria-pressed={appearance.scarf} onClick={() => setAppearance({ scarf: !appearance.scarf })}>Scarf</button>
          <button type="button" className={appearance.backpack ? "selected" : ""} aria-pressed={appearance.backpack} onClick={() => setAppearance({ backpack: !appearance.backpack })}>Backpack</button>
        </div>
      </div>
    </Sheet>
  );
}

function AwaySheet({ onClose }: { onClose: () => void }) {
  const mode = useGameStore((state) => state.awayMode);
  const setAwayMode = useGameStore((state) => state.setAwayMode);
  const trailBoots = useGameStore((state) => state.trailBoots);
  const choose = (next: AwayMode) => {
    setAwayMode(next);
    onClose();
  };
  return (
    <Sheet title="Make yourself at home." eyebrow="WHEN YOU STEP AWAY" onClose={onClose}>
      <p className="sheet-intro">Your explorer stays in the world. Choose how they spend their time, even when you close the game.</p>
      <div className="away-options">
        <button className={`away-option ${mode === "travel" ? "selected" : ""}`} onClick={() => choose("travel")}>
          <span className="away-icon"><Wind size={22} /></span>
          <span><strong>Keep travelling</strong><small>Continue in your last direction at a gentler pace. Choosing this also breaks camp.</small><em>{trailBoots ? UPGRADED_OFFLINE_SPEED : OFFLINE_SPEED} units / sec while away</em></span>
          {mode === "travel" ? <Check size={18} /> : <ChevronRight size={18} />}
        </button>
        <button className={`away-option ${mode === "camp" ? "selected" : ""}`} onClick={() => choose("camp")}>
          <span className="away-icon"><TentTree size={22} /></span>
          <span><strong>Set up camp</strong><small>Stop here and rest. Your camp keeps you protected from encounters.</small><em>STATIONARY & PROTECTED</em></span>
          {mode === "camp" ? <Check size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
      <p className="prototype-note"><Sparkles size={14} /> Your journey is saved on this device. Away travel is calculated when you return.</p>
    </Sheet>
  );
}

function EncounterSheet({ traveller, onClose }: { traveller: Traveller; onClose: () => void }) {
  const [waved, setWaved] = useState(false);
  return (
    <Sheet title={`Meet ${traveller.name}`} eyebrow="A FELLOW WANDERER" onClose={onClose}>
      <div className="encounter-portrait"><span style={{ background: traveller.color }}><UsersRound size={32} /></span><div><strong>{traveller.name}</strong><small><i className={`status-dot ${traveller.status}`} /> {STATUS_LABELS[traveller.status]}</small></div></div>
      <p className="encounter-quote">“{traveller.note}”</p>
      <button className="wave-button" onClick={() => setWaved(true)}>{waved ? <><Check size={17} /> You waved hello</> : <>Wave hello <ArrowRight size={17} /></>}</button>
      <div className="coming-actions"><span>Trade <small>COMING LATER</small></span><span>Explore together <small>COMING LATER</small></span><span>Friendly wagers <small>COMING LATER</small></span></div>
      <p className="prototype-note"><Sparkles size={14} /> {traveller.name} is a simulated traveller. Multiplayer and social actions are planned, not connected yet.</p>
    </Sheet>
  );
}

function App() {
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedTraveller, setSelectedTraveller] = useState<Traveller | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const position = useGameStore((state) => state.position);
  const heading = useGameStore((state) => state.heading);
  const camping = useGameStore((state) => state.camping);
  const awayMode = useGameStore((state) => state.awayMode);
  const inventory = useGameStore((state) => state.inventory);
  const discoveries = useGameStore((state) => state.discoveries);
  const message = useGameStore((state) => state.message);
  const enterWorld = useGameStore((state) => state.enterWorld);
  const leaveWorld = useGameStore((state) => state.leaveWorld);
  const tick = useGameStore((state) => state.tick);
  const setHeading = useGameStore((state) => state.setHeading);
  const clearMessage = useGameStore((state) => state.clearMessage);
  const biome = getBiomeAt(position.x, position.y);
  const inventoryCount = Object.values(inventory).reduce((sum, amount) => sum + amount, 0);
  const nearbyTraveller = getTravellers(Date.now())
    .filter((traveller) => distance(position, traveller) <= ENCOUNTER_RADIUS)
    .sort((a, b) => distance(position, a) - distance(position, b))[0];

  useEffect(() => {
    const updateVisibility = () => {
      if (document.visibilityState === "visible") enterWorld(Date.now());
      else leaveWorld(Date.now());
    };
    const onPageHide = () => leaveWorld(Date.now());
    const onPageShow = () => {
      if (document.visibilityState === "visible") enterWorld(Date.now());
    };
    updateVisibility();
    let frame = 0;
    const loop = () => {
      tick(Date.now());
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      leaveWorld(Date.now());
    };
  }, [enterWorld, leaveWorld, tick]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(clearMessage, 5000);
    return () => window.clearTimeout(timeout);
  }, [message, clearMessage]);

  return (
    <main className="app-shell">
      <div className="world-stage">
        <Scene3D />
        <div className="world-vignette" />
        <header className="topbar">
          <div className="brand"><div className="brand-icon"><Compass size={23} strokeWidth={1.5} /></div><div><strong>encompass<span>.</span></strong><small>A WORLD TO WANDER</small></div></div>
          <nav className="main-nav" aria-label="Your journey">
            <button className="nav-active" aria-label="Explore" onClick={closePanel}><Compass size={15} /> <span>Explore</span></button>
            <button aria-label={`Field notes, ${discoveries.length} discoveries`} onClick={() => setPanel("notes")}><BookOpen size={15} /> <span>Field notes</span><small>{discoveries.length}</small></button>
            <button aria-label="Style" onClick={() => setPanel("style")}><Shirt size={15} /> <span>Style</span></button>
            <button aria-label="Satchel" onClick={() => setPanel("satchel")}><Backpack size={15} /> <span>Satchel</span></button>
          </nav>
          <div className="header-status"><span className="header-status-dot" /><span>YOUR JOURNEY IS LIVE<small>Saved on this device</small></span><div className="avatar">E</div></div>
        </header>

        <div className="scene-content">
          <div className="bottom-hud">
            <button className="side-button" onClick={() => setPanel("away")} aria-label={`When you're away: ${awayMode === "camp" ? "camp and rest" : "keep travelling"}`}>
              {awayMode === "camp" ? <TentTree size={20} /> : <Wind size={20} />}
            </button>
            <div className="compass-hud">
              <div className="location-tag"><MapPin size={14} /><strong>{biome.name}</strong></div>
              <CompassDial heading={heading} onChange={setHeading} />
            </div>
            {nearbyTraveller && !camping ? (
              <button className="side-button nearby" onClick={() => { setSelectedTraveller(nearbyTraveller); setPanel("encounter"); }} aria-label={`${nearbyTraveller.name} is nearby`}>
                <span className="traveller-avatar" style={{ background: nearbyTraveller.color }}>{nearbyTraveller.name[0]}</span>
              </button>
            ) : (
              <span className="side-spacer" aria-hidden="true" />
            )}
          </div>
        </div>

        <footer className="world-footer"><span><Leaf size={13} /> A LITTLE WORLD WITH A LOT TO FIND</span><span><Backpack size={13} /> {inventoryCount} / {INVENTORY_CAPACITY} IN SATCHEL <i /> <BookOpen size={13} /> {discoveries.length} / {DISCOVERIES.length} DISCOVERIES</span><span>{position.x.toFixed(1)} E &nbsp; / &nbsp; {position.y.toFixed(1)} N</span></footer>
        {message && <div className="toast" role="status"><Sparkles size={16} /> {message}<button onClick={clearMessage} aria-label="Dismiss message"><X size={15} /></button></div>}
      </div>
      {panel === "notes" && <FieldNotes onClose={closePanel} />}
      {panel === "satchel" && <Satchel onClose={closePanel} />}
      {panel === "style" && <StyleSheet onClose={closePanel} />}
      {panel === "away" && <AwaySheet onClose={closePanel} />}
      {panel === "encounter" && selectedTraveller && <EncounterSheet traveller={selectedTraveller} onClose={closePanel} />}
    </main>
  );
}

export default App;
