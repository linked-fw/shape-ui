---
'@_linked/shape-ui': patch
---

`@_linked/schema` raised to ^1.8.0, the release with generated accessor modules (and
`@_linked/core` to ^2.41.0, which it requires). Shape UI imports only schema's shapes and
`ImageUploader` (`shapes/Thing`, `shapes/ImageObject`, `components/ImageUploader`), whose exports
are unchanged, so no source changed.
