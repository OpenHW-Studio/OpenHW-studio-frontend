import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutofixPreviewPanel from './AutofixPreviewPanel.jsx';

describe('AutofixPreviewPanel (mocked runAutoFixAll)', () => {
  it('shows preview and calls apply handler when Apply All clicked', async () => {
    const fakePreview = {
      applied: true,
      appliedCount: 1,
      skippedCount: 0,
      appliedPlan: [ { issue: { message: 'Connect to GND' }, changeSet: { addedConnections: [{ from: 'led', to: 'GND' }] }, verification: { confidence: 0.9 } } ],
    };

    const runAutoFixAll = vi.fn().mockImplementation(async (project, errors, opts) => {
      // return dry-run preview for apply:false, and real apply result for apply:true
      if (opts && opts.apply) return { ...fakePreview, applied: true };
      return { ...fakePreview, applied: true, appliedCount: 1, finalProject: { components: project.components, connections: fakePreview.appliedPlan[0].changeSet.addedConnections } };
    });

    const onApplyPlan = vi.fn();

    const project = { components: [{ id: 'led1', type: 'LED' }], connections: [] };
    const errors = [{ message: 'Cathode floating', compIds: ['led1'] }];

    render(<AutofixPreviewPanel project={project} validationErrors={errors} runAutoFixAll={runAutoFixAll} onApplyPlan={onApplyPlan} />);

    // Preview fixes button enabled
    const previewBtn = screen.getByText('Preview fixes');
    expect(previewBtn.disabled).toBe(false);

    // Click preview
    fireEvent.click(previewBtn);

    // wait for preview to render
    await waitFor(() => {
      const el = screen.getByText(/Applied:/);
      expect(el.textContent).toContain('Applied: 1');
    });

    // Apply All should be enabled now
    const applyBtn = screen.getByText('Apply All');
    expect(applyBtn.disabled).toBe(false);

    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApplyPlan).toHaveBeenCalled());
    expect(runAutoFixAll).toHaveBeenCalledTimes(2);
  });
});
