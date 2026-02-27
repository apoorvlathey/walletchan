[CONTRACT] = './apps/contracts/src/WCHANVault.sol'
[TEST] = './apps/contracts/test/WCHANVault.t.sol'
do a detailed security review of [CONTRACT]
ensure that there are no scope of bugs, ensure best solidity practices especially rounding issues, etc.  
we have tests here [TEST] ensure that the coverage is 100% (use forge) and the tests don't skip anything.  
ensure that we are using fuzzing for all the cases where possible. think like a blackhat and try to find all the edges that might be exploitable. we want to make it as secure as possible
