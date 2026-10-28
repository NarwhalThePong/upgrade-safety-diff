# Changelog

## 0.1.0 (2026-10-28)
- First local build: CLI comparing two `forge inspect <C> storageLayout --json` files. Eight checks: slot shift, in-place type/size change, deleted variable, reorder, insert vs append, struct member layout, `__gap` consumption, mapping/dynamic-array type changes.
- Text, `--json` and `--markdown` output, plus `--fail-on <severity>` exit codes.
- `scripts/layout.sh` wrapper for `forge inspect`.
- 13 own fixture pairs (forge 1.8.5 / solc 0.8.24) and 17 OpenZeppelin `openzeppelin-upgrades` test pairs. The tool agrees with OpenZeppelin's safe/unsafe verdict on all 17.
- Known limits: storage layout only; ERC-7201 namespaces, immutables and constants are not analyzed; inheritance-order changes are only caught through their slot effects.
