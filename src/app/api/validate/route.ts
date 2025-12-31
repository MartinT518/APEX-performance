import { NextRequest, NextResponse } from 'next/server';
import { runWalkForwardBacktest } from '@/app/actions';
import { logger } from '@/lib/logger';

/**
 * Validation endpoint for walk-forward backtesting
 * 
 * Automatically runs backtest and checks if accuracy > baseline + 20%
 * Can be integrated into CI/CD pipeline
 * 
 * GET /api/validate?userId=xxx&startDate=2024-01-01&endDate=2024-12-31
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!userId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, startDate, endDate' },
        { status: 400 }
      );
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    logger.info(`Validation: Running backtest for user ${userId} from ${startDate} to ${endDate}`);
    
    const result = await runWalkForwardBacktest(userId, startDate, endDate);
    
    if (!result.success) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || 'Backtest failed',
          message: 'Validation failed: Backtest could not be completed'
        },
        { status: 500 }
      );
    }
    
    const improvement = result.improvement || 0;
    const meetsRequirement = improvement > 20;
    
    logger.info(`Validation result: Improvement = ${improvement.toFixed(1)}%, Requirement = >20%, Valid = ${meetsRequirement}`);
    
    return NextResponse.json({
      valid: meetsRequirement,
      accuracy: result.accuracy,
      baselineAccuracy: result.baselineAccuracy,
      improvement: improvement,
      requirement: '>20%',
      message: meetsRequirement
        ? `Validation PASSED: Improvement (${improvement.toFixed(1)}%) exceeds 20% threshold`
        : `Validation FAILED: Improvement (${improvement.toFixed(1)}%) does not meet 20% threshold`,
      details: {
        totalDays: result.results?.length || 0,
        correctPredictions: result.results?.filter(r => r.correct).length || 0,
        truePositives: result.results?.filter(r => r.systemVeto && r.actualInjury).length || 0,
        trueNegatives: result.results?.filter(r => !r.systemVeto && !r.actualInjury).length || 0,
        falsePositives: result.results?.filter(r => r.systemVeto && !r.actualInjury).length || 0,
        falseNegatives: result.results?.filter(r => !r.systemVeto && r.actualInjury).length || 0
      }
    });
  } catch (error: any) {
    logger.error('Validation error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: error?.message || 'Internal server error',
        message: 'Validation failed due to internal error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/validate
 * Body: { userId, startDate, endDate }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, startDate, endDate } = body;
    
    if (!userId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, startDate, endDate' },
        { status: 400 }
      );
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    logger.info(`Validation: Running backtest for user ${userId} from ${startDate} to ${endDate}`);
    
    const result = await runWalkForwardBacktest(userId, startDate, endDate);
    
    if (!result.success) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || 'Backtest failed',
          message: 'Validation failed: Backtest could not be completed'
        },
        { status: 500 }
      );
    }
    
    const improvement = result.improvement || 0;
    const meetsRequirement = improvement > 20;
    
    logger.info(`Validation result: Improvement = ${improvement.toFixed(1)}%, Requirement = >20%, Valid = ${meetsRequirement}`);
    
    return NextResponse.json({
      valid: meetsRequirement,
      accuracy: result.accuracy,
      baselineAccuracy: result.baselineAccuracy,
      improvement: improvement,
      requirement: '>20%',
      message: meetsRequirement
        ? `Validation PASSED: Improvement (${improvement.toFixed(1)}%) exceeds 20% threshold`
        : `Validation FAILED: Improvement (${improvement.toFixed(1)}%) does not meet 20% threshold`,
      details: {
        totalDays: result.results?.length || 0,
        correctPredictions: result.results?.filter(r => r.correct).length || 0,
        truePositives: result.results?.filter(r => r.systemVeto && r.actualInjury).length || 0,
        trueNegatives: result.results?.filter(r => !r.systemVeto && !r.actualInjury).length || 0,
        falsePositives: result.results?.filter(r => r.systemVeto && !r.actualInjury).length || 0,
        falseNegatives: result.results?.filter(r => !r.systemVeto && r.actualInjury).length || 0
      }
    });
  } catch (error: any) {
    logger.error('Validation error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: error?.message || 'Internal server error',
        message: 'Validation failed due to internal error'
      },
      { status: 500 }
    );
  }
}
