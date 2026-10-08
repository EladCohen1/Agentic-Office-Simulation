# Electron Convention Guide

Stack: Electron, TypeScript, React.

Apply only the sections relevant to the current task unless a broad architectural decision requires the complete guide.

## 1. Hard Conventions

These conventions should be followed unless there is a clear project-specific reason not to.

### Naming

* Use **PascalCase** for:

  * Classes
  * Types and interfaces
  * React components
* Use **camelCase** for:

  * Functions and methods, including public ones
  * Local variables
  * Fields and properties
  * Custom hooks, always prefixed with `use` (`useInventory`)
* Use **UPPER_SNAKE_CASE** for module-level constants that are true fixed values (`MAX_RETRY_COUNT`).
* Do not prefix interfaces with `I`.
* Prefer string literal unions or `as const` objects over TypeScript `enum`.

```ts
type AgentStatus = 'idle' | 'working' | 'blocked';
```

### File Naming

* React component files use **PascalCase** and match the component they export (`AgentCard.tsx`).
* All other modules use **kebab-case** (`agent-repo.ts`, `ipc-channels.ts`).
* Prefer **named exports**. Avoid default exports.

### Role-Revealing Names

Prefer responsibility-oriented names when the role is meaningful.

Examples include:

* `Manager`
* `Controller`
* `Provider`
* `Repo`
* `Factory`
* `Service`
* `Loader`
* `View`
* `Rules`
* `Policy`
* `Handlers` (IPC handler modules in main)
* `Bridge` (preload API surfaces)

Names should communicate the responsibility of the module rather than merely its implementation details.

### Process-First, Then Feature-Oriented Organization

Electron code runs in separate processes with different capabilities. The process split is the top-level boundary. Inside each process, organize by **feature or domain first**.

```text
src/
    main/
        app/            bootstrap, window creation, app lifecycle
        features/
            Agents/
            Persistence/
    preload/
    renderer/
        app/            root component, routing, providers
        features/
            Agents/
            Office/
        shared/         reusable UI and hooks with no feature ownership
    shared/             types and contracts used by more than one process
        ipc/
```

As a feature grows, subdivide it by responsibility rather than placing unrelated modules into a flat directory.

Code in `shared/` must not import Electron, Node, or React. It is plain TypeScript usable from any process.

### TypeScript Strictness

* `strict` mode is always on.
* Do not use `any`. Use `unknown` at untrusted boundaries and narrow it explicitly.
* Do not silence the compiler with `@ts-ignore`. If a suppression is truly necessary, use `@ts-expect-error` with a comment explaining why.
* Avoid non-null assertions (`!`) except where an invariant is guaranteed and obvious from the surrounding code.

### Sparse, Purposeful Comments

Prefer comments that explain:

* Intent
* Rationale
* Non-obvious constraints
* Edge cases
* Important section boundaries

Do not routinely document behavior that is already obvious from the code or the types.

Reserve substantial TSDoc for:

* Reusable infrastructure
* The preload API and IPC contract
* Genuinely complex or non-obvious behavior

### Guard-Oriented Control Flow

Prefer early-return guard clauses for:

* Missing dependencies
* Invalid input
* Invalid state
* Expected failure conditions

Prefer:

```ts
if (!agent) {
    return;
}
```

over deeply nested control flow.

Represent expected absence using values such as:

* `null` or `undefined`
* `false`
* Empty results or collections

Do not use exceptions as normal application control flow.

### Async and Error Handling

* Every Promise is either awaited, returned, or explicitly handled. No floating Promises.
* Expected failures crossing a boundary (IPC, persistence, network) are returned as typed results, not thrown.

```ts
type Result<T, E = string> =
    | { ok: true; value: T }
    | { ok: false; error: E };
```

* Unexpected errors are allowed to throw and are caught and logged at a top-level boundary (IPC handler wrapper, React error boundary, main process `uncaughtException` / `unhandledRejection` handlers).

---

## 2. Architectural Preferences and Principles

These are strong architectural preferences rather than absolute rules. Apply them pragmatically and according to the needs of the feature.

### Prefer Composition

Build complex behavior and UI from collaborating modules and components.

Prefer composition over inheritance when behavior can be assembled from independent responsibilities.

Use inheritance primarily for small, clearly bounded extension families where the relationship is naturally hierarchical.

### Use Modifiers or Policies for Behavioral Variation

When behavior should vary independently of an object's core type, prefer composable **modifier**, **policy**, **rules**, or similar strategy objects or functions.

Avoid creating additional subclasses or component variants solely to represent combinations of behavioral variations.

### Abstract at Real Seams

Introduce interfaces when they provide concrete value, such as:

* The IPC boundary between main and renderer
* Persistence boundaries
* OS integration (file system, tray, notifications, auto-update)
* External services or APIs
* Test seams

Do not create interfaces mechanically for every class.

An abstraction should represent a meaningful boundary, not simply mirror an implementation.

### Keep Electron at the Integration Boundary

Keep Electron and Node APIs in thin integration modules.

Domain logic lives in plain TypeScript modules that can be tested without launching Electron.

Do not avoid Electron APIs for architectural purity where a module naturally belongs to the integration layer. Keep that layer thin.

### Keep Dependency Scope Explicit

Pass local collaborators directly, through parameters, constructors, or props.

Use a deliberate service, registry, or React context for dependencies that are genuinely:

* App-wide
* Shared across otherwise unrelated features

