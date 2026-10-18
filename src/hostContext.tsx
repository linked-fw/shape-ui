/**
 * The host, supplied by context rather than threaded as props.
 *
 * The components that need the host are three levels down — a form renders a field, which
 * renders a value editor, which renders the relation picker — and the picker is the one
 * that needs to search, navigate and offer inline creation. Passing four callbacks through
 * every intermediate component would put host concerns in the signature of components that
 * have no interest in them.
 *
 * So: one provider at the top, `useDataManagerHost()` where it is needed. The default is
 * `nullHost()`, which does nothing rather than throwing — a component rendered without a
 * provider should show an empty picker, not break the page that embedded it.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import type {ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';
import type {CatalogOptions} from './catalogScope.js';
import {nullHost, type DataManagerHost} from './host.js';
import {registerRuntimeShapes} from '@_linked/core/shapes/registerRuntimeShape';
import {narrowSuggestions, searchInstancesWithDsl} from './search.js';
import {createInstanceWithDsl, updateInstanceWithDsl} from './write.js';

const HostContext = createContext<DataManagerHost>(nullHost());

/**
 * Where the host's catalog stands.
 *
 * - `none`: the host has no `resolveCatalog`. Lookups use core's shape registry.
 * - `loading`: the host has a catalog and it has not arrived yet.
 * - `loaded`: the catalog, as a list.
 * - `failed`: `resolveCatalog()` rejected (logged). It is asked again with a backoff —
 *   2s, doubling, at most 60s apart — up to 6 times, then left failed (logged once);
 *   `retry()` asks again now, also after that. The state stays the same `failed` object
 *   while retries are in flight, so a field neither flickers back to `loading` nor
 *   re-renders on each attempt.
 *
 * Only `none` falls back to the registry. A host with a catalog has said which shapes count,
 * and the registry also holds compiled framework shapes for the same classes — so while the
 * catalog loads, or after it failed, resolving against the registry would pick a shape the
 * host never offered, and a link or picker built on it would point outside the project.
 */
export type HostCatalogState =
  | {status: 'none'}
  | {status: 'loading'}
  | {status: 'loaded'; shapes: readonly NodeShapeWire[]}
  | {status: 'failed'; retry: () => void};

const NO_CATALOG: HostCatalogState = {status: 'none'};
const LOADING: HostCatalogState = {status: 'loading'};

const CatalogContext = createContext<HostCatalogState>(NO_CATALOG);

/**
 * The host's `ShapeCatalog`, for a host that has `resolveShapeCatalog`; `undefined` otherwise.
 *
 * `current()` is what the defaults await: the catalog once loaded, the load in flight while it
 * loads (starting it if no effect has yet), and the last rejection after it failed.
 */
interface ShapeCatalogHandle {
  state: LoadState<ShapeCatalog>;
  current: () => Promise<ShapeCatalog>;
}

const ShapeCatalogContext = createContext<ShapeCatalogHandle | undefined>(undefined);

export interface DataManagerHostProviderProps {
  host: DataManagerHost;
  children?: ReactNode;
}

export function DataManagerHostProvider({
  host,
  children,
}: DataManagerHostProviderProps) {
  const catalog = useLoadedCatalog(host);
  const shapeCatalog = useLoadedShapeCatalog(host);
  return createElement(
    HostContext.Provider,
    {value: host},
    createElement(
      CatalogContext.Provider,
      {value: catalog},
      createElement(ShapeCatalogContext.Provider, {value: shapeCatalog}, children),
    ),
  );
}

/** First retry delay after a host load rejects; doubles per consecutive failure. */
const RETRY_BASE_MS = 2_000;
/** The longest wait between retries. */
const RETRY_MAX_MS = 60_000;
/** Automatic retries per host before giving up; `retry()` still asks again after that. */
const RETRY_MAX_ATTEMPTS = 6;

/** A value a host loads once: `none` when the host has no loader. */
type LoadState<T> =
  | {status: 'none'}
  | {status: 'loading'}
  | {status: 'loaded'; value: T}
  | {status: 'failed'; retry: () => void};

