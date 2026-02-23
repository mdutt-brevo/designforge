import React from 'react';
import { Card, Button, Badge, Progress } from '@dtsl/react';

interface ConversionCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  progress?: number;
  description?: string;
}

export const ConversionCard: React.FC<ConversionCardProps> = ({
  title,
  value,
  change,
  trend,
  progress,
  description
}) => {
  return (
    <Card className="w-full max-w-md">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <div className="flex items-center mt-2">
            <Badge 
              variant={trend === 'up' ? 'success' : 'error'} 
              className="mr-2"
            >
              {trend === 'up' ? '↑' : '↓'} {change}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm">View Details</Button>
      </div>
      
      {description && (
        <p className="text-sm text-gray-600 mt-3">{description}</p>
      )}
      
      {progress !== undefined && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}
    </Card>
  );
};
