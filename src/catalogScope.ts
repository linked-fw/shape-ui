/**
 * Building a query against the catalog a host supplied.
 *
 * A builder captures the catalog that is active when it is made, and core re-enters that
 * catalog wherever it reads shapes later (lowering, compiling, live tracking). So only the
 * building runs inside the scope; the `exec()` that follows runs outside it, as core expects.
 */

import {withShapeCatalog, type ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';

/** The last argument of every query function here. */
export interface CatalogOptions {
  /**
   * The shapes the query resolves against. Without it, core's active catalog applies
   * (normally the global registry, where the shape must then be registered).
   */
  catalog?: ShapeCatalog;
}

/** Run `build` inside `options.catalog` when one is given, else as it is. */
export function buildInCatalog<T>(options: CatalogOptions | undefined, build: () => T): T {
  return options?.catalog ? withShapeCatalog(options.catalog, build) : build();
}
