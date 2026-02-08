import {
  system,
  world,
  CustomCommand,
  CommandPermissionLevel,
  CustomCommandParamType,
  StartupEvent,
  CustomCommandResult,
  Player,
  Vector3,
  CustomCommandOrigin,
  ItemStack,
  GameMode,
} from "@minecraft/server";
import { removeSelectedSlotItemStack, statusError, success, v3Distance, vStr } from "./utilities";
import { ActionFormData, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";

const TP_COUNT_STRING: string = "kubi:tpCount";
const TP_DELETED_STRING: string = "kubi:deleted";

/**
 * Set up the /command calls.
 */
export default class TPCommand {
  static setup(init: StartupEvent) {
    const tpSetCommand: CustomCommand = {
      name: "kubi:tpset",
      description: "Set a teleport location -- By Kubi",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "id" }],
      optionalParameters: [{ type: CustomCommandParamType.Location, name: "loc" }],
    };
    init.customCommandRegistry.registerCommand(tpSetCommand, setTeleportCmd);

    const tpShowCommand: CustomCommand = {
      name: "kubi:tpshow",
      description: "Show all teleport locations -- By Kubi",
      permissionLevel: CommandPermissionLevel.Any,
    };
    init.customCommandRegistry.registerCommand(tpShowCommand, showTeleportCmd);

    const tpGoCommand: CustomCommand = {
      name: "kubi:tpgo",
      description: "Go to a teleport location -- By Kubi",
      permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [
        { type: CustomCommandParamType.PlayerSelector, name: "player" },
        { type: CustomCommandParamType.String, name: "id" },
      ],
    };
    init.customCommandRegistry.registerCommand(tpGoCommand, goTeleportCmd);
  }
}

function tpDataStrings(i: number): [string, string] {
  return [`kubi:tpName-${i}`, `kubi:tpLocation-${i}`];
}

function getTpCount(): number {
  if (world.getDynamicProperty(TP_COUNT_STRING) === undefined) {
    world.setDynamicProperty(TP_COUNT_STRING, 0);
  }
  return world.getDynamicProperty(TP_COUNT_STRING) as number;
}

function setTeleport(player: Player, id: string, loc: Vector3) {
  const tpCount = getTpCount();

  for (let i = 0; i < tpCount; i++) {
    const [nameStr, locStr] = tpDataStrings(i);

    let tpName: string = world.getDynamicProperty(nameStr) as string;
    if (tpName === TP_DELETED_STRING) {
      world.setDynamicProperty(nameStr, id);
      world.setDynamicProperty(locStr, loc);
      return;
    } else if (tpName === id) {
      world.setDynamicProperty(locStr, loc);
      player.sendMessage(`TP Location ${id} changed to ${vStr(loc)}.`);
    }
  }

  const [nameStr, locStr] = tpDataStrings(tpCount);
  world.setDynamicProperty(TP_COUNT_STRING, tpCount + 1);
  world.setDynamicProperty(nameStr, id);
  world.setDynamicProperty(locStr, loc);
}

// Teleports the player to the location at `id`. Returns false if the location does not exist.
function goTeleport(players: Player[], id: string, spawnParticle: boolean): boolean {
  let loc = getTPLocation(id);
  let teleported = false;

  if (loc === undefined) {
    return teleported;
  }
  players.forEach((p) => (teleported = movePlayer(p, loc, spawnParticle) || teleported));
  return teleported;
}

function movePlayer(p: Player, location: Vector3, spawnParticle: boolean): boolean {
  const previousLocation = p.location;
  if (v3Distance(previousLocation, location) <= 3) {
    return false;
  }
  if (spawnParticle) {
    p.dimension.spawnParticle("kubi:teleport_disappear", previousLocation);
  }
  p.teleport(location);
  system.run(() => {
    if (spawnParticle) {
      p.dimension.spawnParticle("kubi:teleport_appear", location);
    }
  });
  return true;
}

function getTPLocation(id: string): Vector3 | undefined {
  for (let i = 0; i < getTpCount(); i++) {
    const [nameStr, locStr] = tpDataStrings(i);

    let name = world.getDynamicProperty(nameStr) as string;
    if (name === TP_DELETED_STRING) continue;
    if (name === id) {
      return world.getDynamicProperty(locStr) as Vector3;
    }
  }
  return undefined;
}

