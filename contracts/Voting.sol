// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Voting
 * @dev A simple decentralized voting DApp contract for learning purposes.
 *
 * Features:
 *  - The deployer becomes the owner.
 *  - The owner can add candidates.
 *  - Initial voters are stored in a `constant` array and auto-registered
 *    when the contract is deployed (constructor).
 *  - Each registered voter can vote exactly once.
 *  - Anyone can read results.
 */
contract Voting {
    // ============================================================
    // CONSTANTS (immutable values baked into the bytecode)
    // ============================================================

    // Constant holding the name of the voting system.
    string public constant VOTING_SYSTEM_NAME = "Blockchain Voting DApp";

    // Constants holding the initial voters (Hardhat's test accounts).
    // `constant` means the value can never change and costs no gas to read.
    // (Solidity only allows `constant` on value types, not arrays.)
    address private constant VOTER1 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address private constant VOTER2 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address private constant VOTER3 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    // ============================================================
    // STATE VARIABLES (stored on-chain, mutable)
    // ============================================================

    address public owner;

    struct Candidate {
        uint256 id; // candidate id (starts at 1)
        string name;
        uint256 voteCount;
    }

    // mapping: candidateId => Candidate
    mapping(uint256 => Candidate) public candidates;

    // mapping: voterAddress => isRegistered
    mapping(address => bool) public voters;

    // mapping: voterAddress => hasAlreadyVoted
    mapping(address => bool) private voted;

    uint256 public candidatesCount;

    // ============================================================
    // EVENTS
    // ============================================================

    event CandidateAdded(uint256 indexed id, string name);
    event Voted(address indexed voter, uint256 indexed candidateId);
    event VoterRegistered(address indexed voter);

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this");
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() {
        owner = msg.sender;
        // Register the addresses stored in the constants above.
        voters[VOTER1] = true;
        voters[VOTER2] = true;
        voters[VOTER3] = true;
    }

    // ============================================================
    // WRITE FUNCTIONS
    // ============================================================

    /**
     * @dev Owner adds a new candidate.
     */
    function addCandidate(string memory _name) external onlyOwner {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        emit CandidateAdded(candidatesCount, _name);
    }

    /**
     * @dev Owner can register an extra voter at any time.
     */
    function registerVoter(address _voter) external onlyOwner {
        require(_voter != address(0), "Invalid address");
        require(!voters[_voter], "Already registered");
        voters[_voter] = true;
        emit VoterRegistered(_voter);
    }

    /**
     * @dev Anyone can register themselves as a voter.
     */
    function register() external {
        require(msg.sender != address(0), "Invalid address");
        require(!voters[msg.sender], "Already registered");
        voters[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }

    /**
     * @dev A registered voter votes for a candidate (one vote per voter).
     */
    function vote(uint256 _candidateId) external {
        require(voters[msg.sender], "You are not a registered voter");
        require(!voted[msg.sender], "You have already voted");
        require(_candidateId >= 1 && _candidateId <= candidatesCount, "Invalid candidate");

        voted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        emit Voted(msg.sender, _candidateId);
    }

    // ============================================================
    // READ FUNCTIONS
    // ============================================================

    function hasVoted(address _voter) public view returns (bool) {
        return voted[_voter];
    }

    /**
     * @dev Returns the winner's id and name. Ties go to the first found.
     */
    function winner() public view returns (uint256, string memory) {
        require(candidatesCount > 0, "No candidates yet");
        uint256 maxVotes = 0;
        uint256 winnerId = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > maxVotes) {
                maxVotes = candidates[i].voteCount;
                winnerId = i;
            }
        }
        return (winnerId, candidates[winnerId].name);
    }
}
