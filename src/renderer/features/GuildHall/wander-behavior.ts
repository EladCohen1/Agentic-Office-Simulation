import type { Point, Spot } from './guild-hall-layout';
import { findPath, type NavigationGrid } from './navigation-grid';

export interface WanderOptions {
    /** Walking speed in scene units per second. */
    speed: number;
    minIdleSeconds: number;
    maxIdleSeconds: number;
    /** Returns a number in [0, 1); injectable for deterministic runs. */
    random: () => number;
}

export interface WanderAgentStart {
    id: string;
    spotId: string;
}

export interface WanderAgentView {
    readonly id: string;
    readonly position: Readonly<Point>;
    readonly walking: boolean;
    /** 1 when facing right, -1 when facing left. */
    readonly facing: 1 | -1;
}

export interface WanderSimulation {
    readonly agents: readonly WanderAgentView[];
    update(deltaSeconds: number): void;
}

interface AgentState {
    id: string;
    position: Point;
    walking: boolean;
    facing: 1 | -1;
    spotId: string;
    path: Point[];
    idleSeconds: number;
}

const ROUTE_ATTEMPTS = 6;
const RETRY_IDLE_SECONDS = 1;

/**
 * Placeholder behavior until agents are driven by real state: every character idles at a spot for a
 * while, then walks to a random spot no one else holds. A spot stays reserved from the moment a
 * character heads for it until it leaves again.
 */
export function createWanderSimulation(
    grid: NavigationGrid,
    spots: readonly Spot[],
    starts: readonly WanderAgentStart[],
    options: WanderOptions,
): WanderSimulation {
    const spotsById = new Map(spots.map((spot) => [spot.id, spot]));
    const reserved = new Set<string>();

    const agents: AgentState[] = starts.map((start) => {
        const spot = spotsById.get(start.spotId);
        if (!spot) {
            throw new Error(`Unknown start spot "${start.spotId}" for "${start.id}".`);
        }

        reserved.add(spot.id);
        return {
            id: start.id,
            position: { ...spot.position },
            walking: false,
            facing: 1,
            spotId: spot.id,
            path: [],
            idleSeconds: randomIdle(options),
        };
    });

    const chooseNextRoute = (agent: AgentState): void => {
        const free = spots.filter((spot) => !reserved.has(spot.id));
        for (let attempt = 0; attempt < ROUTE_ATTEMPTS && free.length > 0; attempt++) {
            const pick = free.splice(Math.floor(options.random() * free.length), 1)[0];
            if (!pick) {
                break;
            }

            const path = findPath(grid, agent.position, pick.position);
            if (!path) {
                continue;
            }

            reserved.delete(agent.spotId);
            reserved.add(pick.id);
            agent.spotId = pick.id;
            agent.path = path;
            agent.walking = true;
            return;
        }

        agent.idleSeconds = RETRY_IDLE_SECONDS;
    };

    const walk = (agent: AgentState, deltaSeconds: number): void => {
        let budget = options.speed * deltaSeconds;
        while (budget > 0) {
            const target = agent.path[0];
            if (!target) {
                agent.walking = false;
                agent.idleSeconds = randomIdle(options);
                return;
            }

            const dx = target.x - agent.position.x;
            const dy = target.y - agent.position.y;
            const distance = Math.hypot(dx, dy);
            if (Math.abs(dx) > 0.5) {
                agent.facing = dx > 0 ? 1 : -1;
            }

            if (distance <= budget) {
                agent.position = { ...target };
                agent.path.shift();
                budget -= distance;
                continue;
            }

            agent.position = {
                x: agent.position.x + (dx / distance) * budget,
                y: agent.position.y + (dy / distance) * budget,
            };
            budget = 0;
        }
    };

    return {
        agents,
        update(deltaSeconds) {
            for (const agent of agents) {
                if (agent.walking) {
                    walk(agent, deltaSeconds);
                    continue;
                }

                agent.idleSeconds -= deltaSeconds;
                if (agent.idleSeconds <= 0) {
                    chooseNextRoute(agent);
                }
            }
        },
    };
}

function randomIdle(options: WanderOptions): number {
    return options.minIdleSeconds + options.random() * (options.maxIdleSeconds - options.minIdleSeconds);
}
