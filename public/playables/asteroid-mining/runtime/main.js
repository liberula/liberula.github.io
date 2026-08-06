import { startLoop } from "./loop.js";
import { TimerSystem } from "./timer_system.js";
import { SpriteSheet } from "./sprite_sheet.js";
import { Game } from "./game.js";
import { loadImage, createRenderer } from "./render.js";
import { Input } from "./input.js";
import { MeteorDefs, ShardDef } from "./assets.js";
import { PortfolioBridge } from "./playable_bridge.js";
import { createPlayableEventEmitter } from "./playable_events.js";

const canvas = document.getElementById("game");
const statusLayer = document.getElementById("status-layer");
const statusMessage = document.getElementById("status-message");
const retryButton = document.getElementById("retry-button");

const BASE_WIDTH = 720;
const BASE_HEIGHT = 1280;

const bridge = window.PlayableBridge ?? new PortfolioBridge();
const emitPlayableEvent = createPlayableEventEmitter(bridge);

performance.mark("playable_init_start");

async function loadSheets() {
  const meteorSheets = {};

  for (const def of MeteorDefs) {
    const img = await loadImage(def.file);
    meteorSheets[def.id] = SpriteSheet.fromStrip(img, def.frames);
  }

  let shardSheet = null;
  if (ShardDef?.file) {
    const shardImg = await loadImage(ShardDef.file);
    shardSheet = SpriteSheet.fromStrip(shardImg, ShardDef.frames);
  }

  return { meteorSheets, shardSheet };
}

async function init() {
  const timer = new TimerSystem();

  const renderer = createRenderer(canvas, BASE_WIDTH, BASE_HEIGHT);
  const ctx = renderer.ctx;

  const { meteorSheets, shardSheet } = await loadSheets();
  const input = new Input(canvas, {
    logicalWidth: BASE_WIDTH,
    logicalHeight: BASE_HEIGHT
  });

  const game = new Game(ctx, meteorSheets, timer, input, {
    baseWidth: BASE_WIDTH,
    baseHeight: BASE_HEIGHT,
    renderer,
    meteorDefs: MeteorDefs,
    shardSheet,
    bridge,
    emitPlayableEvent
  });

  let globalTime = 0;

  startLoop(
    dt => {
      globalTime += dt;
      timer.update(dt);
      input.update(dt);
      game.update(dt, globalTime);
    },
    () => {
      renderer.beginFrame();
      game.render(globalTime, BASE_WIDTH, BASE_HEIGHT);
      renderer.endFrame();
    }
  );

  performance.mark("playable_loaded");
  performance.measure(
    "playable_init_to_loaded",
    "playable_init_start",
    "playable_loaded"
  );
  emitPlayableEvent("playable_loaded");
  statusLayer.hidden = true;
}

function showInitializationError(error) {
  console.error("Unable to initialize playable", error);
  emitPlayableEvent("playable_error", { message: "Unable to load playable" });

  statusLayer.classList.remove("is-loading");
  statusMessage.textContent = "Unable to load playable";
  retryButton.hidden = false;
  retryButton.addEventListener("click", () => window.location.reload(), { once: true });
}

init().catch(showInitializationError);
