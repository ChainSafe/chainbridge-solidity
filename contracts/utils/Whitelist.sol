// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "./AccessControl.sol";

contract Whitelist is AccessControl {
    event WhitelistEnabled();
    event WhitelistDisabled();

    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");

    bool private _isWhitelistEnabled;

    modifier onlyWhitelistOrAdmin() {
        _onlyWhitelistOrAdmin();
        _;
    }

    function enableWhitelist() external onlyWhitelistOrAdmin {
        require(!_isWhitelistEnabled, "Whitelist is already enabled");
        _isWhitelistEnabled = true;
        emit WhitelistEnabled();
    }

    function disableWhitelist() external onlyWhitelistOrAdmin {
        require(_isWhitelistEnabled, "Whitelist is already disabled");
        _isWhitelistEnabled = false;
        emit WhitelistDisabled();
    }

    function isWhitelistEnabled() external view returns (bool) {
        return _isWhitelistEnabled;
    }

    function _onlyWhitelistOrAdmin() private view {
        require(hasRole(WHITELIST_ROLE, msg.sender)
            || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Sender doesn't have Whitelist or Admin role");
    }
}
