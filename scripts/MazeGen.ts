import {
  system,
  CustomCommand,
  CommandPermissionLevel,
  CustomCommandParamType,
  StartupEvent,
  CustomCommandResult,
  Player,
  Vector3,
  CustomCommandOrigin,
  Entity,
  VectorXZ,
  BlockPermutation,
} from "@minecraft/server";
import { fillV3, r, statusError, success } from "./utilities";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { getThemeGenerators, getThemes, ThemeGenerators } from "./themes";
import { ModalFormData, ModalFormResponse } from "@minecraft/server-ui";

export default class MazeCmd {
  static setup(init: StartupEvent) {
    const mazeCommand: CustomCommand = {
      name: "kubi:maze",
      description: "Try creating a maze. -- By Kubi",
      permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [
        { type: CustomCommandParamType.Location, name: "start" },
        { type: CustomCommandParamType.Integer, name: "sizeX" },
        { type: CustomCommandParamType.Integer, name: "sizeZ" },
      ],
      optionalParameters: [
        { type: CustomCommandParamType.Integer, name: "wallHeight" },
        { type: CustomCommandParamType.Integer, name: "pathWidth" },
        { type: CustomCommandParamType.String, name: "theme" },
        { type: CustomCommandParamType.Integer, name: "floors" },
      ],
    };
    init.customCommandRegistry.registerCommand(mazeCommand, MazeGen.generate);
  }
}

export function showMazeForm(player: Player | undefined, location: Vector3) {
  if (player === undefined) return;
  let themes = getThemes();
  themes.unshift("random");

  const form = new ModalFormData()
    .title(`Maze Options`)
    .slider("X Size", 2, 12, { defaultValue: 3 })
    .slider("Z Size", 2, 12, { defaultValue: 3 })
    .slider("Wall Height", 1, 5, { defaultValue: 3 })
    .slider("Path Width", 1, 4, { defaultValue: 2 })
    .dropdown("Theme", themes)
    .slider("Floors", 1, 10, { defaultValue: 1 });

  form.show(player).then((result: ModalFormResponse) => {
    if (result.canceled || result.formValues === undefined) return;
    let [sizeX, sizeZ, wallheight, pathWidth, theme, floors] = result.formValues;
    return new MazeGen(
      player,
      location,
      sizeX as number,
      sizeZ as number,
      wallheight as number,
      pathWidth as number,
      themes[theme as number],
      floors as number
    ).startMaze();
  });
}

class Cell {
  wall: boolean;
  visited: boolean;
  pos2d: VectorXZ;
  pos3d: Vector3;

  constructor(x: number, y: number, z: number) {
    this.wall = false;
    this.visited = false;
    this.pos2d = { x, z };
    this.pos3d = { x, y, z };
  }
}

enum MazeDrawingPhases {
  FILL_ALL,
  DRILLING,
  LADDERS,
}

class MazeGen {
  source: Entity;
  p: Player;
  start: Vector3;
  size: Vector3;
  wallHeight: number;
  pathWidth: number;
  floorThemes: ThemeGenerators[];
  maze: Cell[][][]; // This is a maze of size (2*sizeX-1, 2*sizeZ-1).
  phases: MazeDrawingPhases;

  static generate(
    origin: CustomCommandOrigin,
    start: Vector3,
    sizeX: number,
    sizeZ: number,
    wallHeight?: number,
    pathWidth?: number,
    theme?: string
  ): CustomCommandResult {
    return new MazeGen(
      origin.initiator ?? (origin.sourceEntity as Entity),
      start,
      sizeX,
      sizeZ,
      wallHeight,
      pathWidth,
      theme
    ).startMaze();
  }

