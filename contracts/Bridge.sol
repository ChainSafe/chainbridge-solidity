// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./utils/AccessControl.sol";
import "./utils/Pausable.sol";
import "./utils/SafeMath.sol";
import "./utils/SafeCast.sol";

import "./interfaces/IDepositExecute.sol";
import "./interfaces/IERCHandler.sol";
import "./interfaces/IGenericHandler.sol";
import "./interfaces/IFeeHandler.sol";

/**
    @title Facilitates deposits and creation of deposit proposals, and deposit executions.
    @author ChainSafe Systems.
 */
contract Bridge is Pausable, AccessControl, SafeMath {
    using SafeCast for *;
    using ECDSA for bytes32;




    uint8   public _domainID;
    address public _MPCAddress;

    IFeeHandler public _feeHandler;

    // destinationDomainID => number of deposits
    mapping(uint8 => uint64) public _depositCounts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;
    // forwarder address => is Valid
    mapping(address => bool) public isValidForwarder;
    // origin domainID => nonces set => used deposit nonces
    mapping(uint8 => mapping(uint256 => uint256)) public usedNonces;

    event FeeHandlerChanged(address newFeeHandler);
    event Deposit(
        uint8   destinationDomainID,
        bytes32 resourceID,
        uint64  depositNonce,
        address indexed user,
        bytes   data,
        bytes   handlerResponse
    );
    event ProposalExecution(
        uint8   originDomainID,
        uint8   destinationDomainID,
        uint64  depositNonce,
        bytes32 dataHash
    );
    event FailedHandlerExecution(
        bytes lowLevelData
    );

    event StartKeygen();

    event EndKeygen();

    event KeyRefresh();

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    function _onlyAdmin() private view {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "sender doesn't have admin role");
    }

    function _msgSender() internal override view returns (address) {
        address signer = msg.sender;
        if (msg.data.length >= 20 && isValidForwarder[signer]) {
            assembly {
                signer := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        }
        return signer;
    }

    /**
        @notice Initializes Bridge, creates and grants {_msgSender()} the admin role and
        sets the inital state of the Bridge to paused.
        @param domainID ID of chain the Bridge contract exists on.
     */
    constructor (uint8 domainID) public {
        _domainID = domainID;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _pause(_msgSender());
    }

    /**
        @notice Removes admin role from {_msgSender()} and grants it to {newAdmin}.
        @notice Only callable by an address that currently has the admin role.
        @param newAdmin Address that admin role will be granted to.
     */
    function renounceAdmin(address newAdmin) external onlyAdmin {
        address sender = _msgSender();
        require(sender != newAdmin, 'Cannot renounce oneself');
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, sender);
    }

    /**
        @notice Pauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
     */
    function adminPauseTransfers() external onlyAdmin {
        _pause(_msgSender());
    }

    /**
        @notice Unpauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
        @notice MPC address has to be set before Bridge can be unpaused
     */
    function adminUnpauseTransfers() external onlyAdmin {
        require(_MPCAddress != address(0), "MPC address not set");
        _unpause(_msgSender());
    }

    /**
        @notice Sets a new resource for handler contracts that use the IERCHandler interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetResource(address handlerAddress, bytes32 resourceID, address tokenAddress) external onlyAdmin {
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setResource(resourceID, tokenAddress);
    }

    /**
        @notice Sets a new resource for handler contracts that use the IGenericHandler interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param contractAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetGenericResource(
        address handlerAddress,
        bytes32 resourceID,
        address contractAddress,
        bytes4 depositFunctionSig,
        uint256 depositFunctionDepositerOffset,
        bytes4 executeFunctionSig
    ) external onlyAdmin {
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IGenericHandler handler = IGenericHandler(handlerAddress);
        handler.setResource(resourceID, contractAddress, depositFunctionSig, depositFunctionDepositerOffset, executeFunctionSig);
    }

    /**
        @notice Sets a resource as burnable for handler contracts that use the IERCHandler interface.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetBurnable(address handlerAddress, address tokenAddress) external onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

    /**
        @notice Sets the nonce for the specific domainID.
        @notice Only callable by an address that currently has the admin role.
        @param domainID Domain ID for increasing nonce.
        @param nonce The nonce value to be set.
     */
    function adminSetDepositNonce(uint8 domainID, uint64 nonce) external onlyAdmin {
        require(nonce > _depositCounts[domainID], "Does not allow decrements of the nonce");
        _depositCounts[domainID] = nonce;
    }

    /**
        @notice Set a forwarder to be used.
        @notice Only callable by an address that currently has the admin role.
        @param forwarder Forwarder address to be added.
        @param valid Decision for the specific forwarder.
     */
    function adminSetForwarder(address forwarder, bool valid) external onlyAdmin {
        isValidForwarder[forwarder] = valid;
    }

    /**
        @notice Changes deposit fee handler contract address.
        @notice Only callable by admin.
        @param newFeeHandler Address {_feeHandler} will be updated to.
     */
    function adminChangeFeeHandler(address newFeeHandler) external onlyAdmin {
        _feeHandler = IFeeHandler(newFeeHandler);
        emit FeeHandlerChanged(newFeeHandler);
    }

    /**
        @notice Used to manually withdraw funds from ERC safes.
        @param handlerAddress Address of handler to withdraw from.
        @param data ABI-encoded withdrawal params relevant to the specified handler.
     */
    function adminWithdraw(
        address handlerAddress,
        bytes memory data
    ) external onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.withdraw(data);
    }

    /**
        @notice Initiates a transfer using a specified handler contract.
        @notice Only callable when Bridge is not paused.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID used to find address of handler to be used for deposit.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
        @notice Emits {Deposit} event with all necessary parameters and a handler response.
        - ERC20Handler: responds with an empty data.
        - ERC721Handler: responds with the deposited token metadata acquired by calling a tokenURI method in the token contract.
        - GenericHandler: responds with the raw bytes returned from the call to the target contract.
     */
    function deposit(uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) external payable whenNotPaused {
        address sender = _msgSender();
        if (address(_feeHandler) == address(0)) {
            require(msg.value == 0, "no FeeHandler, msg.value != 0");
        } else {
            // Reverts on failure
            _feeHandler.collectFee{value: msg.value}(sender, _domainID, destinationDomainID, resourceID, depositData, feeData);
        }

        address handler = _resourceIDToHandlerAddress[resourceID];
        require(handler != address(0), "resourceID not mapped to handler");

        uint64 depositNonce = ++_depositCounts[destinationDomainID];

        IDepositExecute depositHandler = IDepositExecute(handler);
        bytes memory handlerResponse = depositHandler.deposit(resourceID, sender, depositData);

        emit Deposit(destinationDomainID, resourceID, depositNonce, sender, depositData, handlerResponse);
    }

    /**
        @notice Executes a deposit proposal using a specified handler contract (only if signature is signed by MPC).
        @param domainID ID of chain deposit originated from.
        @param destinationDomainID ID of chain deposit will be executed.
        @param resourceID ResourceID to be used when making deposits.
        @param depositNonce ID of deposit generated by origin Bridge contract.
        @param data Data originally provided when deposit was made.
        @param signature bytes memory signature composed of MPC key shares
        @param revertOnFail Decision if the transaction should be reverted in case of handler's executeProposal is reverted or not.
        @notice Emits {ProposalExecution} event.
        @notice Emits {FailedExecution} event with the failed reason.
     */
    function executeProposal(uint8 domainID, uint8 destinationDomainID, uint64 depositNonce, bytes calldata data, bytes32 resourceID, bytes calldata signature, bool revertOnFail) public whenNotPaused {
        require(isProposalExecuted(domainID, depositNonce) != true, "Deposit with provided nonce already executed");

        address signer = keccak256(abi.encodePacked(domainID, destinationDomainID, depositNonce, data, resourceID)).recover(signature);
        require(signer == _MPCAddress, "Invalid message signer");

        address handler = _resourceIDToHandlerAddress[resourceID];
        bytes32 dataHash = keccak256(abi.encodePacked(handler, data));

        IDepositExecute depositHandler = IDepositExecute(handler);

        usedNonces[domainID][depositNonce/256] |= 1 << (depositNonce % 256);

        if (revertOnFail) {
            depositHandler.executeProposal(resourceID, data);
        } else {
            try depositHandler.executeProposal(resourceID, data) {
            } catch (bytes memory lowLevelData) {
                emit FailedHandlerExecution(lowLevelData);
                return;
            }
        }

        emit ProposalExecution(domainID,destinationDomainID, depositNonce, dataHash);
    }

    /**
        @notice Transfers eth in the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1.
        This means that the address at index 0 for addrs will receive the amount (in WEI) from amounts at index 0.
        @param addrs Array of addresses to transfer {amounts} to.
        @param amounts Array of amonuts to transfer to {addrs}.
     */
    function transferFunds(address payable[] calldata addrs, uint[] calldata amounts) external onlyAdmin {
        for (uint256 i = 0; i < addrs.length; i++) {
            addrs[i].transfer(amounts[i]);
        }
    }

    /**
        @notice Once MPC address is set, this method can't be invoked anymore.
     */
    function startKeygen() external onlyAdmin {
      require(_MPCAddress == address(0), "MPC address is already set");
      emit StartKeygen();
    }

    /**
        @notice This method can be called only once, after the MPC address is set Bridge is unpaused.
        @param MPCAddress Address that will be set as MPC address.
     */
    function endKeygen(address MPCAddress) external onlyAdmin {
      require(MPCAddress != address(0), "MPC address can't be null-address");
      require(_MPCAddress == address(0), "MPC address can't be updated");
      _MPCAddress = MPCAddress;
      _unpause(_msgSender());
      emit EndKeygen();
    }

    function refreshKey() external onlyAdmin {
      emit KeyRefresh();
    }

    /**
        @notice Returns a boolean value.
        @param domainID ID of chain deposit originated from.
        @param depositNonce ID of deposit generated by origin Bridge contract.
        @return Boolean value depending if deposit nonce has already been used or not.
     */
    function isProposalExecuted(uint8 domainID, uint256 depositNonce) public view returns (bool) {
      return usedNonces[domainID][depositNonce/256] & (1 << (depositNonce%256)) != 0;
    }
}
