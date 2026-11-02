/**
 * The wire shapes these components speak.
 *
 * Declared here rather than imported from a host application's client package. They were
 * imported from such a package, and because a `.d.ts` keeps its type imports, the emitted
 * types carried that dependency forward — so anyone installing this package needed one
 * product's client just to typecheck a table. That is precisely the coupling the package
 * exists to avoid, and it survived the move because type-only imports are invisible at
 * runtime and nothing complained.
 *
 * TypeScript is structural, so a host that already has its own version of these — under any
 * name — passes them straight in with no adapter and no cast.
 */

import type {PaginationState} from '@tanstack/react-table';

/** Which page of a shape's instances to read, in what order, filtered how. */
export interface ShapeInstancesQueryConfig extends PaginationState {
  orderBy?: unknown;
  filters: unknown[];
}

/** One instance marked for deletion. */
export interface InstanceDeletionTarget {
  instanceId: string;
  shapeIri: string;
}

/** Something pointing AT an instance that is about to be deleted. */
export interface InstanceDeletionInboundReference {
  subjectId: string;
  propertyIri: string;
}

/**
 * What deleting would actually do.
 *
 * `impactHash` is the point of the two-step flow: the host re-checks it before deleting, so a
 * preview the viewer read and a graph that changed underneath cannot be confirmed by mistake.
 */
export interface InstanceDeletionPreview {
  impactHash: string;
  targets: Array<
    InstanceDeletionTarget & {
      inboundReferences: InstanceDeletionInboundReference[];
      sourceDocuments: string[];
      pendingRecreation: boolean;
    }
  >;
}

export interface InstanceDeletionPreviewInput {
  projectId: string;
  targets: InstanceDeletionTarget[];
}

export interface InstanceDeletionExecuteInput extends InstanceDeletionPreviewInput {
  expectedImpactHash: string;
}

export interface InstanceDeletionResult {
  deleted: InstanceDeletionTarget[];
  /** Not deleted, because a source document would recreate them on the next ingestion. */
  suppressed: Array<InstanceDeletionTarget & {sourceDocumentIds: string[]}>;
  activityEventId?: string;
}
