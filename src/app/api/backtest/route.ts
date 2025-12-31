import { NextRequest, NextResponse } from 'next/server';
import { runWalkForwardBacktest } from '@/app/actions';
import { logger } from '@/lib/logger';

/**
 * API endpoint for walk-forward backtesting
 * 
 * GET /api/backtest?userId=xxx&startDate=2024-01-01&endDate=2024-12-31
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
    
    logger.info(`API: Running backtest for user ${userId} from ${startDate} to ${endDate}`);
    
    const result = await runWalkForwardBacktest(userId, startDate, endDate);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Backtest failed' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      results: result.results,
      accuracy: result.accuracy,
      baselineAccuracy: result.baselineAccuracy,
      improvement: result.improvement,
      meetsRequirement: (result.improvement || 0) > 20
    });
  } catch (error: any) {
    logger.error('API backtest error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backtest
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
    
    logger.info(`API: Running backtest for user ${userId} from ${startDate} to ${endDate}`);
    
    const result = await runWalkForwardBacktest(userId, startDate, endDate);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Backtest failed' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      results: result.results,
      accuracy: result.accuracy,
      baselineAccuracy: result.baselineAccuracy,
      improvement: result.improvement,
      meetsRequirement: (result.improvement || 0) > 20
    });
  } catch (error: any) {
    logger.error('API backtest error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
