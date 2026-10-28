# Validation

Date: 2026-10-27. Tool version 0.1.0.

## Method

Each check counts as validated only if it fires at medium or above on at least one unsafe pair and stays below medium on every safe pair. `npm test` enforces this (36 tests: 30 pair tests, one cross-check over all pairs, and 5 unit/CLI tests).

## Fixture sets

1. **Own fixtures** (`fixtures/contracts/src`, 18 plain contracts with no imports). Built offline with forge 1.8.5 (51a52c5) and solc 0.8.24: `forge build --offline` reported "Compiler run successful" (lint notes only). Layouts were produced with `forge inspect --offline <C> storageLayout --json` into `fixtures/layouts`. They cover safe append, insert in the middle, reorder, type widening (packed), same-size retype, deleted variable, gap consumed correctly, gap not reduced, gap over-reduced, struct member insertion, unchanged struct with an appended variable, and mapping/array type changes.
2. **OpenZeppelin upgrade-plugin test pairs**: `https://github.com/OpenZeppelin/openzeppelin-upgrades`, commit `f7d167d1d2fad050797f347848102d7c04e60cbe`, file `packages/core/contracts/test/Storage.sol`. Each pair's expected verdict comes from `packages/core/src/storage.test.ts` at the same commit: an empty error list means safe, and errors mean unsafe. The 26 contracts were copied verbatim into `fixtures/oz-upgrades/Storage.sol`. The only change is that the pragma was widened from `^0.6.8` to `>=0.6.8`, so they compile with solc 0.8.24 (no 0.6 compiler is installed and the box has no network installs). Built offline with "Compiler run successful". Layouts are in `fixtures/oz-upgrades/layouts`.
   - Real safe upgrade examples include `Gap_V1 -> Gap_V2_Ok` (gap shrunk by the slots added), `Struct_V1 -> Struct_V2_Ok` and `Append_V1 -> Append_V2`.
   - Real collision examples include `Gap_V1 -> Gap_V2_Bad1` (a variable was added but the gap was not shrunk, so `z` shifts from slot 50 to 51) and `Delete_V1 -> Delete_V2`.

**Not covered: no production on-chain collision.** These are upgrade-plugin reference test cases, not layouts taken from a deployed contract that suffered a documented collision. I did not find a public, login-free source for a documented past production collision with both layouts available, so none was tested. I did not substitute a mutant of my own for one.

**Independence caveat.** On the first run against the OpenZeppelin pairs the tool reported 4 false positives on safe pairs:
- `Struct_V2_Ok`: struct names were compared.
- `Array_V2_Ok`: a growing mapping-value array was flagged.
- `Gap_V2_Ok`: a new variable inside the gap was reported as "inserted before".
- `MultiConsumeGap_V2_Ok`: a fully consumed gap was reported as removed.

I fixed these, so the OpenZeppelin pairs are not an untouched holdout. All 11 unsafe pairs were flagged both before and after the fixes. The tool now agrees with OpenZeppelin's verdict on all 17 pairs.

## Pair results (from the current code)