Avoid ad-hoc module-level singletons that are imported from everywhere as a normal dependency-resolution mechanism.

### Use Constructor Injection for Plain Objects

For plain classes and factory functions, pass required dependencies in at construction.

```ts
export function createAgentService(repo: AgentRepo, clock: Clock): AgentService {
    // ...
}
```

### Keep Messaging Local and Typed

Prefer direct typed calls and callbacks between collaborators in the same process.

Prefer local typed events over a global event bus.

IPC is the cross-process messaging layer. Treat it as a deliberate, narrow boundary, not as a general-purpose bus for in-process communication.

Introduce broader messaging infrastructure only when there is a concrete architectural need for it.

### Optimize Pragmatically

Optimize known or credible hot paths rather than making the entire codebase performance-averse by default.

Typical Electron hot paths:

* Blocking work on the main process (it freezes every window)
* High-frequency IPC traffic
* Unnecessary React re-renders in large or frequently updating trees

Use techniques such as caching, batching IPC messages, memoization, virtualization of long lists, and moving heavy work to a utility process or worker when the cost justifies them.

Avoid premature optimization where there is no meaningful performance concern.

---

## 3. Electron-Specific Conventions

### Security Defaults Are Non-Negotiable

Every `BrowserWindow` uses:

```ts
webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: PRELOAD_PATH,
}
```

Additionally:

* Define a Content Security Policy for every renderer page.
* Do not load remote content into windows that have a preload API.
* Deny unexpected navigation (`will-navigate`) and new windows (`setWindowOpenHandler`) by default.
* Only pass validated `https:` URLs to `shell.openExternal`.

### Preload Exposes a Minimal, Typed API

The renderer has no direct access to Electron or Node. It reaches the OS only through the API exposed by preload with `contextBridge`.

* Expose purpose-specific functions, never raw `ipcRenderer` or generic `send(channel, ...)` passthroughs.
* The exposed API is typed in `shared/` and declared on `window` so the renderer gets full type checking.

```ts
contextBridge.exposeInMainWorld('api', {
    agents: {
        list: () => ipcRenderer.invoke(IPC.agents.list),
    },
});
```

### Define the IPC Contract in One Place

* All channel names and payload types live in `shared/ipc/`.
* Do not write channel name strings inline at call sites.
* Use `invoke` / `handle` for request-response.
* Use `send` / `on` only for one-way notifications.
* Keep the channel list small. Prefer one well-shaped channel over several chatty ones.

### Validate Everything Arriving Over IPC

Main treats every IPC payload as untrusted `unknown` input.

* Validate the payload shape before use.
* Verify the sender where it matters (`event.senderFrame`).
* Return a typed `Result` for expected failures rather than throwing across the boundary.

### Follow a Consistent App Lifecycle

#### Startup (`app.whenReady()`)

* Register IPC handlers once.
* Initialize app-wide services.
* Create windows.

#### Window Creation

* Each window owns its listeners and per-window resources.
* Clean those up when the window emits `closed`.

#### Shutdown (`window-all-closed`, `before-quit`)

* Flush pending persistence.
* Release owned resources.
* Quit on `window-all-closed` except on macOS.

Prefer registration functions that return their own cleanup, so ownership is explicit:

```ts
export function registerAgentHandlers(service: AgentService): () => void {
    ipcMain.handle(IPC.agents.list, () => service.list());

    return () => {
        ipcMain.removeHandler(IPC.agents.list);
    };
}
```

### Every Subscription Has Explicit Cleanup

Every listener must have a clear owner and a matching removal. This includes:

* `ipcRenderer.on` listeners exposed through preload (the preload function returns an unsubscribe function)
* `ipcMain` handlers
* `BrowserWindow`, `app`, and `webContents` event listeners
* DOM event listeners, timers, and intervals

### Keep the Main Process Responsive

* Do not use synchronous file system or IPC calls in the main process outside of startup.
* Move CPU-heavy or long-running work to a utility process or worker thread.

### Persistence Lives in Main

* Only the main process reads and writes files. The renderer requests data over IPC.
* Store app data under `app.getPath('userData')`.
* Persisted data is versioned and validated on load, with a defined fallback for missing or corrupt data.
* Write files atomically (write to a temp file, then rename).

---

## 4. React-Specific Conventions

### Function Components and Hooks

* Use function components only.
* Extract reusable stateful logic into custom hooks named `useX`.
* One exported component per file. Small private helper components in the same file are fine.

### Separate Feature Logic from Presentation

* Feature components and hooks own data fetching, IPC calls, and state.
* Presentational components receive data and callbacks through props and do not call `window.api` directly.

### Keep State Local First

* Keep state in the lowest component that needs it.
* Lift state only when siblings genuinely share it.
* Use React context for genuinely app-wide concerns.
* Introduce a global state library only when there is a concrete need for it.

### Effects Are for Synchronization, Not Derivation

* Use `useEffect` to synchronize with something outside React (IPC subscriptions, timers, DOM APIs).
* Compute derived values during render instead of syncing them through effects.
* Every effect that subscribes returns a cleanup function.

```tsx
useEffect(() => {
    const unsubscribe = window.api.agents.onStatusChanged(setStatus);

    return unsubscribe;
}, []);
```

### Memoize Deliberately

Use `useMemo`, `useCallback`, and `memo` where a measured or obvious re-render cost justifies them, not by default.

### Contain Failures

Wrap major feature areas in error boundaries so one failing feature does not blank the entire window.
