// Scene units match the art: the hall is drawn on a 680 x 480 canvas. Positions of characters and
// spots are their feet (ground contact); a sprite's depth is the y of its ground contact, so sorting
// by depth draws whatever stands lower on screen in front.

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type FurnitureAsset =
    | 'worker-desk'
    | 'stool'
    | 'armchair'
    | 'side-table'
    | 'master-desk'
    | 'bookshelf-upper'
    | 'bookshelf-lower'
    | 'lectern'
    | 'map-table'
    | 'appraiser-counter'
    | 'war-table';

export type CharacterAsset =
    | 'ranger'
    | 'warrior'
    | 'mage'
    | 'bard'
    | 'rogue'
    | 'dwarf'
    | 'scout'
    | 'appraiser'
    | 'master';

export interface FurniturePlacement {
    asset: FurnitureAsset;
    /** Top-left of the sprite in scene units. */
    position: Point;
    depth: number;
    /** Floor area the piece occupies, or null when characters may stand on it (stools). */
    footprint: Rect | null;
}

export interface Spot {
    id: string;
    position: Point;
}

export interface CharacterPlacement {
    id: string;
    asset: CharacterAsset;
    startSpotId: string;
    scale: number;
}

export const WORLD_SIZE = { width: 680, height: 480 } as const;

/** Where feet may go: inside the walls, below the back wall. */
export const WALKABLE_AREA: Rect = { x: 24, y: 112, width: 632, height: 346 };

/** Extra room kept between a character's feet and a furniture footprint. */
export const CHARACTER_CLEARANCE: Point = { x: 8, y: 4 };

const WORKER_DESK_ORIGINS: readonly Point[] = [
    { x: 300, y: 222 },
    { x: 375, y: 222 },
    { x: 450, y: 222 },
    { x: 300, y: 300 },
    { x: 375, y: 300 },
    { x: 450, y: 300 },
];

const WAR_TABLE_STOOLS: readonly Point[] = [
    { x: 526, y: 392 },
    { x: 634, y: 392 },
    { x: 580, y: 352 },
    { x: 580, y: 438 },
];

export const FURNITURE: readonly FurniturePlacement[] = [
    ...WORKER_DESK_ORIGINS.map((origin) => ({
        asset: 'worker-desk' as const,
        position: { x: origin.x - 2, y: origin.y },
        depth: origin.y + 38,
        footprint: { x: origin.x, y: origin.y + 26, width: 64, height: 14 },
    })),
    ...WAR_TABLE_STOOLS.map((stool) => ({
        asset: 'stool' as const,
        position: { x: stool.x - 10, y: stool.y - 6 },
        depth: stool.y + 3,
        footprint: null,
    })),
    { asset: 'armchair', position: { x: 126, y: 126 }, depth: 140, footprint: { x: 128, y: 128, width: 36, height: 10 } },
    { asset: 'armchair', position: { x: 234, y: 126 }, depth: 140, footprint: { x: 236, y: 128, width: 36, height: 10 } },
    { asset: 'side-table', position: { x: 188, y: 135 }, depth: 152, footprint: { x: 190, y: 146, width: 20, height: 10 } },
    { asset: 'master-desk', position: { x: 536, y: 154 }, depth: 194, footprint: { x: 538, y: 176, width: 102, height: 20 } },
    { asset: 'bookshelf-upper', position: { x: 34, y: 204 }, depth: 250, footprint: { x: 36, y: 232, width: 108, height: 20 } },
    { asset: 'bookshelf-lower', position: { x: 34, y: 266 }, depth: 312, footprint: { x: 36, y: 294, width: 108, height: 20 } },
    { asset: 'lectern', position: { x: 184, y: 232 }, depth: 304, footprint: { x: 200, y: 292, width: 28, height: 14 } },
    { asset: 'map-table', position: { x: 22, y: 346 }, depth: 418, footprint: { x: 26, y: 394, width: 168, height: 26 } },
    { asset: 'appraiser-counter', position: { x: 538, y: 268 }, depth: 316, footprint: { x: 540, y: 294, width: 124, height: 22 } },
    { asset: 'war-table', position: { x: 516, y: 370 }, depth: 422, footprint: { x: 528, y: 392, width: 104, height: 32 } },
];

export const SPOTS: readonly Spot[] = [
    // Seats behind the worker desks: feet just behind the desk, so the desk hides the lower body.
    ...WORKER_DESK_ORIGINS.map((origin, index) => ({
        id: `desk-${index + 1}`,
        position: { x: origin.x + 32, y: origin.y + 25 },
    })),
    ...WAR_TABLE_STOOLS.map((stool, index) => ({
        id: `war-table-${index + 1}`,
        position: { x: stool.x, y: stool.y + 6 },
    })),
    { id: 'armchair-left', position: { x: 146, y: 158 } },
    { id: 'armchair-right', position: { x: 254, y: 158 } },
    { id: 'guild-master', position: { x: 589, y: 163 } },
    { id: 'map-room', position: { x: 110, y: 357 } },
    { id: 'counter', position: { x: 604, y: 283 } },
    { id: 'archive-upper', position: { x: 90, y: 262 } },
    { id: 'archive-lower', position: { x: 90, y: 326 } },
    { id: 'quest-board', position: { x: 392, y: 128 } },
    { id: 'hearth', position: { x: 200, y: 182 } },
    { id: 'entrance', position: { x: 340, y: 450 } },
    { id: 'floor-1', position: { x: 300, y: 178 } },
    { id: 'floor-2', position: { x: 470, y: 140 } },
    { id: 'floor-3', position: { x: 500, y: 240 } },
    { id: 'floor-4', position: { x: 640, y: 245 } },
    { id: 'floor-5', position: { x: 250, y: 380 } },
    { id: 'floor-6', position: { x: 420, y: 410 } },
    { id: 'floor-7', position: { x: 460, y: 445 } },
    { id: 'floor-8', position: { x: 160, y: 205 } },
];

export const CHARACTERS: readonly CharacterPlacement[] = [
    { id: 'ranger', asset: 'ranger', startSpotId: 'desk-1', scale: 1 },
    { id: 'warrior', asset: 'warrior', startSpotId: 'desk-2', scale: 1 },
    { id: 'mage', asset: 'mage', startSpotId: 'desk-3', scale: 1 },
    { id: 'bard', asset: 'bard', startSpotId: 'desk-4', scale: 1 },
    { id: 'rogue', asset: 'rogue', startSpotId: 'desk-5', scale: 1 },
    { id: 'dwarf', asset: 'dwarf', startSpotId: 'armchair-left', scale: 1 },
    { id: 'scout', asset: 'scout', startSpotId: 'map-room', scale: 1 },
    { id: 'appraiser', asset: 'appraiser', startSpotId: 'counter', scale: 1 },
    { id: 'guild-master', asset: 'master', startSpotId: 'guild-master', scale: 1.1 },
];
