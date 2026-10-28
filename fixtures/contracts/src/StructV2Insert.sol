// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract StructV2Insert { struct Pos { uint256 amt; address who; uint64 t; } Pos public pos; mapping(address => Pos) public byUser; uint256 public z; }
