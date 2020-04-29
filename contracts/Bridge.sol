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

contract Bridge is Pausable, AccessControl {
    using SafeMath for uint;

    uint8                    public _chainID;
    uint256                  public _relayerThreshold;
    uint256                  public _totalRelayers;
    uint256                  public _totalProposals;
    uint256                  public _fee;

    enum Vote {No, Yes}
    enum ProposalStatus {Inactive, Active, Passed, Transferred}

    struct Proposal {
        bytes32                  _dataHash;
        address[]                _yesVotes;
        address[]                _noVotes;
        ProposalStatus    _status;
    }

    // destinationChainID => number of deposits
    mapping(uint8 => uint256) public _depositCounts;
    // destinationChainID => depositNonce => bytes
    mapping(uint8 => mapping(uint256 => bytes)) public _depositRecords;
    // destinationChainID => depositNonce => Proposal
    mapping(uint8 => mapping(uint256 => Proposal)) public _proposals;
    // destinationChainID => depositNonce => relayerAddress => bool
    mapping(uint8 => mapping(uint256 => mapping(address => bool))) public _hasVotedOnProposal;

    event RelayerThresholdChanged(uint indexed newThreshold);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event Deposit(
        uint8   indexed destinationChainID,
        address indexed handlerAddress,
        uint256 indexed depositNonce
    );
    event ProposalCreated(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint256 indexed depositNonce,
        bytes32         dataHash
    );
    event ProposalVote(
        uint8   indexed       originChainID,
        uint8   indexed       destinationChainID,
        uint256 indexed       depositNonce,
        ProposalStatus status
    );
    event ProposalFinalized(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint256 indexed depositNonce
    );
    event ProposalExecuted(
        uint8   indexed originChainID,
        uint8   indexed destinationChainID,
        uint256 indexed depositNonce
    );

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender));
        _;
    }

    modifier onlyRelayers() {
        require(hasRole(RELAYER_ROLE, msg.sender));
        _;
    }

    // Instantiate a bridge, msg.sender becomes the admin
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

    // Returns true if address has relayer role, otherwise false.
    function isRelayer(address relayer) public view returns (bool) {
        return hasRole(RELAYER_ROLE, relayer);
    }

    // Replace current admin with new admin
    function renounceAdmin(address newAdmin) public onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Pause deposits, voting and execution
    function adminPauseTransfers() public onlyAdmin {
        _pause();
    }

    // Unpause deposits, voting and execution
    function adminUnpauseTransfers() public onlyAdmin {
        _unpause();
    }

    // Modifies the number of votes required for a proposal to be executed
    function adminChangeRelayerThreshold(uint newThreshold) public onlyAdmin {
        _relayerThreshold = newThreshold;
        emit RelayerThresholdChanged(newThreshold);
    }

    // Add address to relayer set
    function adminAddRelayer(address relayerAddress) public onlyAdmin {
        grantRole(RELAYER_ROLE, relayerAddress);
        emit RelayerAdded(relayerAddress);
        _totalRelayers++;
    }

    // Remove address from relayer set
    function adminRemoveRelayer(address relayerAddress) public onlyAdmin {
        revokeRole(RELAYER_ROLE, relayerAddress);
        emit RelayerRemoved(relayerAddress);
        _totalRelayers--;
    }

    // Register a resource ID and contract address for a handler
    function adminSetResource(address handlerAddress, bytes32 resourceID, address tokenAddress) public onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setResource(resourceID, tokenAddress);
    }

    function adminSetGenericResource(address handlerAddress, bytes32 resourceID, address contractAddress, bytes4 depositFunctionSig, bytes4 executeFunctionSig) public onlyAdmin{
        IGenericHandler handler = IGenericHandler(handlerAddress);
        handler.setResource(resourceID, contractAddress, depositFunctionSig, executeFunctionSig);
    }

    // Register a token contract as mintable/burnable in a handler
    function adminSetBurnable(address handlerAddress, address tokenAddress) public onlyAdmin {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

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

    function getProposal(uint8 originChainID, uint256 depositNonce) public view returns (Proposal memory) {
        return _proposals[originChainID][depositNonce];
    }

    // Initiates a transfer accros the bridge by calling the specified handler
    function deposit (uint8 destinationChainID, address handler, bytes memory data) public payable whenNotPaused {
        require(msg.value == _fee, "Incorrect fee supplied");

        uint256 depositNonce = ++_depositCounts[destinationChainID];
        _depositRecords[destinationChainID][depositNonce] = data;

        IDepositExecute depositHandler = IDepositExecute(handler);
        depositHandler.deposit(destinationChainID, depositNonce, msg.sender, data);

        emit Deposit(destinationChainID, handler, depositNonce);
    }

    function voteProposal(uint8 chainID, uint256 depositNonce, bytes32 dataHash) public onlyRelayers whenNotPaused {
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

    function executeProposal(uint8 chainID, uint256 depositNonce, address handler, bytes memory data) public onlyRelayers whenNotPaused {
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

    // Transfers eth in the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1.
    // This means that the address at index 0 for addrs will receive the amount (in WEI) from amounts at index 0.
    function transferFunds(address payable[] memory addrs, uint[] memory amounts) public onlyAdmin {
        for (uint i = 0;i < addrs.length; i++) {
            addrs[i].transfer(amounts[i]);
        }
    }
}