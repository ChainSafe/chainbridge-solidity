// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint8 private customDecimals;
    uint256 public cap;

    constructor(
        string memory name,
        string memory symbol,
        uint8 _decimals,
        uint256 _cap,
        address[] memory _mintAddresses,
        uint256[] memory _mintAmounts
    )
    ERC20(name, symbol)
    {
        require(_cap > 0, "Cannot have 0 total supply.");
        require(_mintAddresses.length == _mintAmounts.length, "must have same number of mint addresses and amounts");
        customDecimals = _decimals;
        cap = _cap;

        for (uint i; i < _mintAddresses.length; i++) {
            require(_mintAddresses[i] != address(0), "Cannot have a non-address as reserve.");
            require(totalSupply() + _mintAmounts[i] <= cap, "total supply of tokens cannot exceed the cap");
            _mint(_mintAddresses[i], _mintAmounts[i]);
        }
    }

    function decimals() public view override returns (uint8) {
        return customDecimals;
    }
}
