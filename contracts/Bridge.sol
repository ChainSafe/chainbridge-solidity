pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IDepositHandler.sol";
import "./interfaces/IGenericHandler.sol";
import "./interfaces/IBridge.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IMinterBurner.sol";

contract Bridge is Pausable, AccessControl {
    using SafeMath for uint;

    uint8                    public _chainID;
    uint256                  public _relayerThreshold;
    uint256                 public _totalRelayers;
    uint256                  public _totalDepositProposals;

    enum Vote {No, Yes}
    //enum RelayerThresholdProposalStatus {Inactive, Active}
    enum DepositProposalStatus {Inactive, Active, Passed, Transferred}

    struct DepositProposal {
        bytes32                  _dataHash;
        address[]                _yesVotes;
        address[]                _noVotes;
        DepositProposalStatus    _status;
    }

    //    struct RelayerThresholdProposal {
    //        uint256                        _proposedValue;
    //        mapping(address => bool)       _hasVoted;
    //        address[]                      _yesVotes;
    //        address[]                      _noVotes;
    //        RelayerThresholdProposalStatus _status;
    //    }

    // destinationChainID => number of deposits
    mapping(uint8 => uint256) public _depositCounts;
    // destinationChainID => depositNonce => bytes
    mapping(uint8 => mapping(uint256 => bytes)) public _depositRecords;
    // destinationChainID => depositNonce => depositProposal
    mapping(uint8 => mapping(uint256 => DepositProposal)) public _depositProposals;
    // destinationChainID => depositNonce => relayerAddress => bool
    mapping(uint8 => mapping(uint256 => mapping(address => bool))) public _hasVotedOnDepositProposal;

    //    event RelayerThresholdProposalCreated(uint indexed proposedValue);
    //    event RelayerThresholdProposalVote(Vote vote);
    event RelayerThresholdChanged(uint indexed newThreshold);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event Deposit(
        uint8   indexed destinationChainID,
        address indexed originChainHandlerAddress,
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
        DepositProposalStatus status
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
    constructor (uint8 chainID, address[] memory initialRelayers, uint initialRelayerThreshold) public {
        _chainID = chainID;
        _relayerThreshold = initialRelayerThreshold;
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

    // Change relayer threshold
    function adminChangeRelayerThreshold(uint newThreshold) public onlyAdmin {
        _relayerThreshold = newThreshold;
        emit RelayerThresholdChanged(newThreshold);
    }

    // Add relayer
    function adminAddRelayer(address relayerAddress) public onlyAdmin {
        grantRole(RELAYER_ROLE, relayerAddress);
        emit RelayerAdded(relayerAddress);
        _totalRelayers++;
    }

    // Remove relayer
    function adminRemoveRelayer(address relayerAddress) public onlyAdmin {
        revokeRole(RELAYER_ROLE, relayerAddress);
        emit RelayerRemoved(relayerAddress);
        _totalRelayers--;
    }

    // Register a resource ID and contract address for a handler
    function adminSetResourceIDAndContractAddress(address handlerAddress, bytes32 resourceID, address tokenAddress) public onlyAdmin {
        IDepositHandler handler = IDepositHandler(handlerAddress);
        handler.setResourceIDAndContractAddress(resourceID, tokenAddress);
    }

    function adminSetResourceIdInGenericHandler(address handlerAddress, bytes32 resourceID, address contractAddress, bytes4 depositFunctionSig, bytes4 executeFunctionSig) public onlyAdmin{
        IGenericHandler handler = IGenericHandler(handlerAddress);
        handler.setResource(resourceID, contractAddress, depositFunctionSig, executeFunctionSig);
    }

    // Register a token contract as mintable/burnable in a handler
    function adminSetBurnable(address handlerAddress, address tokenAddress) public onlyAdmin {
        IMinterBurner handler = IMinterBurner(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

    function getDepositProposal(
        uint8 destinationChainID,
        uint256 depositNonce
    ) public view returns (DepositProposal memory) {
        return _depositProposals[destinationChainID][depositNonce];
    }

    function deposit (
        uint8        destinationChainID,
        address      originChainHandlerAddress,
        bytes memory data
    ) public whenNotPaused {
        uint256 depositNonce = ++_depositCounts[destinationChainID];
        _depositRecords[destinationChainID][depositNonce] = data;

        IDepositHandler depositHandler = IDepositHandler(originChainHandlerAddress);
        depositHandler.deposit(destinationChainID, depositNonce, msg.sender, data);

        emit Deposit(destinationChainID, originChainHandlerAddress, depositNonce);
    }

    function voteDepositProposal(
        uint8   originChainID,
        uint256 depositNonce,
        bytes32 dataHash
    ) public onlyRelayers whenNotPaused {
        DepositProposal storage depositProposal = _depositProposals[uint8(originChainID)][depositNonce];

        require(uint(depositProposal._status) <= 1, "proposal has already been passed or transferred");
        require(!_hasVotedOnDepositProposal[originChainID][depositNonce][msg.sender], "relayer has already voted on proposal");

        if (uint(depositProposal._status) == 0) {
            ++_totalDepositProposals;
            _depositProposals[originChainID][depositNonce] = DepositProposal({
                _dataHash: dataHash,
                _yesVotes: new address[](1),
                _noVotes: new address[](0),
                _status: DepositProposalStatus.Active
                });

            depositProposal._yesVotes[0] = msg.sender;
            emit ProposalCreated(originChainID, _chainID, depositNonce, dataHash);
        } else {
            depositProposal._yesVotes.push(msg.sender);
        }

        _hasVotedOnDepositProposal[originChainID][depositNonce][msg.sender] = true;
        emit ProposalVote(originChainID, _chainID, depositNonce, depositProposal._status);

        // If _depositThreshold is set to 1, then auto finalize
        // or if _relayerThreshold has been exceeded
        if (_relayerThreshold <= 1 || depositProposal._yesVotes.length >= _relayerThreshold) {
            depositProposal._status = DepositProposalStatus.Passed;
            emit ProposalFinalized(originChainID, _chainID, depositNonce);
        }
    }

    function executeDepositProposal(
        uint8        originChainID,
        uint256      depositNonce,
        address      destinationChainHandlerAddress,
        bytes memory data
    ) public onlyRelayers whenNotPaused {
        DepositProposal storage depositProposal = _depositProposals[uint8(originChainID)][depositNonce];

        require(depositProposal._status != DepositProposalStatus.Inactive, "proposal is not active");
        require(depositProposal._status == DepositProposalStatus.Passed, "proposal was not passed or has already been transferred");
        require(keccak256(abi.encodePacked(destinationChainHandlerAddress, data)) == depositProposal._dataHash,
            "provided data does not match proposal's data hash");

        IDepositHandler depositHandler = IDepositHandler(destinationChainHandlerAddress);
        depositHandler.executeDeposit(data);

        depositProposal._status = DepositProposalStatus.Transferred;
        emit ProposalExecuted(originChainID, _chainID, depositNonce);
    }
}