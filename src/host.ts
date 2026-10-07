/**
 * What a host application supplies to the data manager.
 *
 * The point of this contract is what it does NOT contain: no project id, no branch, no
 * store, no dataset name. Routing is decided below the component by `LinkedStorage` —
 * a multi-project host's own router, the app's own default dataset in a standalone or
 * Capacitor build — so the component issues a Linked Query and never names a project.
 * Everything here is genuinely host-specific: where IRIs are minted, how the catalog is
 * found, and where a click should go.
 */

import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import type {ReactNode} from 'react';

/** Where a host sends the viewer when they act on a row. */
export interface DataManagerNavigation {
  toInstance(shapeIri: string, instanceId: string): void;
  toEdit(shapeIri: string, instanceId: string): void;
  toAdd(shapeIri: string): void;
}

/**
 * "Pick mode" — the flow where a form asks the user to choose a related instance and
 * returns with it. Optional because it is a studio-style affordance; a standalone
 * app that has no such flow simply omits it, rather than being asked to stub it.
 */
/** What a field needs the host to open a picker for. */
export interface PickRequest {
  /** The shape whose instances the viewer should choose from. */
  shapeIri: string;
  /** The field asking, so the host can route the answer back to it. */
  propertyLabel: string;
  /** The shape being edited — the same field label can exist on more than one. */
  sourceShapeIri?: string;
  minCount?: number;
  maxCount?: number;
  /** Already-chosen values, so the picker can show them as selected. */
  alreadySelected?: InstanceSuggestion[];
  /**
   * An opaque token the host must carry across the round trip and hand back on return.
   *
   * A field with unsaved work flushes it before the viewer leaves, and that flush yields
   * an identifier — e.g. a host's draft id — without which the half-filled form is lost on
   * the way back. The field cannot store it itself; it is about to unmount. It is opaque
   * here on purpose: how a host preserves it is its own business (a host may put it in
   * the return URL), and a host with no navigation to survive can ignore it.
   */
  resumeToken?: string;
}

export interface DataManagerPicking {
  /**
   * A field is asking the viewer to choose. How that is presented is entirely the host's
   * call — a studio host may navigate to the overview in pick mode, a mobile app would open a
   * sheet — which is why this is a request rather than a URL.
   *
   * A host that omits `picking` gets a picker with no "browse all" affordance rather than
   * a broken one; the inline search still works.
   */
  open(request: PickRequest): void;

  /**
   * The viewer completed a choice.
   *
   * Called ONCE per completed choice with everything chosen, not once per instance —
   * a multi-pick host has to write all the values and then return, and per-instance calls
   * made it navigate away on the first one.
   *
   * The full suggestion is passed, not just the id, because the host generally has to
   * store something displayable straight away: the field that opened the picker renders
   * a chip before anything re-reads the instance. Passing an id alone forced the host to
   * look the label back up, which is a read it should not need.
   */
  select(instances: InstanceSuggestion[]): void;

  /**
   * The return leg: values the viewer picked for this field while it was away.
   *
   * A field that sends the viewer elsewhere to choose is unmounted by the time they do,
   * so the answer cannot be handed back through a callback — the field has to ask for it
   * when it mounts again. Which is why `open` and `select` alone were not enough: the
   * component was reading one host app's sessionStorage directly to close the loop.
   *
   * Returns only what belongs to THIS field: several relation fields can be on one form,
   * and the picked values must not land in the wrong one. Returns null when there is
   * nothing waiting, which is the normal case on almost every mount.
   *
   * The host consumes the result. Note that under React Strict Mode a field mounts,
   * unmounts and mounts again, so a host that clears synchronously will lose the value
   * on the second mount — clear on a later tick.
   */
  takeResult(field: {
    propertyLabel: string;
    sourceShapeIri?: string;
  }): InstanceSuggestion[] | null;
}

/** One candidate for a relation field. */
export interface InstanceSuggestion {
  id: string;
  label: string;
  image?: string;
}

export interface SearchInstancesOptions {
  /** Free text; empty means "browse". */
  query?: string;
  limit?: number;
  offset?: number;
  /** Restrict to these ids — used when another field's value narrows the choices. */
  narrowedIds?: string[] | null;
}

