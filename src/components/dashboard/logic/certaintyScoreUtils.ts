export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export function getScoreLabel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function getScoreBadgeClass(label: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (label) {
    case 'HIGH':
      return 'bg-green-900/30 text-green-400 border-green-900';
    case 'MEDIUM':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-900';
    case 'LOW':
      return 'bg-red-900/30 text-red-400 border-red-900';
  }
}

export function getProgressBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

