// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MapV1 { mapping(address => uint256) public bal; uint256[] public list; mapping(address => mapping(uint256 => bool)) public used; }
