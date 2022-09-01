// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "./utils/Pausable.sol";


import "./interfaces/IDepositExecute.sol";
import "./interfaces/IERCHandler.sol";
import "./interfaces/IGenericHandler.sol";
import "./interfaces/IFeeHandler.sol";
import "./interfaces/IAccessControlSegregator.sol";

/**
    @title Facilitates deposits and creation of deposit proposals, and deposit executions.
    @author ChainSafe Systems.
 */
contract Bridge is Pausable, Context, EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant _PROPOSALS_TYPEHASH =
        keccak256("Proposals(Proposal[] proposals)Proposal(uint8 originDomainID,uint64 depositNonce,bytes32 resourceID,bytes data)");
    bytes32 private constant _PROPOSAL_TYPEHASH =
        keccak256("Proposal(uint8 originDomainID,uint64 depositNonce,bytes32 resourceID,bytes data)");


    uint8   public immutable _domainID;
    address public _MPCAddress;

    IFeeHandler public _feeHandler;

    IAccessControlSegregator public _accessControl;

    struct Proposal {
        uint8   originDomainID;
        uint64  depositNonce;
        bytes32 resourceID;
        bytes   data;
    }

    // destinationDomainID => number of deposits
    mapping(uint8 => uint64) public _depositCounts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;
    // forwarder address => is Valid
    mapping(address => bool) public isValidForwarder;
    // origin domainID => nonces set => used deposit nonces
    mapping(uint8 => mapping(uint256 => uint256)) public usedNonces;

    event FeeHandlerChanged(address newFeeHandler);
    event AccessControlChanged(address newAccessControl);
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
        uint64  depositNonce,
        bytes32 dataHash
    );

    event FailedHandlerExecution(
        bytes  lowLevelData,
        uint8  originDomainID,
        uint64 depositNonce
    );

    event StartKeygen();

    event EndKeygen();

    event KeyRefresh(string hash);

    event Retry(string txHash);

    modifier onlyAllowed() {
        _onlyAllowed(msg.sig, _msgSender());
        _;
    }

    function _onlyAllowed(bytes4 sig, address sender) private view {
        require(_accessControl.hasAccess(sig, sender), "sender doesn't have access to function");
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
        @notice Initializes Bridge, creates and grants {_msgSender()} the admin role, sets access control
        contract for bridge and sets the inital state of the Bridge to paused.
        @param domainID ID of chain the Bridge contract exists on.
        @param accessControl Address of access control contract.
     */
    constructor (uint8 domainID, address accessControl) EIP712("Bridge", "3.1.0") public {
        _domainID = domainID;
        _accessControl = IAccessControlSegregator(accessControl);

        _pause(_msgSender());
    }

    /**
        @notice Pauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
     */
    function adminPauseTransfers() external onlyAllowed {
        _pause(_msgSender());
    }

    /**
        @notice Unpauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @notice MPC address has to be set before Bridge can be unpaused
     */
    function adminUnpauseTransfers() external onlyAllowed {
        require(_MPCAddress != address(0), "MPC address not set");
        _unpause(_msgSender());
    }

    /**
        @notice Sets a new resource for handler contracts that use the IERCHandler interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetResource(address handlerAddress, bytes32 resourceID, address tokenAddress) external onlyAllowed {
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setResource(resourceID, tokenAddress);
    }

    /**
        @notice Sets a new resource for handler contracts that use the IGenericHandler interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param contractAddress Address of contract to be called when a deposit is made and a deposited is executed.
        @param depositFunctionSig Function signature of method to be called in {contractAddress} when a deposit is made.
        @param depositFunctionDepositorOffset Depositor address position offset in the metadata, in bytes.
        @param executeFunctionSig Function signature of method to be called in {contractAddress} when a deposit is executed.
     */
    function adminSetGenericResource(
        address handlerAddress,
        bytes32 resourceID,
        address contractAddress,
        bytes4 depositFunctionSig,
        uint256 depositFunctionDepositorOffset,
        bytes4 executeFunctionSig
    ) external onlyAllowed {
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IGenericHandler handler = IGenericHandler(handlerAddress);
        handler.setResource(resourceID, contractAddress, depositFunctionSig, depositFunctionDepositorOffset, executeFunctionSig);
    }

    /**
        @notice Sets a resource as burnable for handler contracts that use the IERCHandler interface.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param handlerAddress Address of handler resource will be set for.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetBurnable(address handlerAddress, address tokenAddress) external onlyAllowed {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

    /**
        @notice Sets the nonce for the specific domainID.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param domainID Domain ID for increasing nonce.
        @param nonce The nonce value to be set.
     */
    function adminSetDepositNonce(uint8 domainID, uint64 nonce) external onlyAllowed {
        require(nonce > _depositCounts[domainID], "Does not allow decrements of the nonce");
        _depositCounts[domainID] = nonce;
    }

    /**
        @notice Set a forwarder to be used.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param forwarder Forwarder address to be added.
        @param valid Decision for the specific forwarder.
     */
    function adminSetForwarder(address forwarder, bool valid) external onlyAllowed {
        isValidForwarder[forwarder] = valid;
    }

    /**
        @notice Changes access control contract address.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param newAccessControl Address {_accessControl} will be updated to.
     */
    function adminChangeAccessControl(address newAccessControl) external onlyAllowed {
        _accessControl = IAccessControlSegregator(newAccessControl);
        emit AccessControlChanged(newAccessControl);
    }

    /**
        @notice Changes deposit fee handler contract address.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param newFeeHandler Address {_feeHandler} will be updated to.
     */
    function adminChangeFeeHandler(address newFeeHandler) external onlyAllowed {
        _feeHandler = IFeeHandler(newFeeHandler);
        emit FeeHandlerChanged(newFeeHandler);
    }

    /**
        @notice Used to manually withdraw funds from ERC safes.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param handlerAddress Address of handler to withdraw from.
        @param data ABI-encoded withdrawal params relevant to the specified handler.
     */
    function adminWithdraw(
        address handlerAddress,
        bytes memory data
    ) external onlyAllowed {
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
        require(destinationDomainID != _domainID, "Can't deposit to current domain");

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
        @notice Failed executeProposal from handler don't revert, emits {FailedHandlerExecution} event.
        @param proposal Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @param signature bytes memory signature composed of MPC key shares
        @notice Emits {ProposalExecution} event.
        @notice Behaviour of this function is different for {GenericHandler} and other specific ERC handlers.
        In the case of ERC handler, when execution fails, the handler will terminate the function with revert.
        In the case of {GenericHandler}, when execution fails, the handler will emit a failure event and terminate the function normally.
     */
    function executeProposal(Proposal memory proposal, bytes calldata signature) public whenNotPaused {
        Proposal[] memory proposalArray = new Proposal[](1);
        proposalArray[0] = proposal;

        executeProposals(proposalArray, signature);
    }

    /**
        @notice Executes a batch of deposit proposals using a specified handler contract for each proposal (only if signature is signed by MPC).
        @notice If executeProposals fails it doesn't revert, emits {FailedHandlerExecution} event.
        @param proposals Array of Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @param signature bytes memory signature for the whole array composed of MPC key shares
        @notice Emits {ProposalExecution} event for each proposal in the batch.
        @notice Behaviour of this function is different for {GenericHandler} and other specific ERC handlers.
        In the case of ERC handler, when execution fails, the handler will terminate the function with revert.
        In the case of {GenericHandler}, when execution fails, the handler will emit a failure event and terminate the function normally.
     */
    function executeProposals(Proposal[] memory proposals, bytes calldata signature) public whenNotPaused {
        require(proposals.length > 0, "Proposals can't be an empty array");
        require(verify(proposals, signature), "Invalid proposal signer");

        for (uint256 i = 0; i < proposals.length; i++) {
            if(isProposalExecuted(proposals[i].originDomainID, proposals[i].depositNonce)) {
                continue;
            }

            address handler = _resourceIDToHandlerAddress[proposals[i].resourceID];
            bytes32 dataHash = keccak256(abi.encodePacked(handler, proposals[i].data));

            IDepositExecute depositHandler = IDepositExecute(handler);

            usedNonces[proposals[i].originDomainID][proposals[i].depositNonce / 256] |= 1 << (proposals[i].depositNonce % 256);

            try depositHandler.executeProposal(proposals[i].resourceID, proposals[i].data) {
            } catch (bytes memory lowLevelData) {
                emit FailedHandlerExecution(lowLevelData, proposals[i].originDomainID, proposals[i].depositNonce);
                usedNonces[proposals[i].originDomainID][proposals[i].depositNonce / 256] &= ~(1 << (proposals[i].depositNonce % 256));
                continue;
            }

            emit ProposalExecution(proposals[i].originDomainID, proposals[i].depositNonce, dataHash);
        }
    }

    /**
        @notice Once MPC address is set, this method can't be invoked anymore.
        It's used to trigger the belonging process on the MPC side which also handles keygen function calls order.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
     */
    function startKeygen() external onlyAllowed {
        require(_MPCAddress == address(0), "MPC address is already set");
        emit StartKeygen();
    }

    /**
        @notice This method can be called only once, after the MPC address is set Bridge is unpaused.
        It's used to trigger the belonging process on the MPC side which also handles keygen function calls order.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param MPCAddress Address that will be set as MPC address.
     */
    function endKeygen(address MPCAddress) external onlyAllowed {
        require(MPCAddress != address(0), "MPC address can't be null-address");
        require(_MPCAddress == address(0), "MPC address can't be updated");
        _MPCAddress = MPCAddress;
        _unpause(_msgSender());
        emit EndKeygen();
    }

    /**
        @notice It's used to trigger the belonging process on the MPC side.
        It's used to trigger the belonging process on the MPC side which also handles keygen function calls order.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param hash Topology hash which prevents changes during refresh process.
     */
    function refreshKey(string memory hash) external onlyAllowed {
        emit KeyRefresh(hash);
    }

    /**
        @notice This method is used to trigger the process for retrying failed deposits on the MPC side.
        @notice Only callable by address that has the right to call the specific function,
        which is mapped in {functionAccess} in AccessControlSegregator contract.
        @param txHash Transaction hash which contains deposit that should be retried
        @notice This is not applicable for failed executions on {GenericHandler}
     */
    function retry(string memory txHash) external onlyAllowed {
        emit Retry(txHash);
    }

    /**
        @notice Returns a boolean value.
        @param domainID ID of chain deposit originated from.
        @param depositNonce ID of deposit generated by origin Bridge contract.
        @return Boolean value depending if deposit nonce has already been used or not.
     */
    function isProposalExecuted(uint8 domainID, uint256 depositNonce) public view returns (bool) {
        return usedNonces[domainID][depositNonce / 256] & (1 << (depositNonce % 256)) != 0;
    }

    /**
        @notice Verifies that proposal data is signed by MPC address.
        @param proposals array of Proposals.
        @param signature signature bytes memory signature composed of MPC key shares.
        @return Boolean value depending if signer is vaild or not.
     */
    function verify(Proposal[] memory proposals, bytes calldata signature) public view returns (bool) {
        bytes32[] memory keccakData = new bytes32[](proposals.length);
        for (uint256 i = 0; i < proposals.length; i++) {
            keccakData[i] = keccak256(
                abi.encode(
                    _PROPOSAL_TYPEHASH,
                    proposals[i].originDomainID,
                    proposals[i].depositNonce,
                    proposals[i].resourceID,
                    keccak256(proposals[i].data)
                )
            );
        }

        address signer = _hashTypedDataV4(
          keccak256(abi.encode(
            _PROPOSALS_TYPEHASH, keccak256(abi.encodePacked(keccakData))))
        ).recover(signature);
        return signer == _MPCAddress;
    }
}
