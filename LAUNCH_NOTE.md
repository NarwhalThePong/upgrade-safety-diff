# upgrade-safety-diff 0.1.0

A free, zero-dependency command-line tool that compares two Foundry storage layouts (`forge inspect <Contract> storageLayout --json`) before a proxy upgrade. It flags these changes:
- slot or offset shifts
- in-place type or size changes
- deleted variables
- reordering
- variables inserted before existing ones
- struct member changes
- `__gap` arrays that are not shrunk by exactly the slots added
- mapping or array type changes

**What it isn't:** it checks storage layout only and does not prove an upgrade is safe. It does not look at code, initializers, access control or on-chain state.

## Install and run

```
forge inspect MyVaultV1 storageLayout --json > v1.json
forge inspect MyVaultV2 storageLayout --json > v2.json
npx upgrade-safety-diff@0.1.0 v1.json v2.json --fail-on high
```

## Example (OpenZeppelin upgrade-plugin test pair Gap_V1 -> Gap_V2_Bad1)

```
critical 2  high 0  medium 0  info 1
[CRITICAL] C1-slot-shift z: z moved slot 50.0 -> 51.0; the proxy's existing value stays at the old slot
[CRITICAL] C7-gap __gap: __gap ends at slot 50 (was 49): size 48 -> 48 but 1 slot(s) were added before it; it should be 47
[INFO] C5-insert c: new c at slot 2.0 takes space from a __gap
```

The tool agrees with OpenZeppelin's safe/unsafe verdict on all 17 of their storage test pairs that were tested, and with all 13 of its own fixture pairs (see VALIDATION.md).

## Known limits

- ERC-7201 namespaced storage is not analyzed.
- Immutables and constants are not in the layout.
- Inheritance-order changes are caught only when they shift slots.
- No layout from a deployed contract with a documented production collision has been tested.
