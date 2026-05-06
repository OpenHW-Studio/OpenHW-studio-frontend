import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutofixPreviewPanel from './AutofixPreviewPanel.jsx';

describe('AutofixPreviewPanel', () => {
  it('shows the repair preview and calls the apply handler when clicked', async () => {
    const onApplyPlan = vi.fn();

    const autofixPlan = {
      description: 'Connect the LED to ground',
      confidence: 0.9,
      reasoning: ['The cathode is floating.', 'Adding a GND connection resolves the violation.'],
      addedComponents: [],
      addedWires: [{ id: 'wire-1' }],
      removedWires: [],
    };

    const errors = [{ message: 'Cathode floating', compIds: ['led1'] }];

    render(
      <AutofixPreviewPanel
        validationErrors={errors}
        autofixPlan={autofixPlan}
        onApplyPlan={onApplyPlan}
      />,
    );

    expect(screen.getByText('Intelligent Repair')).toBeInTheDocument();
    expect(screen.getByText('Recommended Fix')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply Intelligent Repair/i });
    expect(applyBtn).toBeEnabled();

    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApplyPlan).toHaveBeenCalledWith(autofixPlan));
  });
});
