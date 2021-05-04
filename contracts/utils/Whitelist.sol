// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "./AccessControl.sol";

contract Whitelist is AccessControl {
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");

    modifier onlyWhitelistOrAdmin() {
        _onlyWhitelistOrAdmin();
        _;
    }

    function _onlyWhitelistOrAdmin() private view {
        require(hasRole(WHITELIST_ROLE, msg.sender)
            || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "sender doesn't have whitelist or admin role");
    }
}
