import { Container, Graphics, Sprite, type Application, type Texture, type Ticker } from 'pixi.js';

import appraiserSvg from './assets/characters/appraiser.svg?raw';
import bardSvg from './assets/characters/bard.svg?raw';
import dwarfSvg from './assets/characters/dwarf.svg?raw';
import mageSvg from './assets/characters/mage.svg?raw';
import masterSvg from './assets/characters/master.svg?raw';
import rangerSvg from './assets/characters/ranger.svg?raw';
import rogueSvg from './assets/characters/rogue.svg?raw';
import scoutSvg from './assets/characters/scout.svg?raw';
import warriorSvg from './assets/characters/warrior.svg?raw';
import appraiserCounterSvg from './assets/furniture/appraiser-counter.svg?raw';
import armchairSvg from './assets/furniture/armchair.svg?raw';
import bookshelfLowerSvg from './assets/furniture/bookshelf-lower.svg?raw';
import bookshelfUpperSvg from './assets/furniture/bookshelf-upper.svg?raw';
import lecternSvg from './assets/furniture/lectern.svg?raw';
import mapTableSvg from './assets/furniture/map-table.svg?raw';
import masterDeskSvg from './assets/furniture/master-desk.svg?raw';
import sideTableSvg from './assets/furniture/side-table.svg?raw';
import stoolSvg from './assets/furniture/stool.svg?raw';
import warTableSvg from './assets/furniture/war-table.svg?raw';
import workerDeskSvg from './assets/furniture/worker-desk.svg?raw';
import hallBackgroundSvg from './assets/hall-background.svg?raw';
import {
    CHARACTER_CLEARANCE,
    CHARACTERS,
    FURNITURE,
    SPOTS,
    WALKABLE_AREA,
    WORLD_SIZE,
    type CharacterAsset,
    type FurnitureAsset,
} from './guild-hall-layout';
import { createNavigationGrid } from './navigation-grid';
import { svgTextureCache } from './svg-texture-cache';
import { createWanderSimulation, type WanderAgentView } from './wander-behavior';

const FURNITURE_SVG: Record<FurnitureAsset, string> = {
    'worker-desk': workerDeskSvg,
    stool: stoolSvg,
    armchair: armchairSvg,
    'side-table': sideTableSvg,
    'master-desk': masterDeskSvg,
    'bookshelf-upper': bookshelfUpperSvg,
    'bookshelf-lower': bookshelfLowerSvg,
    lectern: lecternSvg,
    'map-table': mapTableSvg,
    'appraiser-counter': appraiserCounterSvg,
    'war-table': warTableSvg,
};

const CHARACTER_SVG: Record<CharacterAsset, string> = {
    ranger: rangerSvg,
    warrior: warriorSvg,
    mage: mageSvg,
    bard: bardSvg,
    rogue: rogueSvg,
    dwarf: dwarfSvg,
    scout: scoutSvg,
    appraiser: appraiserSvg,
    master: masterSvg,
};

/** Art is rasterized at 4 px per scene unit: sharp up to a 4x display scale. */
const TEXTURE_RESOLUTION = 4;

/** Character art spans y -28..32 with the feet at y 28 (see the character SVG viewBox). */
const CHARACTER_FEET_ANCHOR = { x: 0.5, y: 56 / 60 };

const NAVIGATION_CELL_SIZE = 10;
const WALK_SPEED = 42;
const BOB_FREQUENCY = 10;
const BOB_HEIGHT = 1.6;
const SWAY_RADIANS = 0.05;

interface CharacterView {
    agent: WanderAgentView;
    root: Container;
    sprite: Sprite;
    scale: number;
    stepPhase: number;
}

/**
 * Draws the guild hall into `app.stage` and keeps it fitted to the window. Characters wander
 * between spots until real agent state drives them. Returns a cleanup that is safe to call while
 * the art is still loading.
 */
