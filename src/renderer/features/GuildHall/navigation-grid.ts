import type { Point, Rect } from './guild-hall-layout';

export interface NavigationGrid {
    readonly cellSize: number;
    readonly columns: number;
    readonly rows: number;
    /** 1 = blocked, 0 = walkable, indexed by row * columns + column. */
    readonly blocked: Uint8Array;
}

/**
 * Builds a walkability grid: cells outside `walkableArea` or overlapping an obstacle (grown by
 * `clearance`) are blocked.
 */
export function createNavigationGrid(
    width: number,
    height: number,
    cellSize: number,
    walkableArea: Rect,
    obstacles: readonly Rect[],
    clearance: Point,
): NavigationGrid {
    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const blocked = new Uint8Array(columns * rows);
    const grown = obstacles.map((rect) => ({
        x: rect.x - clearance.x,
        y: rect.y - clearance.y,
        width: rect.width + clearance.x * 2,
        height: rect.height + clearance.y * 2,
    }));

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const center = { x: (column + 0.5) * cellSize, y: (row + 0.5) * cellSize };
            const outside = !containsPoint(walkableArea, center);
            const covered = grown.some((rect) => containsPoint(rect, center));
            blocked[row * columns + column] = outside || covered ? 1 : 0;
        }
    }

    return { cellSize, columns, rows, blocked };
}

export function isWalkable(grid: NavigationGrid, point: Point): boolean {
    const cell = cellOf(grid, point);
    if (!cell) {
        return false;
    }

    return grid.blocked[cell.row * grid.columns + cell.column] === 0;
}

/**
 * A* over the grid with 8-way movement (no corner cutting). The start and goal cells are always
 * passable so characters can leave or reach a seat tucked against furniture. Returns the waypoints
 * after `from`, ending exactly at `to`, or null when no route exists.
 */
export function findPath(grid: NavigationGrid, from: Point, to: Point): Point[] | null {
    const start = cellOf(grid, from);
    const goal = cellOf(grid, to);
    if (!start || !goal) {
        return null;
    }

    const startIndex = start.row * grid.columns + start.column;
    const goalIndex = goal.row * grid.columns + goal.column;
    if (startIndex === goalIndex) {
        return [to];
    }

    const passable = (index: number): boolean =>
        grid.blocked[index] === 0 || index === startIndex || index === goalIndex;

    const cellCount = grid.columns * grid.rows;
    const costSoFar = new Float64Array(cellCount).fill(Infinity);
    const cameFrom = new Int32Array(cellCount).fill(-1);
    const closed = new Uint8Array(cellCount);
    const open = new MinHeap();

    costSoFar[startIndex] = 0;
    open.push(startIndex, heuristic(start.column, start.row, goal.column, goal.row));

    for (let current = open.pop(); current !== undefined; current = open.pop()) {
        if (current === goalIndex) {
            return toWaypoints(grid, cameFrom, goalIndex, to);
        }
        if (closed[current]) {
            continue;
        }
        closed[current] = 1;

        const column = current % grid.columns;
        const row = Math.floor(current / grid.columns);
        for (const [dx, dy] of NEIGHBOR_OFFSETS) {
            const nextColumn = column + dx;
            const nextRow = row + dy;
            if (nextColumn < 0 || nextRow < 0 || nextColumn >= grid.columns || nextRow >= grid.rows) {
                continue;
            }

            const next = nextRow * grid.columns + nextColumn;
            if (closed[next] || !passable(next)) {
                continue;
            }

            const diagonal = dx !== 0 && dy !== 0;
            if (diagonal && (!passable(row * grid.columns + nextColumn) || !passable(nextRow * grid.columns + column))) {
                continue;
            }

            const cost = costSoFar[current] + (diagonal ? Math.SQRT2 : 1);
            if (cost >= costSoFar[next]) {
                continue;
            }

            costSoFar[next] = cost;
            cameFrom[next] = current;
            open.push(next, cost + heuristic(nextColumn, nextRow, goal.column, goal.row));
        }
    }

    return null;
}

const NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function heuristic(column: number, row: number, goalColumn: number, goalRow: number): number {
    const dx = Math.abs(column - goalColumn);
    const dy = Math.abs(row - goalRow);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function cellOf(grid: NavigationGrid, point: Point): { column: number; row: number } | null {
    const column = Math.floor(point.x / grid.cellSize);
    const row = Math.floor(point.y / grid.cellSize);
    if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) {
        return null;
    }

    return { column, row };
}

function containsPoint(rect: Rect, point: Point): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

/** Walks the chain back from the goal and keeps only the cells where the direction changes. */
function toWaypoints(grid: NavigationGrid, cameFrom: Int32Array, goalIndex: number, goal: Point): Point[] {
    const cells: number[] = [];
    for (let index = goalIndex; index !== -1; index = cameFrom[index]) {
        cells.push(index);
    }
    cells.reverse();

    const waypoints: Point[] = [];
    for (let i = 1; i < cells.length - 1; i++) {
        const previous = cells[i - 1];
        const current = cells[i];
        const next = cells[i + 1];
        if (current - previous !== next - current) {
            waypoints.push(cellCenter(grid, current));
        }
    }
    waypoints.push(goal);

    return waypoints;
}

function cellCenter(grid: NavigationGrid, index: number): Point {
    return {
        x: ((index % grid.columns) + 0.5) * grid.cellSize,
        y: (Math.floor(index / grid.columns) + 0.5) * grid.cellSize,
    };
}

/** Minimal binary heap of cell indices keyed by priority. */
class MinHeap {
    private readonly items: number[] = [];
    private readonly priorities: number[] = [];

    push(item: number, priority: number): void {
        this.items.push(item);
        this.priorities.push(priority);
        let index = this.items.length - 1;
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (this.priorities[parent] <= this.priorities[index]) {
                break;
            }
            this.swap(index, parent);
            index = parent;
        }
    }

    pop(): number | undefined {
        const top = this.items[0];
        const lastItem = this.items.pop();
        const lastPriority = this.priorities.pop();
        if (lastItem !== undefined && lastPriority !== undefined && this.items.length > 0) {
            this.items[0] = lastItem;
            this.priorities[0] = lastPriority;
            let index = 0;
            for (;;) {
                const left = index * 2 + 1;
                const right = left + 1;
                let smallest = index;
                if (left < this.items.length && this.priorities[left] < this.priorities[smallest]) {
                    smallest = left;
                }
                if (right < this.items.length && this.priorities[right] < this.priorities[smallest]) {
                    smallest = right;
                }
                if (smallest === index) {
                    break;
                }
                this.swap(index, smallest);
                index = smallest;
            }
        }

        return top;
    }

    private swap(a: number, b: number): void {
        [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
        [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
    }
}