| Source | Old -> New | Expected | Medium+ findings | Info |
|---|---|---|---|---|
| own | PlainV1 -> PlainV2Append | safe | none | 1 |
| own | PlainV1 -> PlainV2Insert | unsafe | C1-slot-shift (critical), C5-insert (critical) | 0 |
| own | PlainV1 -> PlainV2Reorder | unsafe | C1-slot-shift (critical), C4-reorder (high) | 0 |
| own | PlainV1 -> PlainV2Deleted | unsafe | C3-deleted (high) | 0 |
| own | PackV1 -> PackV2Widen | unsafe | C2-type-size (critical), C1-slot-shift (critical) | 0 |
| own | PackV1 -> PackV2Retype | unsafe | C2-type-size (high) | 0 |
| own | GapV1 -> GapV2Ok | safe | none | 3 |
| own | GapV1 -> GapV2NotReduced | unsafe | C7-gap (critical) | 1 |
| own | GapV1 -> GapV2OverReduced | unsafe | C7-gap (critical) | 1 |
| own | StructV1 -> StructV2Insert | unsafe | C6-struct (critical), C8-mapping-array (critical) | 0 |
| own | StructV1 -> StructV2Same | safe | none | 1 |
| own | MapV1 -> MapV2Changed | unsafe | C8-mapping-array (critical) | 0 |
| own | MapV1 -> MapV2Same | safe | none | 0 |
| OZ | StorageUpgrade_Equal_V1 -> StorageUpgrade_Equal_V2 | safe | none | 0 |
| OZ | StorageUpgrade_Append_V1 -> StorageUpgrade_Append_V2 | safe | none | 1 |
| OZ | StorageUpgrade_Delete_V1 -> StorageUpgrade_Delete_V2 | unsafe | C1-slot-shift (critical), C3-deleted (high) | 0 |
| OZ | StorageUpgrade_Replace_V1 -> StorageUpgrade_Replace_V2 | unsafe | C5-insert (critical), C3-deleted (high) | 0 |
| OZ | StorageUpgrade_Struct_V1 -> StorageUpgrade_Struct_V2_Ok | safe | none | 1 |
| OZ | StorageUpgrade_Struct_V1 -> StorageUpgrade_Struct_V2_Bad | unsafe | C6-struct (critical), C1-slot-shift (critical), C8-mapping-array (critical), C2-type-size (critical), C6-struct (high) | 0 |
| OZ | StorageUpgrade_Array_V1 -> StorageUpgrade_Array_V2_Ok | safe | none | 1 |
| OZ | StorageUpgrade_Array_V1 -> StorageUpgrade_Array_V2_Bad | unsafe | C2-type-size (critical), C1-slot-shift (critical), C8-mapping-array (critical) | 0 |
| OZ | StorageUpgrade_Mapping_V1 -> StorageUpgrade_Mapping_V2_Ok | safe | none | 0 |
| OZ | StorageUpgrade_Mapping_V1 -> StorageUpgrade_Mapping_V2_Bad | unsafe | C8-mapping-array (critical) | 0 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Ok | safe | none | 2 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Bad1 | unsafe | C1-slot-shift (critical), C7-gap (critical) | 1 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Bad2 | unsafe | C3-deleted (high) | 1 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Bad3 | unsafe | C1-slot-shift (critical), C7-gap (critical) | 0 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Bad4 | unsafe | C1-slot-shift (critical), C7-gap (critical) | 1 |
| OZ | StorageUpgrade_Gap_V1 -> StorageUpgrade_Gap_V2_Bad5 | unsafe | C1-slot-shift (critical), C7-gap (critical) | 2 |
| OZ | StorageUpgrade_MultiConsumeGap_V1 -> StorageUpgrade_MultiConsumeGap_V2_Ok | safe | none | 3 |

| Check | Fires on unsafe pairs | Fires (medium+) on any safe pair |
|---|---|---|
| C1-slot-shift | 10 (PlainV2Insert, PlainV2Reorder, PackV2Widen, OZ:Delete_V2, OZ:Struct_V2_Bad, OZ:Array_V2_Bad, OZ:Gap_V2_Bad1, OZ:Gap_V2_Bad3, OZ:Gap_V2_Bad4, OZ:Gap_V2_Bad5) | no |
| C2-type-size | 4 (PackV2Widen, PackV2Retype, OZ:Struct_V2_Bad, OZ:Array_V2_Bad) | no |
| C3-deleted | 4 (PlainV2Deleted, OZ:Delete_V2, OZ:Replace_V2, OZ:Gap_V2_Bad2) | no |
| C4-reorder | 1 (PlainV2Reorder) | no |
| C5-insert | 2 (PlainV2Insert, OZ:Replace_V2) | no |
| C6-struct | 2 (StructV2Insert, OZ:Struct_V2_Bad) | no |
| C7-gap | 6 (GapV2NotReduced, GapV2OverReduced, OZ:Gap_V2_Bad1, OZ:Gap_V2_Bad3, OZ:Gap_V2_Bad4, OZ:Gap_V2_Bad5) | no |
| C8-mapping-array | 5 (StructV2Insert, MapV2Changed, OZ:Struct_V2_Bad, OZ:Array_V2_Bad, OZ:Mapping_V2_Bad) | no |

Result: all 8 checks fire on at least one unsafe pair, and none fires at medium or above on any of the 9 safe pairs. C4-reorder and C5-insert (critical) have the thinnest coverage, with 1 and 2 unsafe pairs. The `medium` severity (a struct member appended without a size change) is not exercised by any fixture.

## Not covered

- ERC-7201 / namespaced storage. It is not in `storageLayout` and is not analyzed beyond the README note.
- Inheritance order changes. These are caught only through their slot effects. The OpenZeppelin `EndGap` inheritance pairs were not run.
- `immutable` / `constant`. They are not in the layout.
- No runtime verification: no fork test, no reading of the proxy's real slots, no bytecode comparison, no initializer checks.
- Renames combined with a type change, enums past 256 members, function-type visibility, user-defined value types and differently named reserve arrays are only partly handled (see the README's Known limits).

This is a heuristic review aid. It does not catch every unsafe upgrade, and a clean result does not prove an upgrade is safe.
