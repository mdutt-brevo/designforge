import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ConversionCard } from './ConversionCard';

const meta: Meta<typeof ConversionCard> = {
  title: 'Components/ConversionCard',
  component: ConversionCard,
  argTypes: {
    trend: {
      control: { type: 'radio' },
      options: ['up', 'down']
    }
  }
};

export default meta;

type Story = StoryObj<typeof ConversionCard>;

export const Default: Story = {
  args: {
    title: 'Conversion Rate',
    value: '2.45%',
    change: '12.3%',
    trend: 'up',
    progress: 75,
    description: 'Improvement from last month'
  }
};

export const WithDownTrend: Story = {
  args: {
    ...Default.args,
    trend: 'down',
    change: '5.2%',
    value: '1.89%'
  }
};

export const NoProgress: Story = {
  args: {
    ...Default.args,
    progress: undefined
  }
};

export const WithCustomDescription: Story = {
  args: {
    ...Default.args,
    description: 'This shows the conversion rate for the current campaign'
  }
};
