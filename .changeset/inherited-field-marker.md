---
"@_linked/shape-ui": minor
---

The CMS forms mark inherited fields. When a property shape in the host's wire carries `inheritedFrom: {id}` (the shape that declares it), `AddInstanceForms` and `EditInstanceForms` show a quiet "from <Shape>" under the field's label and after the field in the "Add optional field" menu. The name is the shape's label in `allShapes`, else the last segment of its IRI; `inheritedFromName(property, shapes)` is exported. Requires `@_linked/core` ^2.39.3.
