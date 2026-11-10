---
'@_linked/shape-ui': major
---

The package object (`package`) gives `registerOntologies` in place of `linkedOntology`, which the core this release builds on no longer has. Node labels compact an IRI with the app's prefix map (the map the app loads), since packages no longer register prefixes; with no matching prefix the label is the IRI's last segment, as before.
