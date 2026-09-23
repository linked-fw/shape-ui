import {linkedPackage} from '@_linked/core/utils/Package';

/**
 * This package's own identity.
 *
 * It used to re-export `@_linked/core`'s decorators verbatim, which meant any
 * shape declared here would register under the package name `@_linked/core`
 * and carry a `.../shape/core/...` IRI. A third name — a cosmetic
 * `packageName: '@_linked/ui'` literal — matched neither the npm name nor the
 * registration.
 *
 * Nothing is decorated here today, so nothing was mis-registered. The point is
 * that the next shape added to this package would have been, silently: a shape
 * whose IRI names the wrong package is unreachable by `Server.call`, which
 * routes on exactly that name.
 */
export const {
  linkedShape,
  linkedUtil,
  linkedOntology,
  registerPackageExport,
  registerPackageModule,
  getPackageShape,
  packageExports,
  packageName,
} = linkedPackage('@_linked/shape-ui');
