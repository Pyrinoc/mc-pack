import {
  system,
  StartupEvent,
  world,
  EntityComponentTypes,
  EntityInventoryComponent,
  ItemComponentTypes,
  Player,
  ItemStack,
  EntityEquippableComponent,
  EquipmentSlot,
  Vector3,
} from "@minecraft/server";
import TPCommand, { showTPForm } from "./TPCommand.js";
import MazeCmd, { showMazeForm } from "./MazeGen.js";
import { ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import { fillV3 } from "./utilities.js";
import { MinecraftBlockTypes, MinecraftItemTypes } from "@minecraft/vanilla-data";
import { presentClicked } from "./christmas/christmas.js";

const SECOND = 20;
const EQUIP_SLOTS = [EquipmentSlot.Chest, EquipmentSlot.Feet, EquipmentSlot.Head, EquipmentSlot.Legs];
const REPAIRABLE = new Set<string>([
  MinecraftItemTypes.DiamondAxe,
  MinecraftItemTypes.DiamondPickaxe,
  MinecraftItemTypes.DiamondShovel,
  MinecraftItemTypes.DiamondHoe,
  MinecraftItemTypes.DiamondSword,
  MinecraftItemTypes.NetheriteAxe,
  MinecraftItemTypes.NetheritePickaxe,
  MinecraftItemTypes.NetheriteShovel,
  MinecraftItemTypes.NetheriteHoe,
  MinecraftItemTypes.NetheriteSword,
  MinecraftItemTypes.DiamondHelmet,
  MinecraftItemTypes.DiamondChestplate,
  MinecraftItemTypes.DiamondLeggings,
  MinecraftItemTypes.DiamondBoots,
  MinecraftItemTypes.NetheriteHelmet,
  MinecraftItemTypes.NetheriteChestplate,
  MinecraftItemTypes.NetheriteLeggings,
  MinecraftItemTypes.NetheriteBoots,
]);

function mainTick() {
  if (system.currentTick % (15 * SECOND) === 0) {
    for (const player of world.getAllPlayers()) {
      repairPlayerInventory(player);
    }
  }
  system.run(mainTick);
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId === "kubi:present") {
    presentClicked(e.player, e.target);
  }
});

system.beforeEvents.startup.subscribe((init: StartupEvent) => {
  TPCommand.setup(init);
  MazeCmd.setup(init);
});

system.run(mainTick);

system.beforeEvents.startup.subscribe((data) => {
  data.itemComponentRegistry.registerCustomComponent("kubi:teleport_function", {
    onUse: (data) => showTPForm(data.source, data.itemStack),
  });
  data.blockComponentRegistry.registerCustomComponent("kubi:maze_creation_function", {
    onPlayerInteract: (data) => showMazeForm(data.player, data.block.location),
  });
  data.blockComponentRegistry.registerCustomComponent("kubi:block_filler_function", {
    onPlayerInteract: (data) => showAirFillForm(data.player, data.block.location),
  });
});

function showAirFillForm(player: Player | undefined, location: Vector3) {
  if (player === undefined) return;
  const blockChoices = [
    MinecraftBlockTypes.Air,
    MinecraftBlockTypes.Dirt,
    MinecraftBlockTypes.Stone,
    MinecraftBlockTypes.Sand,
    MinecraftBlockTypes.Water,
  ];
  const form = new ModalFormData()
    .title(`Block Filler`)
    .dropdown("Block", blockChoices)
    .slider("X Size", -128, 128, { defaultValue: 5 })
    .slider("Y Size", -128, 128, { defaultValue: 5 })
    .slider("Z Size", -128, 128, { defaultValue: 5 });

  form.show(player).then((result: ModalFormResponse) => {
    if (result.canceled || result.formValues === undefined) return;
    let [blockChoice, x, y, z] = result.formValues;
    fillV3(
      blockChoices[blockChoice as number],
      location,
      { x: location.x + (x as number), y: location.y + (y as number), z: location.z + (z as number) },
      player
    );
  });
}

function repairPlayerInventory(player: Player) {
  const equipmentCompPlayer = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent;
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

  if (inventory && inventory.container) {
    for (let i = 0; i < inventory.container.size; i++) {
      const newItem = createNewUndamagedItem(inventory.container.getItem(i));
      if (newItem !== undefined) {
        inventory.container.setItem(i, newItem);
      }
    }
  }
  if (equipmentCompPlayer) {
    for (let slot of EQUIP_SLOTS) {
      const newItem = createNewUndamagedItem(equipmentCompPlayer.getEquipment(slot));
      if (newItem !== undefined) {
        equipmentCompPlayer.setEquipment(slot, newItem);
      }
    }
  }
}

function createNewUndamagedItem(item: ItemStack | undefined): ItemStack | undefined {
  const itemDurability = item?.getComponent(ItemComponentTypes.Durability);
  if (
    item === undefined ||
    itemDurability === undefined ||
    itemDurability.damage < 0.25 * itemDurability.maxDurability ||
    !REPAIRABLE.has(item.type.id)
  ) {
    return undefined;
  }
  const newItem = item.clone();
  const newDurability = newItem.getComponent(ItemComponentTypes.Durability);
  if (newDurability !== undefined) newDurability.damage = 0;
  return newItem;
}
