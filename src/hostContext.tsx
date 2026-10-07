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
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
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
 * - `failed`: `resolveCatalog()` rejected (logged).
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
  | {status: 'failed'};

const NO_CATALOG: HostCatalogState = {status: 'none'};
const LOADING: HostCatalogState = {status: 'loading'};

const CatalogContext = createContext<HostCatalogState>(NO_CATALOG);

export interface DataManagerHostProviderProps {
  host: DataManagerHost;
  children?: ReactNode;
}

export function DataManagerHostProvider({
  host,
  children,
}: DataManagerHostProviderProps) {
  const catalog = useLoadedCatalog(host);
  return createElement(
    HostContext.Provider,
    {value: host},
    createElement(CatalogContext.Provider, {value: catalog}, children),
  );
}

/**
 * Load the host's catalog once per host, for lookups that have to answer synchronously.
 *
 * Which shape a relation's values go through is decided while rendering — whether to offer
 * a picker, a link, a create button — so it cannot wait on `resolveCatalog()` at each field.
 * The catalog is loaded here, once, and every field reads the same list. The answer is
 * tagged with the host it came from so a host change never serves the previous project's
 * catalog while the next one loads: until the new host's answer arrives it is `loading`.
 */
function useLoadedCatalog(host: DataManagerHost): HostCatalogState {
  const [settled, setSettled] = useState<{host: DataManagerHost; state: HostCatalogState}>();

  useEffect(() => {
    if (!host.resolveCatalog) return;
    let current = true;
    host.resolveCatalog().then(
      (catalog) => {
        if (!current) return;
        // A host that answers with nothing has no catalog after all: the registry applies.
        setSettled({
          host,
          state: catalog ? {status: 'loaded', shapes: Object.values(catalog)} : NO_CATALOG,
        });
      },
      (error) => {
        // Not swallowed: a failed catalog leaves every class-only relation without a shape,
        // and the only trace of why must not be an absence.
        console.error(
          '[shape-ui] DataManagerHost.resolveCatalog() rejected; relations declared with ' +
            'sh:class only resolve to no shape until the host changes.',
          error,
        );
        if (current) setSettled({host, state: {status: 'failed'}});
      },
    );
    return () => {
      current = false;
    };
  }, [host]);

  if (!host.resolveCatalog) return NO_CATALOG;
  return settled?.host === host ? settled.state : LOADING;
}

/**
 * Where the host's catalog stands — see `HostCatalogState`. Use it to tell "no shape yet"
 * (`loading`) from "no shape" when that matters to what a component shows.
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

  return useMemo<DataManagerHost>(() => {
    const filled: DataManagerHost = {...host};

    // Resolve one shape, and register it on the way through.
    //
    // `SelectBuilder.from(shapeIri)` resolves the IRI against core's shape registry, so a
    // shape that was never registered produces an EMPTY result rather than an error — a table
    // that silently shows nothing, indistinguishable from a shape with no instances. Asking
    // the host to remember `registerRuntimeShapes` would make that the first thing every
    // consumer gets wrong, so it happens here. Registration is idempotent and never shadows a
    // compiled class.
    //
    // A host that supplied only `resolveCatalog` is served from it, so having a catalog does
    // not mean writing the single-shape lookup as well.
    const resolveShape = async (shapeIri: string) => {
      const shape = host.resolveShape
        ? await host.resolveShape(shapeIri)
        : (await host.resolveCatalog?.())?.[shapeIri];
      if (shape) registerRuntimeShapes([shape]);
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
        const found = await searchInstancesWithDsl(shape, options);
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
        });
    }

    if (!filled.updateInstance) {
      filled.updateInstance = async (shapeIri, instanceId, values) =>
        updateInstanceWithDsl(await requireShape(shapeIri), instanceId, values);
    }

    return filled;
  }, [host]);
}