  constructor(
    source: Entity,
    start: Vector3,
    sizeX: number,
    sizeZ: number,
    wallHeight?: number,
    pathWidth?: number,
    theme?: string,
    floors?: number
  ) {
    this.source = source;
    this.p = this.source as Player;
    this.start = start;
    this.wallHeight = wallHeight ?? 3;
    this.pathWidth = pathWidth ?? 1;
    this.size = { x: 2 * sizeX + 1, y: floors ?? 1, z: 2 * sizeZ + 1 };
    this.floorThemes = [];
    this.maze = [];
    this.phases = MazeDrawingPhases.FILL_ALL;

    for (let x = 0; x < this.size.x; x++) {
      this.maze.push([]);
      for (let y = 0; y < this.size.y; y++) {
        if (this.floorThemes.length === y) {
          this.floorThemes.push(getThemeGenerators(theme));
        }
        this.maze[x].push([]);
        for (let z = 0; z < this.size.z; z++) {
          this.maze[x][y].push(new Cell(x, y, z));
          if (x == 0 || z == 0 || x == this.size.x - 1 || z == this.size.z) {
            this.maze[x][y][z].wall = true;
          }
        }
      }
    }
  }

  startMaze(): CustomCommandResult {
    if (!(this.source instanceof Player)) {
      return statusError("This command can only be executed by players.");
    }

    let entryPoint = this.maze[1][0][1].pos2d;
    system.run(() => {
      for (let x = 0; x < this.size.x; x++) {
        for (let y = 0; y < this.size.y; y++) {
          for (let z = 0; z < this.size.z; z++) {
            this.fillPosition(this.maze[x][y][z].pos2d, y);
          }
        }
      }
      this.fillPosition({ x: 0, z: 1 }, 0, true);
      this.phases = MazeDrawingPhases.DRILLING;
    });

    for (let y = 0; y < this.size.y; y++) {
      this.buildMaze(y);
    }
    this.connectFloors(entryPoint);

    return success();
  }

  connectFloors(entryPoint: VectorXZ) {
    for (let y = 0; y < this.size.y - 1; y++) {
      let furthestPoint = this.findFurthestPoint(y, entryPoint);
      this.drillFloor(furthestPoint.slice(-1)[0], y + 1);
      this.fillLadder(furthestPoint, y);
      entryPoint = furthestPoint.slice(-1)[0];
    }
  }

  // Fill a single position in the maze.
  fillLadder(endingPath: VectorXZ[], y: number) {
    const pos = endingPath[1];
    const facing_directions: Map<VectorXZ, number> = new Map([
      [{ x: 0, z: 1 }, 2],
      [{ x: 0, z: -1 }, 3],
      [{ x: 1, z: 0 }, 4],
      [{ x: -1, z: 0 }, 5],
    ]);
    let min = {
      x: this.start.x + this.pathWidth * pos.x,
      y: this.start.y + 1 + y * (this.wallHeight + 1),
      z: this.start.z + this.pathWidth * pos.z,
    };
    let max = {
      x: min.x + this.pathWidth - 1,
      y: y * (this.wallHeight + 1) + this.start.y + this.wallHeight,
      z: min.z + this.pathWidth - 1,
    };
    const endDirection: VectorXZ = {
      x: (endingPath[1].x - endingPath[0].x) / 2,
      z: (endingPath[1].z - endingPath[0].z) / 2,
    };

    let endPoints: Vector3[] = [
      { x: endDirection.x === 1 ? max.x : min.x, y: min.y, z: endDirection.z === 1 ? max.z : min.z },
    ];
    endPoints.push({
      x: endDirection.x === 0 ? max.x : endPoints[0].x,
      y: min.y,
      z: endDirection.z === 0 ? max.z : endPoints[0].z,
    });

    facing_directions.forEach((v, k) => {
      if (k.x !== endDirection.x || k.z !== endDirection.z) {
        return;
      }
      system.runTimeout(() => {
        fillV3(BlockPermutation.resolve(MinecraftBlockTypes.Ladder, { facing_direction: v }), endPoints[0], {
          x: endPoints[1].x,
          y: endPoints[1].y + this.wallHeight,
          z: endPoints[1].z,
        });
      }, 100);
    });
    if (this.pathWidth === 1) return;
    let otherPoints: Vector3[] = [
      { x: endDirection.x === 1 ? min.x : max.x, y: min.y, z: endDirection.z === 1 ? min.z : max.z },
      { x: endDirection.x === 1 ? min.x : max.x, y: min.y, z: endDirection.z === 1 ? min.z : max.z },
    ];
    if (endDirection.z !== 0) otherPoints[1].x = endDirection.x === 1 ? max.x : min.x;
    if (endDirection.x !== 0) otherPoints[1].z = endDirection.z === 1 ? max.z : min.z;
    for (let point of otherPoints) {
      let pointDirection: VectorXZ;
      if (endDirection.z !== 0) {
        if (point.x == min.x) pointDirection = { x: -1, z: 0 };
        else pointDirection = { x: 1, z: 0 };
      } else {
        if (point.z == min.z) pointDirection = { x: 0, z: -1 };
        else pointDirection = { x: 0, z: 1 };
      }
      facing_directions.forEach((v, k) => {
        if (k.x !== pointDirection.x || k.z !== pointDirection.z) {
          return;
        }
        system.runTimeout(() => {
          fillV3(BlockPermutation.resolve(MinecraftBlockTypes.Ladder, { facing_direction: v }), point, {
            x: point.x,
            y: point.y + this.wallHeight,
            z: point.z,
          });
        }, 100);
      });
    }
  }

