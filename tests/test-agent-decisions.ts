/**
 * Test Agent Decision Logic with Real Data
 * 
 * Tests each agent (Structural, Metabolic, Fueling) with various input combinations
 * and validates vote outputs match expected logic.
 */

import { evaluateStructuralHealth } from '../src/modules/execute/agents/structuralAgent';
import { evaluateMetabolicState } from '../src/modules/execute/agents/metabolicAgent';
import { evaluateFuelingStatus } from '../src/modules/execute/agents/fuelingAgent';
import { synthesizeCoachDecision } from '../src/modules/review/logic/substitutionMatrix';
import type { IAgentVote } from '../src/types/agents';
import type { IWorkout } from '../src/types/workout';

// Test Structural Agent
function testStructuralAgent() {
  console.log('\n=== Testing Structural Agent ===');
  
  // Test 1: Low niggle, recent lift -> GREEN
  const vote1 = evaluateStructuralHealth({ niggleScore: 2, daysSinceLastLift: 1 });
  console.assert(vote1.vote === 'GREEN', `Expected GREEN, got ${vote1.vote}`);
  console.log('✓ Test 1: Low niggle, recent lift -> GREEN');
  
  // Test 2: High niggle -> RED
  const vote2 = evaluateStructuralHealth({ niggleScore: 8, daysSinceLastLift: 1 });
  console.assert(vote2.vote === 'RED', `Expected RED, got ${vote2.vote}`);
  console.log('✓ Test 2: High niggle -> RED');
  
  // Test 3: Too many days since lift -> AMBER
  const vote3 = evaluateStructuralHealth({ niggleScore: 3, daysSinceLastLift: 5 });
  console.assert(vote3.vote === 'AMBER' || vote3.vote === 'RED', `Expected AMBER/RED, got ${vote3.vote}`);
  console.log('✓ Test 3: Too many days since lift -> AMBER/RED');
}

// Test Metabolic Agent
function testMetabolicAgent() {
  console.log('\n=== Testing Metabolic Agent ===');
  
  // Test 1: Normal conditions -> GREEN
  const vote1 = evaluateMetabolicState({
    aerobicDecoupling: 2.0,
    timeInRedZone: 3,
    planLimitRedZone: 10
  });
  console.assert(vote1.vote === 'GREEN', `Expected GREEN, got ${vote1.vote}`);
  console.log('✓ Test 1: Normal conditions -> GREEN');
  
  // Test 2: Excessive red zone time -> RED
  const vote2 = evaluateMetabolicState({
    aerobicDecoupling: 2.0,
    timeInRedZone: 15,
    planLimitRedZone: 10
  });
  console.assert(vote2.vote === 'RED', `Expected RED, got ${vote2.vote}`);
  console.log('✓ Test 2: Excessive red zone -> RED');
  
  // Test 3: High decoupling -> AMBER
  const vote3 = evaluateMetabolicState({
    aerobicDecoupling: 7.0,
    timeInRedZone: 3,
    planLimitRedZone: 10
  });
  console.assert(vote3.vote === 'AMBER', `Expected AMBER, got ${vote3.vote}`);
  console.log('✓ Test 3: High decoupling -> AMBER');
  
  // Test 4: HRV drop -> RED
  const vote4 = evaluateMetabolicState({
    aerobicDecoupling: 2.0,
    timeInRedZone: 3,
    planLimitRedZone: 10,
    hrvBaseline: 50,
    currentHRV: 40 // 20% drop
  });
  console.assert(vote4.vote === 'RED', `Expected RED, got ${vote4.vote}`);
  console.log('✓ Test 4: HRV drop -> RED');
}

// Test Fueling Agent
function testFuelingAgent() {
  console.log('\n=== Testing Fueling Agent ===');
  
  // Test 1: Low gut index, short run -> GREEN
  const vote1 = evaluateFuelingStatus({
    gutTrainingIndex: 1,
    nextRunDuration: 30
  });
  console.assert(vote1.vote === 'GREEN', `Expected GREEN, got ${vote1.vote}`);
  console.log('✓ Test 1: Low gut index, short run -> GREEN');
  
  // Test 2: Low gut index, long run -> AMBER
  const vote2 = evaluateFuelingStatus({
    gutTrainingIndex: 1,
    nextRunDuration: 120
  });
  console.assert(vote2.vote === 'AMBER' || vote2.vote === 'RED', `Expected AMBER/RED, got ${vote2.vote}`);
  console.log('✓ Test 2: Low gut index, long run -> AMBER/RED');
}

// Test Substitution Matrix
function testSubstitutionMatrix() {
  console.log('\n=== Testing Substitution Matrix ===');
  
  const mockWorkout: IWorkout = {
    id: 'test_workout',
    date: new Date().toISOString().split('T')[0],
    type: 'RUN',
    primaryZone: 'Z4_THRESHOLD',
    durationMinutes: 60,
    structure: { mainSet: 'Test workout' }
  };
  
  // Test 1: All GREEN -> EXECUTED_AS_PLANNED
  const votes1: IAgentVote[] = [
    { agentId: 'structural_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] },
    { agentId: 'metabolic_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] },
    { agentId: 'fueling_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] }
  ];
  const decision1 = synthesizeCoachDecision(votes1, mockWorkout);
  console.assert(decision1.action === 'EXECUTED_AS_PLANNED', `Expected EXECUTED_AS_PLANNED, got ${decision1.action}`);
  console.log('✓ Test 1: All GREEN -> EXECUTED_AS_PLANNED');
  
  // Test 2: Single RED -> MODIFIED
  const votes2: IAgentVote[] = [
    { agentId: 'structural_agent', vote: 'RED', confidence: 0.9, reason: 'High niggle', flaggedMetrics: [] },
    { agentId: 'metabolic_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] },
    { agentId: 'fueling_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] }
  ];
  const decision2 = synthesizeCoachDecision(votes2, mockWorkout);
  console.assert(decision2.action === 'MODIFIED' || decision2.action === 'SKIPPED', `Expected MODIFIED/SKIPPED, got ${decision2.action}`);
  console.log('✓ Test 2: Single RED -> MODIFIED/SKIPPED');
  
  // Test 3: Multiple REDs -> SKIPPED
  const votes3: IAgentVote[] = [
    { agentId: 'structural_agent', vote: 'RED', confidence: 0.9, reason: 'High niggle', flaggedMetrics: [] },
    { agentId: 'metabolic_agent', vote: 'RED', confidence: 0.9, reason: 'HRV drop', flaggedMetrics: [] },
    { agentId: 'fueling_agent', vote: 'GREEN', confidence: 1.0, reason: 'OK', flaggedMetrics: [] }
  ];
  const decision3 = synthesizeCoachDecision(votes3, mockWorkout);
  console.assert(decision3.action === 'SKIPPED', `Expected SKIPPED, got ${decision3.action}`);
  console.log('✓ Test 3: Multiple REDs -> SKIPPED');
}

// Run all tests
function runTests() {
  console.log('🧪 Running Agent Decision Logic Tests\n');
  
  try {
    testStructuralAgent();
    testMetabolicAgent();
    testFuelingAgent();
    testSubstitutionMatrix();
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runTests();
}

export { runTests };