export function mountGuildHallScene(app: Application): () => void {
    const textures = svgTextureCache(TEXTURE_RESOLUTION);
    const world = new Container();
    let tick: ((ticker: Ticker) => void) | null = null;
    let disposed = false;

    const fit = (): void => {
        const scale = Math.min(app.screen.width / WORLD_SIZE.width, app.screen.height / WORLD_SIZE.height);
        world.scale.set(scale);
        world.position.set(
            (app.screen.width - WORLD_SIZE.width * scale) / 2,
            (app.screen.height - WORLD_SIZE.height * scale) / 2,
        );
    };

    const build = async (): Promise<void> => {
        const background = await textures.get(hallBackgroundSvg);
        const furnitureTextures = await Promise.all(FURNITURE.map((piece) => textures.get(FURNITURE_SVG[piece.asset])));
        const characterTextures = await Promise.all(CHARACTERS.map((character) => textures.get(CHARACTER_SVG[character.asset])));
        if (disposed) {
            return;
        }

        world.addChild(new Sprite(background));

        // Furniture and characters share one depth-sorted layer, so a character behind a desk is
        // hidden by it and one walking in front of it is not.
        const layer = new Container({ sortableChildren: true });
        world.addChild(layer);

        FURNITURE.forEach((piece, index) => {
            const sprite = new Sprite(furnitureTextures[index]);
            sprite.position.set(piece.position.x, piece.position.y);
            sprite.zIndex = piece.depth;
            layer.addChild(sprite);
        });

        const grid = createNavigationGrid(
            WORLD_SIZE.width,
            WORLD_SIZE.height,
            NAVIGATION_CELL_SIZE,
            WALKABLE_AREA,
            FURNITURE.flatMap((piece) => (piece.footprint ? [piece.footprint] : [])),
            CHARACTER_CLEARANCE,
        );
        const simulation = createWanderSimulation(
            grid,
            SPOTS,
            CHARACTERS.map((character) => ({ id: character.id, spotId: character.startSpotId })),
            { speed: WALK_SPEED, minIdleSeconds: 2.5, maxIdleSeconds: 7, random: Math.random },
        );

        // Matched by id, so a future agent-state driver may order or filter agents freely.
        const characters = new Map(
            CHARACTERS.map((character, index) => [character.id, { character, texture: characterTextures[index] }]),
        );
        const views: CharacterView[] = simulation.agents.flatMap((agent) => {
            const entry = characters.get(agent.id);
            if (!entry) {
                console.warn(`No character art for agent "${agent.id}".`);
                return [];
            }

            const root = new Container();
            const shadow = new Graphics().ellipse(0, 0, 15, 4).fill({ color: 0x000000, alpha: 0.28 });
            const sprite = new Sprite(entry.texture);
            sprite.anchor.set(CHARACTER_FEET_ANCHOR.x, CHARACTER_FEET_ANCHOR.y);
            root.addChild(shadow, sprite);
            layer.addChild(root);

            return [{ agent, root, sprite, scale: entry.character.scale, stepPhase: Math.random() * Math.PI * 2 }];
        });

        tick = (ticker) => {
            const deltaSeconds = ticker.deltaMS / 1000;
            simulation.update(deltaSeconds);
            for (const view of views) {
                syncCharacter(view, deltaSeconds);
            }
        };
        app.ticker.add(tick);
        fit();
    };

    app.stage.addChild(world);
    app.renderer.on('resize', fit);
    fit();
    build().catch((error: unknown) => {
        // Unmounting while art loads makes pending texture requests reject; that is not a failure.
        if (disposed) {
            return;
        }
        console.error('Guild hall failed to load:', error);
    });

    return () => {
        disposed = true;
        app.renderer.off('resize', fit);
        if (tick) {
            app.ticker.remove(tick);
        }
        world.destroy({ children: true });
        textures.destroy();
    };
}

function syncCharacter(view: CharacterView, deltaSeconds: number): void {
    const { agent, root, sprite, scale } = view;
    root.position.set(agent.position.x, agent.position.y);
    root.zIndex = agent.position.y;

    if (agent.walking) {
        view.stepPhase += deltaSeconds * BOB_FREQUENCY;
        sprite.y = -Math.abs(Math.sin(view.stepPhase)) * BOB_HEIGHT;
        sprite.rotation = Math.sin(view.stepPhase) * SWAY_RADIANS;
    } else {
        sprite.y = 0;
        sprite.rotation = 0;
    }
    sprite.scale.set(agent.facing * scale, scale);
}
