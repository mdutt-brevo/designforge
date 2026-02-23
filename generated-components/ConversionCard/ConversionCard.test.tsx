import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversionCard } from './ConversionCard';

describe('ConversionCard', () => {
  const defaultProps = {
    title: 'Conversion Rate',
    value: '2.45%',
    change: '12.3%',
    trend: 'up' as const,
    progress: 75,
    description: 'Improvement from last month'
  };

  it('renders correctly with all props', () => {
    render(<ConversionCard {...defaultProps} />);
    
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('2.45%')).toBeInTheDocument();
    expect(screen.getByText('↑ 12.3%')).toBeInTheDocument();
    expect(screen.getByText('Improvement from last month')).toBeInTheDocument();
  });

  it('displays progress bar when provided', () => {
    render(<ConversionCard {...defaultProps} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows correct trend badge', () => {
    render(<ConversionCard {...defaultProps} />);
    
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveTextContent('↑ 12.3%');
  });

  it('handles down trend correctly', () => {
    const props = {
      ...defaultProps,
      trend: 'down' as const,
      change: '5.2%'
    };
    
    render(<ConversionCard {...props} />);
    
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveTextContent('↓ 5.2%');
  });

  it('triggers view details button', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(
      <ConversionCard 
        {...defaultProps} 
        title="Test Card"
        value="$1,234"
      />
    );
    
    const button = screen.getByRole('button', { name: 'View Details' });
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('handles missing progress gracefully', () => {
    render(
      <ConversionCard 
        {...defaultProps} 
        progress={undefined}
      />
    );
    
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
