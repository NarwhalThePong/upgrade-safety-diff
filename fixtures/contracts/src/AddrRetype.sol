// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IOracle { function price() external view returns (uint256); }
contract RegistryV1 { address public owner; IOracle public oracle; uint256 public fee; }
contract RegistryV2 { address public owner; address public oracle; uint256 public fee; }
contract RegistryV2Bad { address public owner; uint160 public oracle; uint256 public fee; }