  buildMaze(y: number) {
    let unvisited: Set<VectorXZ> = new Set();
    let drillPath: VectorXZ[] = [];

    for (let x = 1; x < this.size.x - 1; x += 2) {
      for (let z = 1; z < this.size.z - 1; z += 2) {
        unvisited.add(this.maze[x][y][z].pos2d);
      }
    }

    // Pick a random cell in the maze and `visit` it to start the maze.
    let starter = this.randomUnvisitedCell(y, unvisited);
    starter.visited = true;
    unvisited.delete(starter.pos2d);
    drillPath.push(starter.pos2d);

    while (unvisited.size > 0) {
      this.addPath(y, unvisited, drillPath); // Add paths until all cells have been visited.
    }
    this.executeDrillPath(y, drillPath);
  }

  findFurthestPoint(y: number, start: VectorXZ): VectorXZ[] {
    let paths: VectorXZ[][] = [[start]];
    let finished: VectorXZ[][] = [];

    while (paths.length > 0) {
      let nextPath = paths.shift() as VectorXZ[];
      let pos = nextPath.slice(-1)[0];
      let nextPositions = [ax(pos, -2), ax(pos, 2), az(pos, -2), az(pos, 2)];
      let endOfPath = true;

      for (let nextPos of nextPositions) {
        if (!this.maze[(nextPos.x + pos.x) / 2][y][(nextPos.z + pos.z) / 2].visited) continue;
        let foundInPath = false;
        for (let pathPos of nextPath) {
          if (nextPos.x === pathPos.x && nextPos.z === pathPos.z) {
            foundInPath = true;
            break;
          }
        }
        if (!foundInPath) {
          paths.push([...nextPath, nextPos]);
          endOfPath = false;
        }
      }
      if (endOfPath) {
        finished.push(nextPath);
      }
    }

    finished.sort((a, b) => a.length - b.length);
    let longest = 0;
    for (let i = 1; i < finished.length; i++) {
      if (finished[i].length > finished[longest].length) {
        longest = i;
      }
    }
    return finished[longest].slice(-2);
  }

  // Run through the drill path, drilling a single position at a time.
  executeDrillPath(y: number, drillPath: VectorXZ[]) {
    if (this.phases !== MazeDrawingPhases.DRILLING) {
      system.run(() => this.executeDrillPath(y, drillPath));
      return;
    }
    if (drillPath.length == 0) {
      return;
    }
    let pos = drillPath.shift();
    if (pos === undefined) {
      return;
    }
    this.fillPosition(pos, y, true);
    system.run(() => this.executeDrillPath(y, drillPath));
  }