export interface DataManagerHost {
  /**
   * Base IRI for minting new instance IRIs.
   *
   * In a multi-project host this is typically the project's data root — the ONE value in the
   * catalog path that comes from the host rather than the app's own dataset. A standalone app knows its
   * own domain and passes it from config, which is why this is a plain value here and not
   * a lookup.
   */
  dataRoot?: string;

  /**
   * The metadata for ONE shape, by IRI.
   *
   * The only required member, and deliberately the smallest one that works. It used to ask
   * for the whole catalog, which read as though a consumer needed a catalogue query before
   * they could render anything — and that is not what the components do with it. There are
   * exactly two uses: resolving the shape a relation field is searching, and resolving the
   * shape a form is writing to. Both want one shape.
   *
   * So an app that composes a page for `Contact` returns its `Contact` shape from a constant
   * and is done. An app that does have a catalog answers from it. Neither is asked to build
   * a shape browser in order to render one table.
   *
   * Return `undefined` for an unknown IRI: a search then yields nothing rather than
   * guessing, and a write is refused rather than putting untyped triples in the graph.
   */
  resolveShape(shapeIri: string): Promise<NodeShapeWire | undefined>;

  /**
   * The whole catalog, when the host happens to have one.
   *
   * Optional. Supplying it means `resolveShape` can be derived, so a host with a catalog
   * need not write both — and it makes the catalog the set a relation declared with
   * `sh:class` alone resolves its shape among, in place of core's registry. While it loads,
   * or if it rejects (logged), such a relation resolves to no shape rather than to a
   * registry shape the host never offered.
   */
  resolveCatalog?(): Promise<Record<string, NodeShapeWire>>;

  /**
   * Find instances of a shape, for a relation field's picker.
   *
   * A host concern because *how* you search is host-specific: a multi-project host asks its backend
   * on behalf of a project, a standalone app queries its own dataset. What the picker needs
   * back is the same either way — id, a human label, optionally an image.
   */
  searchInstances?(
    shapeIri: string,
    options?: SearchInstancesOptions,
  ): Promise<{results: InstanceSuggestion[]; hasMore: boolean}>;

  /**
   * Render a form for creating a related instance inline, without leaving the field.
   *
   * A render slot rather than a component reference on purpose. The relation picker used to
   * `import AddInstanceForms` directly — a molecule importing an organism, which is a cycle
   * and also the single thing that made the picker unextractable. The host decides what
   * "create one of these" looks like; the picker only decides when to ask.
   */
  inlineCreate?(args: {
    shapeIri: string;
    onCreated: (created: InstanceSuggestion) => void;
    onCancel: () => void;
  }): ReactNode;

  /**
   * Read one instance's values.
   *
   * Used by the form's dependency cascade, which needs a parent instance's values to narrow
   * a child field's choices. On the host because the read is host-specific; the cascade
   * logic is not.
   */
  readInstance?(
    shapeIri: string,
    instanceId: string,
  ): Promise<{rows: Record<string, unknown>[]}>;

  navigate?: DataManagerNavigation;
  picking?: DataManagerPicking;

  /**
   * Create an instance and return its IRI.
   *
   * Optional, and filled in from the DSL when absent — like `searchInstances`, and for the
   * same reason: a form that cannot save unless the host wrote a create by hand is not
   * "works standalone". A host overrides it when its create also has to do host-side work
   * (e.g. write a draft or record an edit), neither of which is a write concern.
   */
  createInstance?(
    shapeIri: string,
    values: Record<string, unknown>,
  ): Promise<{id: string}>;

  /** Update an instance. Optional, and filled in from the DSL when absent. */
  updateInstance?(
    shapeIri: string,
    instanceId: string,
    values: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * A host with nothing wired up: catalog is empty, navigation is a no-op.
 *
 * For tests and for a first render before the real host exists. Deliberately silent
 * rather than throwing — a missing host should render an empty table, not break the page
 * that embedded it.
 */
export function nullHost(): DataManagerHost {
  return {
    async resolveShape() {
      return undefined;
    },
  };
}
