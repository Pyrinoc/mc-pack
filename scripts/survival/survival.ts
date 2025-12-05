import { DisplaySlotId, Player, ScoreboardObjective, StartupEvent, system, world } from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

const GAME_PHASE = "kubi:survival_game_phase";
const SECOND = 20; // Ticks per second

class ItemTarget {
  name: string;
  count: number;
  items: MinecraftItemTypes[];

  constructor(name: string, items: MinecraftItemTypes | MinecraftItemTypes[], count?: number) {
    this.name = name;
    if (!Array.isArray(items)) {
      this.items = [items];
    } else {
      this.items = items;
    }
    this.count = count ?? 1;
  }
}

const levelItems: ItemTarget[][] = [
  [
    new ItemTarget("ladder", MinecraftItemTypes.Ladder),
    new ItemTarget("torches", MinecraftItemTypes.Torch, 10),
    new ItemTarget("stone sword", MinecraftItemTypes.StoneSword),
    new ItemTarget(
      "stone tools",
      [
        MinecraftItemTypes.StoneAxe,
        MinecraftItemTypes.StonePickaxe,
        MinecraftItemTypes.StoneShovel,
        MinecraftItemTypes.StoneHoe,
      ],
      2
    ),
    new ItemTarget("chest", MinecraftItemTypes.Chest),
  ],
];

enum Phases {
  INITIALIZE = 0,
  PLAYING = 1,
}

function tick() {
  if (system.currentTick % (30 * SECOND) == 0) {
    world.sendMessage(`Seconds since start: ${Math.floor(system.currentTick / SECOND)}`);
  }
  for (let p of world.getAllPlayers()) {
    p.onScreenDisplay.setActionBar(`Get a ${MinecraftItemTypes.Torch} in the next 200 seconds.}`);
    MinecraftItemTypes;
  }
}

export function setupSurvivalGame(event?: StartupEvent) {
  if (world.getDynamicProperty(GAME_PHASE) === undefined) {
    world.setDynamicProperty(GAME_PHASE, Phases.INITIALIZE);
  }

  let scoreObjective = world.scoreboard.getObjective("score") as ScoreboardObjective;
  if (world.scoreboard.getObjective("score") === undefined) {
    scoreObjective = world.scoreboard.addObjective("score", "Points") as ScoreboardObjective;
  }
  world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
    objective: scoreObjective,
  });
  for (let p of world.getAllPlayers()) {
    let participant: Player | string = (p.getDynamicProperty("kubi:survival-team") as string) ?? p;
    if (!scoreObjective.hasParticipant(participant)) {
      scoreObjective.setScore(participant, 0);
    }
  }

  system.runInterval(() => tick());
}
