const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting", function () {
  let voting;
  let owner;
  let voter1;
  let voter2;
  let voter3;
  let stranger;

  const VOTER1_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const VOTER2_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const VOTER3_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  beforeEach(async function () {
    [owner, voter1, voter2, voter3, stranger] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  describe("deployment", function () {
    it("should set the deployer as the owner", async function () {
      expect(await voting.owner()).to.equal(owner.address);
    });

    it("should auto-register the constant initial voters", async function () {
      expect(await voting.voters(VOTER1_ADDRESS)).to.equal(true);
      expect(await voting.voters(VOTER2_ADDRESS)).to.equal(true);
      expect(await voting.voters(VOTER3_ADDRESS)).to.equal(true);
    });

    it("should expose the voting system name", async function () {
      expect(await voting.VOTING_SYSTEM_NAME()).to.equal("Blockchain Voting DApp");
    });

    it("should start with zero candidates", async function () {
      expect(await voting.candidatesCount()).to.equal(0);
    });
  });

  describe("addCandidate", function () {
    it("should let the owner add a candidate", async function () {
      await expect(voting.addCandidate("Alice"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(1, "Alice");
      expect(await voting.candidatesCount()).to.equal(1);
      const candidate = await voting.candidates(1);
      expect(candidate.name).to.equal("Alice");
      expect(candidate.voteCount).to.equal(0);
    });

    it("should assign sequential ids to candidates", async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      expect(await voting.candidatesCount()).to.equal(2);
      expect((await voting.candidates(2)).name).to.equal("Bob");
    });

    it("should revert when a non-owner calls", async function () {
      await expect(voting.connect(stranger).addCandidate("Alice")).to.be.revertedWith(
        "Only the owner can call this"
      );
    });

    it("should revert when the name is empty", async function () {
      await expect(voting.addCandidate("")).to.be.revertedWith(
        "Candidate name cannot be empty"
      );
    });
  });

  describe("registerVoter", function () {
    it("should let the owner register an extra voter", async function () {
      await expect(voting.registerVoter(stranger.address))
        .to.emit(voting, "VoterRegistered")
        .withArgs(stranger.address);
      expect(await voting.voters(stranger.address)).to.equal(true);
    });

    it("should revert when a non-owner calls", async function () {
      await expect(voting.connect(stranger).registerVoter(owner.address)).to.be.revertedWith(
        "Only the owner can call this"
      );
    });

    it("should revert when registering the zero address", async function () {
      await expect(voting.registerVoter(ethers.ZeroAddress)).to.be.revertedWith(
        "Invalid address"
      );
    });

    it("should revert when the voter is already registered", async function () {
      await expect(voting.registerVoter(VOTER1_ADDRESS)).to.be.revertedWith(
        "Already registered"
      );
    });
  });

  describe("register", function () {
    it("should let anyone register themselves", async function () {
      await expect(voting.connect(stranger).register())
        .to.emit(voting, "VoterRegistered")
        .withArgs(stranger.address);
      expect(await voting.voters(stranger.address)).to.equal(true);
    });

    it("should revert when already registered", async function () {
      await expect(voting.connect(voter1).register()).to.be.revertedWith(
        "Already registered"
      );
    });
  });

  describe("vote", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
    });

    it("should let a registered voter vote", async function () {
      await expect(voting.connect(voter1).vote(1))
        .to.emit(voting, "Voted")
        .withArgs(voter1.address, 1);
      expect((await voting.candidates(1)).voteCount).to.equal(1);
    });

    it("should record hasVoted after voting", async function () {
      expect(await voting.hasVoted(voter1.address)).to.equal(false);
      await voting.connect(voter1).vote(1);
      expect(await voting.hasVoted(voter1.address)).to.equal(true);
    });

    it("should revert when a non-registered voter votes", async function () {
      await expect(voting.connect(stranger).vote(1)).to.be.revertedWith(
        "You are not a registered voter"
      );
    });

    it("should revert when a voter votes twice", async function () {
      await voting.connect(voter1).vote(1);
      await expect(voting.connect(voter1).vote(2)).to.be.revertedWith(
        "You have already voted"
      );
    });

    it("should revert for an invalid candidate id", async function () {
      await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("Invalid candidate");
      await expect(voting.connect(voter1).vote(3)).to.be.revertedWith("Invalid candidate");
    });

    it("should count votes for the correct candidate", async function () {
      await voting.connect(voter3).register();
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(1);
      await voting.connect(voter3).vote(2);
      expect((await voting.candidates(1)).voteCount).to.equal(2);
      expect((await voting.candidates(2)).voteCount).to.equal(1);
    });
  });

  describe("winner", function () {
    it("should revert when there are no candidates", async function () {
      await expect(voting.winner()).to.be.revertedWith("No candidates yet");
    });

    it("should return the candidate with the most votes", async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(1);
      const result = await voting.winner();
      expect(result[0]).to.equal(1);
      expect(result[1]).to.equal("Alice");
    });

    it("should return the first candidate on a tie", async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      const result = await voting.winner();
      expect(result[0]).to.equal(1);
      expect(result[1]).to.equal("Alice");
    });
  });
});
