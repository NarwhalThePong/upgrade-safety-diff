// SPDX-License-Identifier: MIT
pragma solidity >=0.6.8;
// Extracted verbatim from OpenZeppelin/openzeppelin-upgrades packages/core/contracts/test/Storage.sol (commit f7d167d1d2fad050797f347848102d7c04e60cbe); only the pragma was widened.
contract StorageUpgrade_Equal_V1 {
  uint x1;
  function foo() external {}
}

contract StorageUpgrade_Equal_V2 {
  uint x1;
  function foo() external {}
  function bar() external {}
}

contract StorageUpgrade_Append_V1 {
  uint x1;
}

contract StorageUpgrade_Append_V2 {
  uint x1;
  uint x2;
}

contract StorageUpgrade_Delete_V1 {
  uint x1;
  address x2;
}

contract StorageUpgrade_Delete_V2 {
  address x2;
}

contract StorageUpgrade_Struct_V1 {
    struct StructInner {
        uint y;
    }
    struct Struct1 {
        uint x;
        string s1;
        string s2;
        StructInner inner;
    }
    Struct1 data1;
    Struct1 data2;
    mapping (uint => Struct1) m;
    Struct1[10] a1;
    Struct1[10] a2;
    Struct1 data3;
}

contract StorageUpgrade_Struct_V2_Ok {
    struct StructInner {
        uint y;
    }
    struct Struct2 {
        uint x;
        string s1;
        string s2;
        StructInner inner;
    }
    struct Struct2Plus {
        uint x;
        string s1;
        string s2;
        StructInner inner;
        uint z;
    }
    Struct2 data1;
    Struct2 data2;
    mapping (uint => Struct2Plus) m;
    Struct2[10] a1;
    Struct2[10] a2;
    Struct2 data3;
}

contract StorageUpgrade_Struct_V2_Bad {
    struct StructInner {
        uint y;
    }
    struct StructInnerPlus {
        uint y;
        uint z;
    }
    struct Struct2Minus {
        uint x;
        string s2;
        StructInner inner;
    }
    struct Struct2Plus {
        uint x;
        string s1;
        string s2;
        StructInner inner;
        uint z;
    }
    struct Struct2Changed {
        string x;
        uint s1;
        string s2;
        StructInnerPlus inner;
    }
    Struct2Minus data1;
    Struct2Plus data2;
    mapping (uint => Struct2Minus) m;
    Struct2Minus[10] a1;
    Struct2Plus[10] a2;
    Struct2Changed data3;
}

contract StorageUpgrade_Replace_V1 {
    uint x1;
    uint x2;
    uint x3;
}

contract StorageUpgrade_Replace_V2 {
    uint x1;
    string renamed;
    uint x3;
}

contract StorageUpgrade_Array_V1 {
    uint[20] x1;
    uint[20] x2;
    uint[20] x3;
    uint[] x4;
    mapping (uint => uint[20]) m;
}

contract StorageUpgrade_Array_V2_Ok {
    uint[20] x1;
    uint[20] x2;
    uint[20] x3;
    uint[] x4;
    mapping (uint => uint[25]) m;
}

contract StorageUpgrade_Array_V2_Bad {
    uint[15] x1;
    uint[25] x2;
    uint[] x3;
    uint[20] x4;
    mapping (uint => uint[15]) m;
}

contract StorageUpgrade_Mapping_V1 {
    mapping (uint => uint[10]) m1;
    mapping (string => uint) m2;
}

contract StorageUpgrade_Mapping_V2_Ok {
    mapping (uint => uint[10]) m1;
    mapping (string => uint) m2;
}

contract StorageUpgrade_Mapping_V2_Bad {
    mapping (uint => uint) m1;
    mapping (bool => uint) m2;
}

enum E1 { A, B }
enum E2_Ok { A, B, C }
enum E2_Bad { X, Y }

contract StorageUpgrade_Gap_V1 {
    uint256 a;
    uint256 b;
    uint256[48] __gap;
    uint256 z;
}

contract StorageUpgrade_Gap_V2_Ok {
    uint256 a;
    uint256 b;
    uint256 c;
    uint256[47] __gap;
    uint256 z;
}

// insert var without shrink gap
contract StorageUpgrade_Gap_V2_Bad1 {
    uint256 a;
    uint256 b;
    uint256 c;
    uint256[48] __gap;
    uint256 z;
}

// delete var and expand gap
contract StorageUpgrade_Gap_V2_Bad2 {
    uint256 a;
    uint256[49] __gap;
    uint256 z;
}

// shrink gap without adding var
contract StorageUpgrade_Gap_V2_Bad3 {
    uint256 a;
    uint256 b;
    uint256[47] __gap;
    uint256 z;
}

// insert var and shrink gap too much
contract StorageUpgrade_Gap_V2_Bad4 {
    uint256 a;
    uint256 b;
    uint256 c;
    uint256[46] __gap;
    uint256 z;
}

// insert vars and shrink gap not enough
contract StorageUpgrade_Gap_V2_Bad5 {
    uint256 a;
    uint256 b;
    uint256 c;
    uint256 d;
    uint256[47] __gap;
    uint256 z;
}

contract StorageUpgrade_MultiConsumeGap_V1 {
    uint256[2] __gap;
}

contract StorageUpgrade_MultiConsumeGap_V2_Ok {
    uint256 a;
    uint256 b;
}

