import { Entity, Player, system, world } from "@minecraft/server";

export function presentClicked(player: Player, entity: Entity) {
  const loot = world.getLootTableManager().generateLootFromEntity(entity);

  if (loot !== undefined) {
    const dimension = entity.dimension;
    const location = { x: entity.location.x, y: entity.location.y + 0.3, z: entity.location.z };

    system.runTimeout(() => {
      for (let i of loot) {
        dimension.spawnItem(i, location);
      }
    }, 30);
  }
}
