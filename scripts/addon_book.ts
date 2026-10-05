import {
  world,
  system,
  Player,
  PlayerPermissionLevel,
  ItemUseBeforeEvent,
  PlayerSpawnAfterEvent,
  ItemTypes,
  ItemStack,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { REPAIRABLE } from "./main";

const REPAIR_TYPES = ["wooden", "stone", "copper", "golden", "iron", "diamond", "netherite"];
const TOOL_TYPES = ["axe", "pickaxe", "shovel", "hoe", "sword", "helmet", "chestplate", "leggings", "boots"];

export function spawnAddonBook(event: PlayerSpawnAfterEvent) {
  const hasReceivedBookKey = "kubi:received_guidebook";
  const player = event.player;

  // Check if the player already got the book using dynamic properties or tags
  const tags = player.getTags();
  for (const tag of tags) {
    if (tag === hasReceivedBookKey) return;
  }

  const guideBookType = ItemTypes.get("kubi:guide_book");
  if (guideBookType === undefined) return;

  // Create the written book item
  const guideBook = new ItemStack(guideBookType, 1);

  // Give the book to the player's inventory
  const inventory = player.getComponent("inventory");
  if (inventory === undefined) return;

  for (let i = 0; i < inventory.container.size; i++) {
    if (inventory.container.getItem(i) === undefined) {
      inventory.container.setItem(i, guideBook);
      player.addTag(hasReceivedBookKey);
      break;
    }
  }
}

// Listen for when a player uses an item
export function useAddonBook(event: ItemUseBeforeEvent) {
  event.cancel = true;
  system.run(() => {
    openMainMenu(event.source);
  });
}

function openMainMenu(player: Player) {
  const form = new ActionFormData()
    .title("§lMy Awesome Add-on")
    .body("Welcome to the add-on! Use this menu to explore options or configure mechanics.")
    .button("Read Introduction")
    .button("⚙ Auto-Repair Settings");

  form.show(player).then((response) => {
    if (response.canceled) return;

    if (response.selection === 0) {
      player.sendMessage("§aAdd-on Info: More details coming soon!");
    } else if (response.selection === 1) {
      openAutoRepairSettingsMenu(player);
    }
  });
}

function openAutoRepairSettingsMenu(player: Player) {
  if (player.playerPermissionLevel != PlayerPermissionLevel.Operator) {
    player.sendMessage("§cYou must be an operator to change settings.");
    return;
  }

  const getProp = (t: string): boolean => {
    return world.getDynamicProperty(`kubi:auto_repair_${t}`) as boolean;
  };

  const form = new ModalFormData().title("Auto-Repair Settings");

  for (const t of REPAIR_TYPES) {
    form.toggle(`${t.charAt(0).toUpperCase()}${t.slice(1)}`, { defaultValue: getProp(t) });
  }

  form.show(player).then((response) => {
    if (response.canceled) return;

    const responses = response.formValues as boolean[];
    for (const t in responses) {
      world.setDynamicProperty(`kubi:auto_repair_${REPAIR_TYPES[t]}`, responses[t]);
    }
    const typesToRepair = setupRepairable();
    player.sendMessage("§aAuto-Repair settings saved!");
  });
}

export function setupRepairable(): string[] {
  const typesToRepair: string[] = [];

  REPAIRABLE.clear();
  for (const repairType of REPAIR_TYPES) {
    const prop = world.getDynamicProperty(`kubi:auto_repair_${repairType}`);

    if (prop === undefined) {
      world.setDynamicProperty(
        `kubi:auto_repair_${repairType}`,
        repairType === "diamond" || repairType === "netherite"
      );
    }
    if (world.getDynamicProperty(`kubi:auto_repair_${repairType}`)) {
      for (const toolType of TOOL_TYPES) {
        REPAIRABLE.add(`minecraft:${repairType}_${toolType}`);
      }
    }
  }
  return typesToRepair;
}
