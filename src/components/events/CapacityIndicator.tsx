import { Progress } from '@/components/ui/progress';

interface CapacityIndicatorProps {
  current: number;
  max: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md';
}

export function CapacityIndicator({ 
  current, 
  max, 
  showPercentage = false,
  size = 'md'
}: CapacityIndicatorProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const remaining = max - current;
  
  let colorClass = 'bg-green-500';
  if (percentage >= 90) colorClass = 'bg-destructive';
  else if (percentage >= 70) colorClass = 'bg-yellow-500';
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          {remaining > 0 ? `${remaining} plazas disponibles` : 'Agotado'}
        </span>
        {showPercentage && (
          <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium`}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${size === 'sm' ? 'h-1.5' : ''}`}
      />
    </div>
  );
}
