pragma solidity 0.6.12;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";


contract ERC20Custom is ERC20PresetMinterPauser {

    /**
     * @dev Allows overriding the name, symbol & decimal of the base ERC20 contract
     */
    constructor(string memory name, string memory symbol, uint8 decimals) public ERC20PresetMinterPauser(name, symbol) {
        _setupDecimals(decimals);
    }
}
