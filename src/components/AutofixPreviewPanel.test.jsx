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

    // getByText throws if not found, so these calls verify the elements exist
    screen.getByText('Intelligent Repair');
    screen.getByText('Recommended Fix');

    const applyBtn = screen.getByRole('button', { name: /Apply Intelligent Repair/i });
    expect(applyBtn.disabled).toBe(false);

    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApplyPlan).toHaveBeenCalledWith(autofixPlan));
  });
});