interface HostLoader<T> {
  /** The host method, for log lines, e.g. `resolveCatalog()`. */
  method: string;
  /** What a failure leaves broken, for log lines. */
  consequence: string;
  /** Whether the host can load the value at all. */
  has(host: DataManagerHost): boolean;
  load(host: DataManagerHost): Promise<T>;
}

/**
 * Load one value from the host, once per host object, retrying a rejection with a backoff.
 *
 * The answer is tagged with the host it came from so a host change never serves the previous
 * project's value while the next one loads: until the new host's answer arrives it is
 * `loading`.
 *
 * A rejection is retried with a backoff rather than kept. A host is typically stable for
 * the whole session, so a `failed` that lasted until the host changed turned one transient
 * error into a broken page until a reload. The retries are bounded, though: a load that is
 * still failing after `RETRY_MAX_ATTEMPTS` is not transient, and asking forever would only
 * fill the log. The backoff resets on success and on a host change; the pending retry is
 * cancelled on unmount and host change.
 *
 * `current()` hands out the load in flight for this host (starting it when no effect has yet:
 * a child's effect runs before its provider's), so a caller that cannot wait for a render
 * awaits the same request the provider settles from.
 */
function useHostLoad<T>(
  host: DataManagerHost,
  loader: HostLoader<T>,
): {state: LoadState<T>; current: () => Promise<T>} {
  const [settled, setSettled] = useState<{host: DataManagerHost; state: LoadState<T>}>();
  // Bumped to ask again, by the backoff timer or by `retry()`.
  const [attempt, setAttempt] = useState(0);
  const failures = useRef<{host: DataManagerHost; count: number}>({host, count: 0});
  const inflight = useRef<{host: DataManagerHost; promise: Promise<T>}>(undefined);
  const lastRun = useRef<{host: DataManagerHost; attempt: number}>(undefined);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const request = useCallback(
    (fresh: boolean): Promise<T> => {
      const running = inflight.current;
      if (!fresh && running?.host === host) return running.promise;
      const promise = loader.has(host)
        ? loader.load(host)
        : Promise.reject(new Error(`DataManagerHost has no ${loader.method}.`));
      // Rejections are logged by the effect; a caller of `current()` gets its own copy.
      promise.catch(() => undefined);
      inflight.current = {host, promise};
      return promise;
    },
    [host, loader],
  );
  const current = useCallback(() => request(false), [request]);
  const hasLoader = loader.has(host);

  useEffect(() => {
    if (!hasLoader) return;
    if (failures.current.host !== host) failures.current = {host, count: 0};
    // A retry asks again; the first run for a host (and React's dev re-run of it) reuses
    // what `current()` may already have started.
    const fresh = lastRun.current?.host === host && lastRun.current.attempt !== attempt;
    lastRun.current = {host, attempt};
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    request(fresh).then(
      (value) => {
        if (!live) return;
        failures.current = {host, count: 0};
        setSettled({host, state: {status: 'loaded', value}});
      },
      (error) => {
        // Not swallowed: the only trace of why must not be an absence.
        if (!live) {
          console.error(`[shape-ui] DataManagerHost.${loader.method} rejected.`, error);
          return;
        }
        const count = failures.current.count;
        failures.current = {host, count: count + 1};
        // Keep the `failed` object consumers already hold, so an attempt that fails again
        // does not re-render every field reading it.
        setSettled((prev) =>
          prev?.host === host && prev.state.status === 'failed'
            ? prev
            : {host, state: {status: 'failed', retry}},
        );
        const prefix = `[shape-ui] DataManagerHost.${loader.method} rejected; ${loader.consequence}`;
        if (count < RETRY_MAX_ATTEMPTS) {
          const delay = Math.min(RETRY_BASE_MS * 2 ** count, RETRY_MAX_MS);
          console.error(`${prefix} Retrying in ${delay / 1000}s.`, error);
          timer = setTimeout(retry, delay);
        } else if (count === RETRY_MAX_ATTEMPTS) {
          console.error(
            `${prefix} Gave up after ${RETRY_MAX_ATTEMPTS} retries; retry() asks again.`,
            error,
          );
        } else {
          // A manual retry() after giving up: logged, but the give-up is not repeated.
          console.error(prefix, error);
        }
      },
    );
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [host, attempt, retry, request, hasLoader, loader]);

  const state: LoadState<T> = !hasLoader
    ? NO_LOAD
    : settled?.host === host
      ? settled.state
      : LOAD_PENDING;
  return {state, current};
}

const NO_LOAD = {status: 'none'} as const;
const LOAD_PENDING = {status: 'loading'} as const;

const WIRE_CATALOG: HostLoader<Record<string, NodeShapeWire> | undefined> = {
  method: 'resolveCatalog()',
  consequence: 'relations declared with sh:class only resolve to no shape until it succeeds.',
  has: (host) => !!host.resolveCatalog,
  load: (host) => host.resolveCatalog!(),
};

const SHAPE_CATALOG: HostLoader<ShapeCatalog> = {
  method: 'resolveShapeCatalog()',
  consequence: 'reads, searches and saves fail until it succeeds.',
  has: (host) => !!host.resolveShapeCatalog,
  load: (host) =>
    host.resolveShapeCatalog!().then((catalog) => {
      // No catalog is a failure, not "use the registry": the host said it scopes its shapes.
      if (!catalog) throw new Error('resolveShapeCatalog() resolved no catalog.');
      return catalog;
    }),
};

/**
 * Load the host's catalog once per host, for lookups that have to answer synchronously.
 *
 * Which shape a relation's values go through is decided while rendering — whether to offer
 * a picker, a link, a create button — so it cannot wait on `resolveCatalog()` at each field.
 * The catalog is loaded here, once, and every field reads the same list.
 */
function useLoadedCatalog(host: DataManagerHost): HostCatalogState {
  const {state} = useHostLoad(host, WIRE_CATALOG);
  return useMemo<HostCatalogState>(() => {
    switch (state.status) {
      case 'none':
        return NO_CATALOG;
      case 'loading':
        return LOADING;
      case 'failed':
        return state;
      case 'loaded':
        // A host that answers with nothing has no catalog after all: the registry applies.
        return state.value ? {status: 'loaded', shapes: Object.values(state.value)} : NO_CATALOG;
    }
  }, [state]);
}

/** Load the host's `ShapeCatalog` once per host; `undefined` for a host without one. */
function useLoadedShapeCatalog(host: DataManagerHost): ShapeCatalogHandle | undefined {
  const {state, current} = useHostLoad(host, SHAPE_CATALOG);
  return useMemo(
    () => (state.status === 'none' ? undefined : {state, current}),
    [state, current],
  );
}

/**
 * Where the host's catalog stands — see `HostCatalogState`. Use it to tell "no shape yet"
 * (`loading`) from "no shape" when that matters to what a component shows. On `failed`,
 * `retry()` asks the host again now instead of waiting for the next backoff step — and is
 * the only way to ask again once the automatic retries have given up.
 */
export function useHostCatalogState(): HostCatalogState {
  return useContext(CatalogContext);
}

/** True while the host's catalog is on its way; class-only relations resolve to no shape meanwhile. */
export function useHostCatalogLoading(): boolean {
  return useContext(CatalogContext).status === 'loading';
}

/**
 * The host's catalog, when it has one and it has loaded.
 *
 * `undefined` while it loads, when it failed, and when the host has none — use
 * `useHostCatalogState` to tell those apart. Not the same as an empty list, which is a
 * catalog with nothing in it.
 */
export function useHostCatalog(): readonly NodeShapeWire[] | undefined {
  const state = useContext(CatalogContext);
  return state.status === 'loaded' ? state.shapes : undefined;
}

/**
 * The host's `ShapeCatalog`, once loaded: pass it as `{catalog}` to `selectInstances` and the
 * other query functions a host calls itself. `undefined` while it loads, when it failed, and
 * when the host has no `resolveShapeCatalog`.
 */
export function useHostShapeCatalog(): ShapeCatalog | undefined {
  const handle = useContext(ShapeCatalogContext);
  return handle?.state.status === 'loaded' ? handle.state.value : undefined;
}

/**
 * The host for the surrounding provider, with the defaults filled in.
 *
 * `searchInstances`, `createInstance` and `updateInstance` are supplied from the DSL when
 * the host does not provide them, so reading, searching and saving all work with no host
 * wiring at all. Callers therefore never branch on whether a method exists — which they
 * previously had to, and which meant a host that forgot one rendered a silently empty
 * picker or a form whose save button did nothing.
 *
 * Read and write are filled in from the same place on purpose. They are routed by
 * `LinkedStorage` as a pair, and a read routed one way with a write routed another is how
 * a form saves into a dataset the table is not looking at.
 */
export function useDataManagerHost(): DataManagerHost {
  const host = useContext(HostContext);
  const currentShapeCatalog = useContext(ShapeCatalogContext)?.current;

  return useMemo<DataManagerHost>(() => {
    const filled: DataManagerHost = {...host};

    // The catalog every default builds its query in, for a host that supplies one. Awaited
    // per call, so a call made while it loads waits for it, and one made after it failed
    // rejects: falling back to the registry would resolve a shape the host did not offer.
    const catalogOptions = async (): Promise<CatalogOptions> =>
      currentShapeCatalog ? {catalog: await currentShapeCatalog()} : {};

    // Resolve one shape, and — without a host catalog — register it on the way through.
    //
    // `SelectBuilder.from(shapeIri)` resolves the IRI against core's shape registry, so a
    // shape that was never registered produces an EMPTY result rather than an error — a table
    // that silently shows nothing, indistinguishable from a shape with no instances. Asking
    // the host to remember `registerRuntimeShapes` would make that the first thing every
    // consumer gets wrong, so it happens here. Registration is idempotent and never shadows a
    // compiled class. A host with `resolveShapeCatalog` registers nothing: its queries are
    // built in its catalog, and the registry is process-wide.
    //
    // A host that supplied only `resolveCatalog` is served from it, so having a catalog does
    // not mean writing the single-shape lookup as well.
    const resolveShape = async (shapeIri: string) => {
      const shape = host.resolveShape
        ? await host.resolveShape(shapeIri)
        : (await host.resolveCatalog?.())?.[shapeIri];
      if (shape && !currentShapeCatalog) registerRuntimeShapes([shape]);
      return shape;
    };
    filled.resolveShape = resolveShape;

    /** The shape, or a thrown error naming the IRI — a write must not guess. */
    const requireShape = async (shapeIri: string) => {
      const shape = await resolveShape(shapeIri);
      if (!shape) {
        throw new Error(
          `Cannot write to ${shapeIri}: it is not in the catalog this host resolved. ` +
            'A write against an unknown shape would put untyped triples in the graph.',
        );
      }
      return shape;
    };

    if (!filled.searchInstances) {
      filled.searchInstances = async (shapeIri, options) => {
        const shape = await resolveShape(shapeIri);
        // No shape means no label property and no idea what to project. An empty result is
        // the honest answer; guessing a projection would produce a wrong query.
        if (!shape) return {results: [], hasMore: false};
        const found = await searchInstancesWithDsl(shape, options, await catalogOptions());
        return {
          ...found,
          results: narrowSuggestions(found.results, options?.narrowedIds),
        };
      };
    }

    if (!filled.createInstance) {
      filled.createInstance = async (shapeIri, values) =>
        createInstanceWithDsl(await requireShape(shapeIri), values, {
          dataRoot: host.dataRoot,
          ...(await catalogOptions()),
        });
    }

    if (!filled.updateInstance) {
      filled.updateInstance = async (shapeIri, instanceId, values) =>
        updateInstanceWithDsl(
          await requireShape(shapeIri),
          instanceId,
          values,
          await catalogOptions(),
        );
    }

    return filled;
  }, [host, currentShapeCatalog]);
}