  // Fill a single position in the maze.
  fillPosition(pos: VectorXZ, y: number, air?: boolean) {
    let from = {
      x: this.start.x + this.pathWidth * pos.x,
      y: this.start.y + 1 + y * (this.wallHeight + 1),
      z: this.start.z + this.pathWidth * pos.z,
    };
    let to = {
      x: from.x + this.pathWidth - 1,
      y: y * (this.wallHeight + 1) + this.start.y + this.wallHeight,
      z: from.z + this.pathWidth - 1,
    };
    fillV3(air ? MinecraftBlockTypes.Air : this.floorThemes[y].wall(), from, to);
    if (!air) {
      fillV3(this.floorThemes[y].floor(), { x: from.x, y: from.y - 1, z: from.z }, { x: to.x, y: from.y - 1, z: to.z });
    }
  }

  drillFloor(pos: VectorXZ, y: number) {
    let from = {
      x: this.start.x + this.pathWidth * pos.x,
      y: this.start.y + y * (this.wallHeight + 1),
      z: this.start.z + this.pathWidth * pos.z,
    };
    let to = { x: from.x + this.pathWidth - 1, y: from.y, z: from.z + this.pathWidth - 1 };
    system.run(() => fillV3(MinecraftBlockTypes.Air, from, to));
  }

  // Pick a random unvisited spot in the maze and randomly walk until connecting with the main maze.
  addPath(y: number, unvisited: Set<VectorXZ>, drillPath: VectorXZ[]) {
    let path: Cell[] = [this.randomUnvisitedCell(y, unvisited)];
    let visitedCells: Set<Cell> = new Set();
    visitedCells.add(path[0]);

    // Loop until the end of the path is a previously visited cell, meaning it is already part of the maze.
    while (!path.slice(-1)[0].visited) {
      let cell = path.slice(-1)[0];
      let directions: VectorXZ[] = []; // Build a list of valid directions (not out of bounds).
      if (cell.pos2d.x > 1) directions.push(ax(cell.pos2d, -2));
      if (cell.pos2d.z > 1) directions.push(az(cell.pos2d, -2));
      if (cell.pos2d.x < this.size.x - 2) directions.push(ax(cell.pos2d, 2));
      if (cell.pos2d.z < 2 * this.size.z - 2) directions.push(az(cell.pos2d, 2));

      // Pick a random cell from the directions that hasn't already been visited on this path that we're walking.
      let choice: Cell | undefined;
      while (choice === undefined && directions.length > 0) {
        let randomDirection = r(0, directions.length - 1);
        let checkPos = directions[randomDirection];
        choice = this.maze[checkPos.x][y][checkPos.z];
        directions.splice(randomDirection, randomDirection + 1);

        if (visitedCells.has(choice)) {
          choice = undefined;
          continue;
        }
      }
      // If there are no valid directions, walk backwards and try again. Otherwise add the new cell to the path.
      if (choice === undefined) {
        path.splice(-1);
      } else {
        visitedCells.add(choice);
        path.push(choice);
      }
    }

    // Go through the finished path and add it to the drillpath and maze in the order walked.
    for (let i = 0; i < path.length - 1; i++) {
      let cell = path[i];
      let next = path[i + 1];
      let middleCell = this.maze[(cell.pos2d.x + next.pos2d.x) / 2][y][(cell.pos2d.z + next.pos2d.z) / 2];

      cell.visited = true;
      drillPath.push(cell.pos2d);
      unvisited.delete(cell.pos2d);
      middleCell.visited = true;
      drillPath.push(middleCell.pos2d);
    }
  }

  randomUnvisitedCell(y: number, unvisited: Set<VectorXZ>): Cell {
    let pos = [...unvisited][r(0, unvisited.size - 1)];
    return this.maze[pos.x][y][pos.z];
  }
}

function ax(pos: VectorXZ, x: number): VectorXZ {
  return { x: pos.x + x, z: pos.z };
}

function az(pos: VectorXZ, z: number): VectorXZ {
  return { x: pos.x, z: pos.z + z };
}
