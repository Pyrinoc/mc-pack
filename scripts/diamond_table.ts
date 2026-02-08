import {
  Enchantment,
  EnchantmentTypes,
  EntityComponentTypes,
  EntityInventoryComponent,
  ItemComponentTypes,
  Player,
  system,
  Vector3,
} from "@minecraft/server";
import { MinecraftEnchantmentTypes, MinecraftItemTypes } from "@minecraft/vanilla-data";
import { runActionForm } from "./TPCommand";

const ENCHANT_NAMES: Map<string, string> = new Map([
  [MinecraftEnchantmentTypes.Fortune, "Fortune"],
  [MinecraftEnchantmentTypes.Efficiency, "Efficiency"],
  [MinecraftEnchantmentTypes.FeatherFalling, "Feather Falling"],
  [MinecraftEnchantmentTypes.DepthStrider, "Depth Strider"],
  [MinecraftEnchantmentTypes.AquaAffinity, "Aqua Affinity"],
  [MinecraftEnchantmentTypes.Respiration, "Respiration"],
  [MinecraftEnchantmentTypes.Protection, "Protection"],
  [MinecraftEnchantmentTypes.FireProtection, "Fire Protection"],
  [MinecraftEnchantmentTypes.Sharpness, "Sharpness"],
  [MinecraftEnchantmentTypes.Looting, "Looting"],
  [MinecraftEnchantmentTypes.Power, "Power"],
  [MinecraftEnchantmentTypes.BowInfinity, "Bow Infinity"],
  [MinecraftEnchantmentTypes.LuckOfTheSea, "Luck Of The Sea"],
  [MinecraftEnchantmentTypes.Lure, "Lure"],
]);

function e(mType: MinecraftEnchantmentTypes, level: number): Enchantment {
  const type = EnchantmentTypes.get(mType);
  if (type === undefined) throw new Error("WTF");
  return { type: type, level: level };
}

function possibleEnchants(
  player: Player,
  inventory: EntityInventoryComponent,
  enchantsToCheck: Map<Enchantment, number>
): Map<string, Enchantment> {
  const item = inventory.container.getItem(player.selectedSlotIndex);
  const found: Map<string, Enchantment> = new Map();

  if (!item) return found;
  const enchantComp = item?.getComponent(ItemComponentTypes.Enchantable);
  if (enchantComp === undefined) return found;

  for (const [enchant, cost] of enchantsToCheck.entries()) {
    try {
      if (enchantComp.canAddEnchantment(enchant)) {
        found.set(ENCHANT_NAMES.get("minecraft:" + enchant.type.id) + " (" + cost + " diamonds)", enchant);
      }
    } catch (e) {
      // Empty
    }
  }
  return found;
}

export function diamondTableUse(player: Player | undefined, location: Vector3) {
  if (player === undefined) return;
  const ENCHANTS_TO_CHECK: Map<Enchantment, number> = new Map([
    [e(MinecraftEnchantmentTypes.Fortune, 3), 7],
    [e(MinecraftEnchantmentTypes.Efficiency, 5), 5],
    [e(MinecraftEnchantmentTypes.FeatherFalling, 4), 2],
    [e(MinecraftEnchantmentTypes.DepthStrider, 3), 2],
    [e(MinecraftEnchantmentTypes.AquaAffinity, 1), 2],
    [e(MinecraftEnchantmentTypes.Respiration, 3), 2],
    [e(MinecraftEnchantmentTypes.Protection, 4), 3],
    [e(MinecraftEnchantmentTypes.Sharpness, 5), 3],
    [e(MinecraftEnchantmentTypes.Looting, 3), 3],
    [e(MinecraftEnchantmentTypes.Power, 5), 3],
    [e(MinecraftEnchantmentTypes.BowInfinity, 1), 3],
    [e(MinecraftEnchantmentTypes.LuckOfTheSea, 3), 2],
    [e(MinecraftEnchantmentTypes.Lure, 3), 2],
  ]);

  const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
  if (!inventory || !inventory.container) return;
  const possible = possibleEnchants(player, inventory, ENCHANTS_TO_CHECK);
  if (possible.size == 0) return;

  runActionForm(player, Array.from(possible.keys()), "Add an Enchant", (c) => {
    const chosenEnchant = possible.get(c);
    if (!chosenEnchant) {
      player.sendMessage("Something went wrong with chosenEnchant.");
      return;
    }
    const cost = ENCHANTS_TO_CHECK.get(chosenEnchant);
    if (!cost) {
      player.sendMessage("Something went wrong with cost.");
      return;
    }
    let totalDiamonds = 0;
    let diamondSlots: number[] = [];
    if (inventory && inventory.container) {
      for (let i = 0; i < inventory.container.size; i++) {
        const diamondCheck = inventory.container.getItem(i);
        if (diamondCheck?.type.id != MinecraftItemTypes.Diamond) continue;
        diamondSlots.push(i);
        totalDiamonds += diamondCheck.amount;
        if (totalDiamonds >= cost) {
          break;
        }
      }
    }
    if (totalDiamonds < cost) {
      player.sendMessage("You need " + (cost - totalDiamonds) + " more diamonds.");
      return;
    }
    system.runTimeout(() => {
      let toPay = cost;
      for (let i of diamondSlots) {
        const diamonds = inventory.container.getItem(i);
        if (!diamonds) continue;
        if (diamonds.amount <= toPay) {
          inventory.container.setItem(i);
        } else {
          const clone = diamonds.clone();
          if (!clone) continue;
          let pay = Math.min(toPay, diamonds.amount);
          toPay -= pay;
          clone.amount -= pay;
          inventory.container.setItem(i, clone);
        }
        if (toPay <= 0) break;
      }
      if (toPay > 0) {
        player.sendMessage("WTF?");
      }
      enchantSelectedItem(player, chosenEnchant);
    });
  });
}

function enchantSelectedItem(player: Player, enchant: Enchantment) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
  const newItem = inventory.container.getItem(player.selectedSlotIndex)?.clone();
  if (newItem === undefined) {
    player.sendMessage("Something weird happened. Try again.");
    return;
  }
  newItem?.getComponent(ItemComponentTypes.Enchantable)?.addEnchantment(enchant);
  inventory.container.setItem(player.selectedSlotIndex, newItem);
}
