# upgrade-safety-diff

[![npm](https://img.shields.io/npm/v/upgrade-safety-diff.svg)](https://www.npmjs.com/package/upgrade-safety-diff) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Compare two Foundry storage layouts before a proxy upgrade. You give it the layout of the deployed implementation and the layout of the new one, and it lists storage changes that can corrupt proxy state.

**This tool checks storage layout only. It does not prove that an upgrade is safe.** It does not look at code, initializers, reinitializers, access control, `delegatecall` targets, function selectors or runtime state. A clean result means only that no layout problem it knows about was found. It is a review aid, not an audit, and it will miss things.

No dependencies. Node 18+.

## Quick start

No install needed (Node 18+). From a Foundry project:

```
forge inspect MyVaultV1 storageLayout --json > v1.json
forge inspect MyVaultV2 storageLayout --json > v2.json
npx upgrade-safety-diff v1.json v2.json --fail-on high
```

### Example: a variable inserted in the middle

`v1.json` has `owner` (slot 0) and `total` (slot 1). `v2.json` adds `paused` between them:

```
echo '{"storage":[{"astId":1,"contract":"src/V.sol:V","label":"owner","offset":0,"slot":"0","type":"t_address"},{"astId":2,"contract":"src/V.sol:V","label":"total","offset":0,"slot":"1","type":"t_uint256"}],"types":{"t_address":{"encoding":"inplace","label":"address","numberOfBytes":"20"},"t_uint256":{"encoding":"inplace","label":"uint256","numberOfBytes":"32"}}}' > v1.json
echo '{"storage":[{"astId":1,"contract":"src/V.sol:V","label":"owner","offset":0,"slot":"0","type":"t_address"},{"astId":3,"contract":"src/V.sol:V","label":"paused","offset":0,"slot":"1","type":"t_uint256"},{"astId":2,"contract":"src/V.sol:V","label":"total","offset":0,"slot":"2","type":"t_uint256"}],"types":{"t_address":{"encoding":"inplace","label":"address","numberOfBytes":"20"},"t_uint256":{"encoding":"inplace","label":"uint256","numberOfBytes":"32"}}}' > v2.json
npx upgrade-safety-diff v1.json v2.json --fail-on high
```

Output (exit code 1):

```
critical 2  high 0  medium 0  info 0

[CRITICAL] C1-slot-shift total: total moved slot 1.0 -> 2.0; the proxy's existing value stays at the old slot
[CRITICAL] C5-insert paused: new paused at slot 1.0 is declared before existing variables; everything after it shifts
```

Moving `paused` after `total` (or taking it from a `__gap`) clears both findings.

## Usage

```
forge inspect MyVaultV1 storageLayout --json > v1.json
forge inspect MyVaultV2 storageLayout --json > v2.json
node bin/upgrade-safety-diff.js v1.json v2.json
```

`scripts/layout.sh <Contract> [out.json]` wraps the `forge inspect` call.

Options:

| Option | Meaning |
|---|---|
| `--json` | JSON output |
| `--markdown` | Markdown output |
| `--fail-on <severity>` | Exit 1 if any finding is at or above `critical`, `high`, `medium` or `info` |
| `-o, --out <file>` | Write output to a file |

Exit codes: 0 means no finding at or above `--fail-on` (or no `--fail-on` given), 1 means one was found, and 2 means a usage or input error.

## Checks

Variables are matched by name. State variable names are unique across an inheritance chain.

| ID | What it looks for | Severity |
|---|---|---|
| C1-slot-shift | An existing variable's slot or offset changed | critical |
| C2-type-size | Type changed in place: different size / same size, different type / address <-> contract or interface | critical / high / info |
| C3-deleted | Variable removed (its slot can be reused later). A same-slot, same-type name change is reported as a likely rename (info) | high |
| C4-reorder | Surviving variables in a different relative order | high |
| C5-insert | New variable declared before existing ones / reusing a removed variable's slot / taking space from a `__gap` or appended | critical / high / info |
| C6-struct | Struct member removed, moved, retyped or inserted / member appended at the end | critical / high or medium |
| C7-gap | `__gap` end slot moved (gap not shrunk by exactly the slots added), or gap removed without being fully consumed | critical / high |
| C8-mapping-array | Mapping key/value or dynamic-array element type changed, or a static array became dynamic (or the other way round). A mapping value that only grows at its end (a longer fixed array, or struct members appended) is info | critical / info |

Type comparison ignores compiler AST ids and contract-name prefixes, so `struct V1.Pos` and `struct V2.Pos` with the same members compare equal.

## Example

The npm package ships a few example layouts (and their Solidity sources) in `examples/`. Pass `example:<name>` instead of a file path to use them, so this runs from an empty folder: `PlainV1`, `PlainV2Insert`, `AddrRetype_RegistryV1`, `AddrRetype_RegistryV2`, `AddrRetype_RegistryV2Bad` (see `--help`).

```
$ npx upgrade-safety-diff example:PlainV1 example:PlainV2Insert
upgrade-safety-diff: example:PlainV1 -> example:PlainV2Insert
critical 2  high 0  medium 0  info 0

[CRITICAL] C1-slot-shift owner: owner moved slot 1.0 -> 2.0; the proxy's existing value stays at the old slot
[CRITICAL] C5-insert c: new c at slot 1.0 is declared before existing variables; everything after it shifts
```

### Interface to address retype (new in 0.1.2)

Changing `IOracle public oracle;` to `address public oracle;` keeps the same 20-byte value, but layout checkers often reject it and push people to skip the whole check (see [OpenZeppelin/openzeppelin-upgrades#687](https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/687)). `address`, `address payable` and contract/interface types are now treated as compatible and reported at `info`. A retype to a different kind of value (for example `uint160`) is still `high`:

```
$ npx upgrade-safety-diff example:AddrRetype_RegistryV1 example:AddrRetype_RegistryV2 --fail-on high
[INFO] C2-type-size oracle: oracle contract IOracle -> address: both are 20-byte addresses, the stored value is read the same way
$ echo $?
0
$ npx upgrade-safety-diff example:AddrRetype_RegistryV1 example:AddrRetype_RegistryV2Bad --fail-on high
[HIGH] C2-type-size oracle: oracle contract IOracle -> uint160 (same size); existing bits are reinterpreted
```

## Known limits

- Storage layout only. There is no bytecode, initializer or runtime check, and the tool does not read any chain.
- ERC-7201 / namespaced storage (`@custom:storage-location`) does not appear in `storageLayout` and is not analyzed. Variables in namespaced structs are invisible to this tool.
- `immutable` and `constant` values are not in the storage layout and are not compared.
- Changes to inheritance order are caught only through their effects (shifted slots, moved gaps). The tool does not report "the base contract order changed" as such.
- Validation used purpose-built fixtures and OpenZeppelin's upgrade-plugin test pairs. No layout from a deployed contract with a documented production collision has been tested.
- Variables are matched by name. A rename combined with a type or slot change is reported as a delete plus an insert.
- Gaps are recognized by the name `__gap` / `_gap` / `gap`. Differently named reserve arrays are treated as normal variables.
- Enum widening past 256 members, function-type visibility and user-defined value types are compared only by their label and size.
- Treat severities as defaults for review priority, not as proof of exploitability.

## Tests

`npm test` runs every check against compiled fixture pairs (`fixtures/contracts`, built with forge 1.8.5 and solc 0.8.24) and against storage-layout test pairs taken from OpenZeppelin's `openzeppelin-upgrades` repository. See `VALIDATION.md`.

Want a hand with a pre-audit review of a Solidity project? The [Smart Contract Pre-Audit Review Pack](https://payhip.com/b/G5agO) is a self-review aid with a 66-item checklist, a 40-point audit-readiness scoring sheet and scope/known-issues/threat-model templates. It is not an audit and gives no security guarantee ($19, our own paid product).

## License

MIT
