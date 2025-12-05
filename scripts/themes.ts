import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { rl } from "./utilities";

type BlockWeight = {
  block: MinecraftBlockTypes;
  weight?: number;
};

type Theme = {
  floor: BlockWeight[];
  walls: BlockWeight[];
  wallHeight?: number;
};

export type ThemeGenerators = {
  floor: () => MinecraftBlockTypes;
  wall: () => MinecraftBlockTypes;
};

export function getThemes(): string[] {
  return [...themes.keys()];
}

export function getThemeGenerators(themeName: string | undefined): ThemeGenerators {
  if (themeName === undefined || !themes.has(themeName)) {
    themeName = rl([...themes.keys()]);
  }
  let choice = themes.get(themeName) ?? { floor: [], walls: [] };

  let floorList: MinecraftBlockTypes[] = [];
  for (let theme of choice.floor) {
    for (let i = 0; i < (theme.weight ?? 1); i++) {
      floorList.push(theme.block);
    }
  }
  let wallList: MinecraftBlockTypes[] = [];
  for (let theme of choice.walls) {
    for (let i = 0; i < (theme.weight ?? 1); i++) {
      wallList.push(theme.block);
    }
  }
  return {
    floor: () => rl(floorList),
    wall: () => rl(wallList),
  };
}

/**
 * Define custom themes here!
 **/

const themes: Map<string, Theme> = new Map();
themes.set("stone", {
  floor: [{ block: MinecraftBlockTypes.Stone }],
  walls: [
    { block: MinecraftBlockTypes.StoneBricks, weight: 3 },
    { block: MinecraftBlockTypes.MossyStoneBricks, weight: 1 },
    { block: MinecraftBlockTypes.DeepslateBricks, weight: 1 },
    { block: MinecraftBlockTypes.PolishedBlackstoneBricks, weight: 1 },
  ],
});
themes.set("cherry", {
  floor: [{ block: MinecraftBlockTypes.PinkGlazedTerracotta }],
  walls: [
    { block: MinecraftBlockTypes.CherryWood, weight: 1 },
    { block: MinecraftBlockTypes.CherryPlanks, weight: 3 },
    { block: MinecraftBlockTypes.StrippedCherryWood, weight: 1 },
  ],
});
