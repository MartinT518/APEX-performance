
import { resolveDailyStatus, StatusResolverInput } from './statusResolver';
import { IAgentVote } from '../../../types/agents';

// Simple Test Runner
const runTest = (name: string, input: StatusResolverInput, expectedStatus: 'GO' | 'ADAPTED' | 'SHUTDOWN', expectedReasonSnippet?: string) => {
  console.log(`Running Test: ${name}`);
  const result = resolveDailyStatus(input);
  
  const statusPass = result.global_status === expectedStatus;
  const reasonPass = expectedReasonSnippet ? result.reason.includes(expectedReasonSnippet) : true;
  /* @ts-ignore */
  const confidencePass = result.confidenceScore === 0.85;

  if (statusPass && reasonPass && confidencePass) {
    console.log(`✅ PASS`);
  } else {
    console.error(`❌ FAIL`);
    console.error(`   Expected Status: ${expectedStatus}, Got: ${result.global_status}`);
    if (expectedReasonSnippet) console.error(`   Expected Reason to contain: "${expectedReasonSnippet}", Got: "${result.reason}"`);
    /* @ts-ignore */
    if (!confidencePass) console.error(`   Expected Confidence: 0.85, Got: ${result.confidenceScore}`);
  }
  console.log('---');
};

console.log('Starting Status Resolver Tests...');

const structuralRed: IAgentVote = { agentId: 'structural_agent', vote: 'RED', confidence: 0.9, reason: 'Niggle Score 8/10', flaggedMetrics: [] };
const metabolicRed: IAgentVote = { agentId: 'metabolic_agent', vote: 'RED', confidence: 0.9, reason: 'High Strain', flaggedMetrics: [] };
const structuralGreen: IAgentVote = { agentId: 'structural_agent', vote: 'GREEN', confidence: 0.9, reason: 'OK', flaggedMetrics: [] };
const metabolicGreen: IAgentVote = { agentId: 'metabolic_agent', vote: 'GREEN', confidence: 0.9, reason: 'OK', flaggedMetrics: [] };
const fuelingGreen: IAgentVote = { agentId: 'fueling_agent', vote: 'GREEN', confidence: 0.9, reason: 'OK', flaggedMetrics: [] };

// Test 1: Single RED (Structural) -> ADAPTED
runTest(
  'Single RED (Structural)',
  { votes: [structuralRed, metabolicGreen, fuelingGreen], niggleScore: 8 },
  'ADAPTED',
  'Structural Agent Veto'
);

// Test 2: Multiple RED -> SHUTDOWN
runTest(
  'Multiple RED (Structural + Metabolic)',
  { votes: [structuralRed, metabolicRed, fuelingGreen], niggleScore: 8 },
  'SHUTDOWN',
  'System Shutdown'
);

// Test 3: Niggle > 3 logic (Assuming structural agent catches this, but verifying flow)
// If niggle is high but agent voted AMBER? Strict rule says Struct RED -> ADAPTED.
// If Struct Agent votes RED due to Niggle > 3 (simulated), result should be ADAPTED.
runTest(
  'High Niggle (Structural RED)',
  { votes: [structuralRed, metabolicGreen, fuelingGreen], niggleScore: 4 },
  'ADAPTED'
);
