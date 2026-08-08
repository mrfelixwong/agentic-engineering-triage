# Provider category compatibility contract

Upstream classifiers may return canonical or legacy category labels. The
normalizer must preserve these mappings:

- `payments` -> `billing`
- `bug` and `defect` -> `bug`
- `account` and `auth` -> `account`
- `feature_request` and `feature` -> `feature_request`
- `general` -> `general`

Unknown labels may fall back to `general`. A billing repair must not remove the
legacy mappings above.
