pragma solidity 0.6.4;

import "../interfaces/IERCHandler.sol";

/**
    @title Function used across handler contracts.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
contract HandlerHelpers is IERCHandler {
    address public _bridgeAddress;

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    // token contract address => is burnable
    mapping (address => bool) public _burnList;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    /**
        @notice First verifies {_resourceIDToContractAddress}[{resourceID}] and
        {_contractAddressToResourceID}[{contractAddress}] are not already set,
        then sets {_resourceIDToContractAddress} with {contractAddress},
        {_contractAddressToResourceID} with {resourceID},
        and {_contractWhitelist} to true for {contractAddress}.
        @param resourceID ResourceID to be used when making deposits.
        @param contractAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function setResource(bytes32 resourceID, address contractAddress) public override _onlyBridge {
        require(_resourceIDToTokenContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _tokenContractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResource(resourceID, contractAddress);
    }

    /**
        @notice First verifies {contractAddress} is whitelisted, then sets {_burnList}[{contractAddress}]
        to true.
        @param contractAddress Address of contract to be used when making or executing deposits.
     */
    function setBurnable(address contractAddress) public override _onlyBridge{
        _setBurnable(contractAddress);
    }

    function createResourceID (address tokenAddress, uint8 chainID) internal pure returns (bytes32) {
        bytes11 padding;
        bytes memory encodedResourceID = abi.encodePacked(padding, abi.encodePacked(tokenAddress, chainID));
        bytes32 resourceID;

        assembly {
            resourceID := mload(add(encodedResourceID, 0x20))
        }

        return resourceID;
    }

    /**
        @notice Used to manually release funds from ERC safes.
        @param tokenAddress Address of token contract to release.
        @param recipient Address to release tokens to.
        @param amountOrTokenID Either the amount of ERC20 tokens or the ERC721 token ID to release.
     */
    function withdraw(address tokenAddress, address recipient, uint256 amountOrTokenID) public virtual override {}

    function _setResource(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;

        _contractWhitelist[contractAddress] = true;
    }

    function _setBurnable(address contractAddress) internal {
        require(_contractWhitelist[contractAddress], "provided contract is not whitelisted");
        _burnList[contractAddress] = true;
    }
}
