pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IDepositExecute.sol";
import "./interfaces/IBridge.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IERCHandler.sol";
import "./interfaces/IGenericHandler.sol";

/**
    @title Facilitates deposits, creation and votiing of deposit proposals, and deposit executions.
    @author ChainSafe Systems.
 */
contract Bridge is Pausable, AccessControl {
    using SafeMath for uint;

    uint8   public _chainID;
    uint256 public _relayerThreshold;
    uint256 public _totalRelayers;
    uint256 public _totalProposals;
    uint256 public _fee;

    enum Vote {No, Yes}
    enum ProposalStatus {Inactive, Active, Passed, Transferred}

    struct Proposal {
        bytes32         _dataHash;
        address[]       _yesVotes;
        address[]       _noVotes;
        ProposalStatus  _status;
    }

    // destinationChainID => number of deposits
    mapping(uint8 => uint64) public _depositCounts;
    // destinationChainID => depositNonce => bytes
    mapping(uint8 => mapping(uint64 => bytes)) public _depositRecords;
    // destinationChainID => depositNonce => Proposal
    mapping(uint8 => mapping(uint64 => Proposal)) public _proposals;
    // destinationChainID => depositNonce => relayerAddress => bool
    mapping(uint8 => mapping(uint64 => mapping(address => bool))) public _hasVotedOnProposal;

    event RelayerThresholdChanged(uint indexed newThreshold);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event Deposit(
        uint8   indexed destinationChainID,
        address indexed handlerAddress,
        uint64 indexed depositNonce
    );
    event ProposalCreated(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint64 indexed depositNonce,
        bytes32         dataHash
    );
    event ProposalVote(
        uint8   indexed       originChainID,
        uint8   indexed       destinationChainID,
        uint64 indexed       depositNonce,
        ProposalStatus status
    );
    event ProposalFinalized(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint64 indexed depositNonce
    );
    event ProposalExecuted(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint64 indexed depositNonce
    );

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "sender does not have admin role");
        _;
    }

    modifier onlyRelayers() {
        require(hasRole(RELAYER_ROLE, msg.sender), "sender does not have relayer role");
        _;
    }

    /**
        @notice Initializes Bridge, creates and grants {msg.sender} the admin role,
        creates and grants {initialRelayers} the relayer role.
        @param chainID ID of chain the Bridge contract exists on.
        @param initialRelayers Addresses that should be initially granted the relayer role.
        @param initialRelayerThreshold Number of votes needed for a deposit proposal to be considered passed.
     */
    constructor (uint8 chainID, address[] memory initialRelayers, uint initialRelayerThreshold, uint256 fee) public {
        _chainID = chainID;
        _relayerThreshold = initialRelayerThreshold;
        _fee = fee;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(RELAYER_ROLE, DEFAULT_ADMIN_ROLE);

        for (uint i; i < initialRelayers.length; i++) {
            grantRole(RELAYER_ROLE, initialRelayers[i]);
            _totalRelayers++;
        }

    }

    /**
        @notice Returns true if {relayer} has the relayer role.
        @param relayer Address to check.
     */
    function isRelayer(address relayer) public view returns (bool) {
        return hasRole(RELAYER_ROLE, relayer);
    }

    /**
        @notice Removes admin role from {msg.sender} and grants it to {newAdmin}.
        @notice Only callable by an address that currently has the admin role.
        @param newAdmin Address that admin role will be granted to.
     */
    function renounceAdmin(address newAdmin) public onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
        @notice Pauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
     */
    function adminPauseTransfers() public onlyAdmin {
        _pause();
    }

    /**
        @notice Unpauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
     */
    function adminUnpauseTransfers() public onlyAdmin {
        _unpause();
    }

    /**
        @notice Modifies the number of votes required for a proposal to be considered passed.
        @notice Only callable by an address that currently has the admin role.
        @param newThreshold Value {_relayerThreshold} will be changed to.
        @notice Emits {RelayerThresholdChanged} event.
     */
    function adminChangeRelayerThreshold(uint newThreshold) public onlyAdmin {
        _relayerThreshold = newThreshold;
        emit RelayerThresholdChanged(newThreshold);
    }

    /**
        @notice Grants {relayerAddress} the relayer role and increases {_totalRelayer} count.
        @notice Only callable by an address that currently has the admin role.
        @param relayerAddress Address of relayer to be added.
        @notice Emits {RelayerAdded} event.
     */
    function adminAddRelayer(address relayerAddress) public onlyAdmin {
        grantRole(RELAYER_ROLE, relayerAddress);
        emit RelayerAdded(relayerAddress);
        _totalRelayers++;
    }

    /**
        @notice Removes relayer role for {relayerAddress} and decreases {_totalRelayer} count.
        @notice Only callable by an address that currently has the admin role.
        @param relayerAddress Address of relayer to be removed.
        @notice Emits {RelayerRemoved} event.
     */
    function adminRemoveRelayer(address relayerAddress) public onlyAdmin {
        revokeRole(RELAYER_ROLE, relayerAddress);
        emit RelayerRemoved(relayerAddress);
        _totalRelayers--;
    }

    /**
        @notice Sets a new resource for handler contracts that use the IERCHandler interface.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetResource(address handlerAddress, bytes32 resourceID, address tokenAddress) public onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setResource(resourceID, tokenAddress);
    }

    /**
        @notice Sets a new resource for handler contracts that use the IGenericHandler interface.
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
        bytes4 executeFunctionSig
    ) public onlyAdmin {
        IGenericHandler handler = IGenericHandler(handlerAddress);
        handler.setResource(resourceID, contractAddress, depositFunctionSig, executeFunctionSig);
    }

    /**
        @notice Sets a resource as burnable for handler contracts that use the IERCHandler interface.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetBurnable(address handlerAddress, address tokenAddress) public onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

    /**
        @notice Returns a proposal.
        @param originChainID Chain ID deposit originated from.
        @param depositNonce ID of proposal generated by proposal's origin Bridge contract.
        @return Proposal which consists of:
        - _dataHash Hash of data to be provided when deposit proposal is executed.
        - _yesVotes Number of votes in favor of proposal.
        - _noVotes Number of votes against proposal.
        - _status Current status of proposal.
     */
    function getProposal(uint8 originChainID, uint64 depositNonce) public view returns (Proposal memory) {
        return _proposals[originChainID][depositNonce];
    }

    /**
        @notice Changes deposit fee.
        @notice Only callable by admin.
        @param newFee Value {_fee} will be updated to.
     */
    function adminChangeFee(uint newFee) public onlyAdmin {
        require(_fee != newFee, "Current fee is equal to proposed new fee");
        _fee = newFee;
    }

    /**
        @notice Used to manually withdraw funds from ERC safes.
        @param handlerAddress Address of handler to withdraw from.
        @param tokenAddress Address of token to withdraw.
        @param recipient Address to withdraw tokens to.
        @param amountOrTokenID Either the amount of ERC20 tokens or the ERC721 token ID to withdraw.
     */
    function adminWithdraw(
        address handlerAddress,
        address tokenAddress,
        address recipient,
        uint256 amountOrTokenID
    ) public onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.withdraw(tokenAddress, recipient, amountOrTokenID);
    }

    /**
        @notice Initiates a transfer using a specified handler contract.
        @notice Only callable when Bridge is not paused.
        @param destinationChainID ID of chain deposit will be bridged to.
        @param handler Address of handler to be used for deposit.
        @param data Additional data to be passed to specified handler.
        @notice Emits {Deposit} event.
     */
    function deposit (uint8 destinationChainID, address handler, bytes memory data) public payable whenNotPaused {
        require(msg.value == _fee, "Incorrect fee supplied");

        uint64 depositNonce = ++_depositCounts[destinationChainID];
        _depositRecords[destinationChainID][depositNonce] = data;

        IDepositExecute depositHandler = IDepositExecute(handler);
        depositHandler.deposit(destinationChainID, depositNonce, msg.sender, data);

        emit Deposit(destinationChainID, handler, depositNonce);
    }

    /**
        @notice When called, {msg.sender} will be marked as voting in favor of proposal.
        @notice Only callable by relayers when Bridge is not paused.
        @param chainID ID of chain deposit originated from.
        @param depositNonce ID of deposited generated by origin Bridge contract.
        @param dataHash Hash of data provided when deposit was made.
        @notice Proposal must not have already been passed or transferred.
        @notice {msg.sender} must not have already voted on proposal.
        @notice Emits {ProposalCreated} event when no proposal exists for deposit.
        @notice Emits {ProposalVote} event.
        @notice Emits {ProposalFinalized} event when number of {_yesVotes} is greater than or equal to
        {_relayerThreshold}.
     */
    function voteProposal(uint8 chainID, uint64 depositNonce, bytes32 dataHash) public onlyRelayers whenNotPaused {
        Proposal storage proposal = _proposals[uint8(chainID)][depositNonce];

        require(uint(proposal._status) <= 1, "proposal has already been passed or transferred");
        require(!_hasVotedOnProposal[chainID][depositNonce][msg.sender], "relayer has already voted on proposal");

        if (uint(proposal._status) == 0) {
            ++_totalProposals;
            _proposals[chainID][depositNonce] = Proposal({
                _dataHash: dataHash,
                _yesVotes: new address[](1),
                _noVotes: new address[](0),
                _status: ProposalStatus.Active
                });

            proposal._yesVotes[0] = msg.sender;
            emit ProposalCreated(chainID, _chainID, depositNonce, dataHash);
        } else {
            proposal._yesVotes.push(msg.sender);
        }

        _hasVotedOnProposal[chainID][depositNonce][msg.sender] = true;
        emit ProposalVote(chainID, _chainID, depositNonce, proposal._status);

        // If _depositThreshold is set to 1, then auto finalize
        // or if _relayerThreshold has been exceeded
        if (_relayerThreshold <= 1 || proposal._yesVotes.length >= _relayerThreshold) {
            proposal._status = ProposalStatus.Passed;
            emit ProposalFinalized(chainID, _chainID, depositNonce);
        }
    }

    /**
        @notice Executes a deposit proposal that is considered passed using a specified handler contract.
        @notice Only callable by relayers when Bridge is not paused.
        @param chainID ID of chain deposit originated from.
        @param depositNonce ID of deposited generated by origin Bridge contract.
        @param data Data originally provided when deposit was made.
        @notice Proposal must have Passed status.
        @notice Hash of {data} must equal proposal's {dataHash}.
        @notice Emits {ProposalExecuted} event.
     */
    function executeProposal(uint8 chainID, uint64 depositNonce, address handler, bytes memory data) public onlyRelayers whenNotPaused {
        Proposal storage proposal = _proposals[uint8(chainID)][depositNonce];

        require(proposal._status != ProposalStatus.Inactive, "proposal is not active");
        require(proposal._status == ProposalStatus.Passed, "proposal was not passed or has already been transferred");
        require(keccak256(abi.encodePacked(handler, data)) == proposal._dataHash,
            "provided data does not match proposal's data hash");

        IDepositExecute depositHandler = IDepositExecute(handler);
        depositHandler.executeDeposit(data);

        proposal._status = ProposalStatus.Transferred;
        emit ProposalExecuted(chainID, _chainID, depositNonce);
    }

    /**
        @notice Transfers eth in the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1.
        This means that the address at index 0 for addrs will receive the amount (in WEI) from amounts at index 0.
        @param addrs Array of addresses to transfer {amounts} to.
        @param amounts Array of amonuts to transfer to {addrs}.
     */
    function transferFunds(address payable[] memory addrs, uint[] memory amounts) public onlyAdmin {
        for (uint i = 0;i < addrs.length; i++) {
            addrs[i].transfer(amounts[i]);
        }
    }
}