// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

/**
    @title Handles access control per contract function.
    @author ChainSafe Systems.
    @notice This contract is intended to be used by the Bridge contract.
 */
contract AccessControlSegregator {
    // function => address has access
    mapping(string => address) public _functionAccess;

    /**
        @notice Initializes access control to functions and sets initial
        access to grantAccess function.
        @param functions List of functions to be granted access to.
        @param accounts List of accounts.
    */
    constructor(string[] memory functions, address[] memory accounts) public {
        require(accounts.length == functions.length, "array length should be equal");

        _grantAccess("grantAccess", msg.sender);
        for (uint i=0; i < accounts.length; i++) {
            _grantAccess(functions[i], accounts[i]);
        }
    }

    /**
        @notice Returns boolean value if account has access to function.
        @param func Function name.
        @param account Address of account.
        @return Boolean value depending if account has access.
    */
    function hasAccess(string memory func, address account) public view returns (bool)  {
        return _functionAccess[func] == account;
    }

    /**
        @notice Grants access to an account for a function.
        @notice Set account to zero address to revoke access.
        @param func Function name.
        @param account Address of account.
    */
    function grantAccess(string memory func, address account) public {
        require(hasAccess(func, account), "account doesn't have access");
        _grantAccess(func, account);
    }

    function _grantAccess(string memory func, address account) private {
        _functionAccess[func] = account;
    }
}
