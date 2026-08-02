// Deployment script for the Voting contract.
// Run with: npx hardhat run scripts/deploy.js --network localhost

const hre = require("hardhat");

async function main() {
  // 1. Deploy the contract
  const [deployer, voter1, voter2] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("Voting contract deployed at:", address);

  // 2. Read the constant value
  const systemName = await voting.VOTING_SYSTEM_NAME();
  console.log("VOTING_SYSTEM_NAME const:", systemName);

  // 3. Add candidates
  await (await voting.addCandidate("Alice")).wait();
  await (await voting.addCandidate("Bob")).wait();
  console.log("Candidates added. Total:", (await voting.candidatesCount()).toString());

  // 4. Check that initial voters were auto-registered by the constructor
  console.log("Initial voters registered?");
  console.log("  voter1 registered:", await voting.voters(voter1.address));
  console.log("  voter2 registered:", await voting.voters(voter2.address));

  // 5. Cast votes as the initial voters
  await (await voting.connect(voter1).vote(1)).wait();
  await (await voting.connect(voter2).vote(1)).wait();
  await (await voting.connect(deployer).vote(2)).wait();
  console.log("Votes cast!");

  // 6. Show results
  const [winnerId, winnerName] = await voting.winner();
  console.log("Candidate 1 votes:", (await voting.candidates(1)).voteCount.toString());
  console.log("Candidate 2 votes:", (await voting.candidates(2)).voteCount.toString());
  console.log(`Winner: #${winnerId} ${winnerName}`);

  // 7. Save address + ABI so the Next.js DApp can talk to the contract
  const fs = require("fs");
  const path = require("path");
  const artifact = require("../artifacts/contracts/Voting.sol/Voting.json");
  const out = path.join(__dirname, "..", "frontend", "lib", "contract.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ address, abi: artifact.abi }, null, 2));
  console.log("Saved contract info for the DApp ->", out);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
