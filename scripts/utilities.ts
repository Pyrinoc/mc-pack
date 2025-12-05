import {
  world,
  BlockPermutation,
  CustomCommandResult,
  CustomCommandStatus,
  Vector3,
  Player,
  BlockVolume,
  ItemStack,
  EntityComponentTypes,
  EntityInventoryComponent,
  VectorXZ,
} from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftDimensionTypes } from "@minecraft/vanilla-data";

export function statusError(message: string): CustomCommandResult {
  return { status: CustomCommandStatus.Failure, message: message };
}

export function success(): CustomCommandResult {
  return { status: CustomCommandStatus.Success };
}

export function r(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function rl<T>(list: T[]): T {
  return list[r(0, list.length - 1)];
}

export function vStr(v: VectorXZ | Vector3): string {
  // let yStr =
  // let yStr = ""
  // if ('y' in v) {
  //   yStr = `${v.y},`
  // }
  return `[${Math.floor(v.x)},${"y" in v ? `${v.y},` : ""}${Math.floor(v.z)}]`;
  // return "[?,?,?]";
}

export function fillV3(block: MinecraftBlockTypes | BlockPermutation, from: Vector3, to: Vector3, p?: Player) {
  fillVolume(block, new BlockVolume(from, to), p);
}

export function fillVolume(block: MinecraftBlockTypes | BlockPermutation, volume: BlockVolume, p?: Player) {
  const overworld = world.getDimension(MinecraftDimensionTypes.Overworld);
  if (block instanceof BlockPermutation) {
  }
  let blockPerm: BlockPermutation = block instanceof BlockPermutation ? block : BlockPermutation.resolve(block);
  p?.sendMessage(`Filling ${vStr(volume.from)}->${vStr(volume.to)}`);
  for (let v of volume.getBlockLocationIterator()) {
    overworld.getBlock(v)?.setPermutation(blockPerm);
  }
}

export function removeSelectedSlotItemStack(player: Player) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

  if (!inventory || !inventory.container) {
    return;
  }
  let item = inventory.container.getItem(player.selectedSlotIndex);
  if (item === undefined) {
    return;
  }
  // item.amount--
  // player.sendMessage("Trying new item stack decrementing.")
  if (item.amount == 1) {
    inventory.container.setItem(player.selectedSlotIndex);
    return;
  }
  inventory.container.setItem(player.selectedSlotIndex, new ItemStack(item.type, item.amount - 1));
}

export function v3Distance(l1: Vector3, l2: Vector3): number {
  return Math.sqrt(Math.pow(l1.x - l2.x, 2) + Math.pow(l1.x - l2.x, 2) + Math.pow(l1.x - l2.x, 2));
}