function getTPLocations(): Map<string, Vector3> {
  let locs = new Map<string, Vector3>();

  for (let i = 0; i < getTpCount(); i++) {
    const [nameStr, locStr] = tpDataStrings(i);

    let tpName: string = world.getDynamicProperty(nameStr) as string;
    if (tpName === TP_DELETED_STRING) continue;
    locs.set(tpName, world.getDynamicProperty(locStr) as Vector3);
  }
  return locs;
}

/**
 * The code for the forms.
/*/
export function showTPForm(player: Player, item?: ItemStack) {
  const choices: string[] = [];
  const choiceFunctions: Map<string, () => void> = new Map();

  let z = (name: string, fn: () => void) => {
    choices.push(name);
    choiceFunctions.set(name, fn);
  };
  if (player.playerPermissionLevel > 1) {
    z("Set", () => showTPSetForm(player));
    z("Delete", () => showTPDeleteForm(player));
    for (const otherPlayer of world.getAllPlayers()) {
      if (otherPlayer !== player) {
        z("Summon", () => showTPSummonForm(player));
        break;
      }
    }
  }
  getTPLocations().forEach((v, k) => {
    z(`${k} ${vStr(v)}`, () => {
      let used = goTeleport([player], k, true);
      if (used && item && player.getGameMode() == GameMode.Survival) {
        player.selectedSlotIndex;
        // removeItemStack(player, item)
        removeSelectedSlotItemStack(player);
      }
    });
  });

  runActionForm(player, choices, "Teleport Selection", (choice) => {
    let fn = choiceFunctions.get(choice);
    if (fn !== undefined) fn();
  });
}

function showTPSetForm(player: Player) {
  const form = new ModalFormData().title(`Set teleportion to ${vStr(player.location)}`).textField("Location Name", "");

  form.show(player).then((result: ModalFormResponse) => {
    if (result.canceled || result.formValues === undefined) return;
    setTeleport(player, result.formValues[0] as string, player.location);
  });
}

function showTPDeleteForm(player: Player) {
  runActionForm(player, [...getTPLocations().keys()], "Delete Location", (deleteName) => {
    for (let i = 0; i < getTpCount(); i++) {
      let nameStr = tpDataStrings(i)[0];
      let tpName: string = world.getDynamicProperty(nameStr) as string;
      if (tpName === deleteName) {
        world.setDynamicProperty(nameStr, TP_DELETED_STRING);
      }
    }
  });
}

function showTPSummonForm(player: Player) {
  let choices: string[] = [];
  let playerMap: Map<string, Player> = new Map();

  for (let otherPlayer of world.getAllPlayers()) {
    choices.push(otherPlayer.name);
    playerMap.set(otherPlayer.name, otherPlayer);
  }

  runActionForm(player, choices, "Summon Player", (summonName) => {
    const summonPlayer = playerMap.get(summonName);
    if (summonPlayer) {
      movePlayer(summonPlayer, player.location, true);
    }
  });
}

export function runActionForm(player: Player, choices: string[], title: string, fn: (choice: string) => void) {
  const form = new ActionFormData().title(title);

  for (let choice of choices) {
    form.button(choice);
  }
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    fn(choices[r.selection]);
  });
}

/**
 * The code for the commands.
 */
function setTeleportCmd(origin: CustomCommandOrigin, id: string, loc?: Vector3): CustomCommandResult {
  let source = origin.initiator ?? origin.sourceEntity;
  if (!(source instanceof Player)) {
    return statusError("This command can only be executed by players.");
  }
  setTeleport(source, id, loc ?? source.location);
  return success();
}

function goTeleportCmd(origin: CustomCommandOrigin, players: Player[], id: string): CustomCommandResult {
  if (getTPLocation(id) === undefined) {
    return statusError(`Unknown TP Location: ${id}.`);
  }
  system.run(() => goTeleport(players, id, false));
  return success();
}

function showTeleportCmd(origin: CustomCommandOrigin): CustomCommandResult {
  let source = origin.initiator ?? origin.sourceEntity;
  if (!(source instanceof Player)) {
    return statusError("This command can only be executed by players.");
  }

  source.sendMessage(`Found ${getTpCount()} locations:`);
  getTPLocations().forEach((v, k) => {
    source.sendMessage(`- ${k}: ${vStr(v)}.`);
  });
  return success();
}
