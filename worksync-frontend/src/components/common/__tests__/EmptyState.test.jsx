import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState.jsx';

describe('EmptyState component', () => {
  test('renders default title and description', () => {
    render(<EmptyState title="No Tasks Yet" description="Create your first task to get started." />);
    expect(screen.getByText('No Tasks Yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first task to get started.')).toBeInTheDocument();
  });

  test('renders action button and invokes onAction callback', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Projects"
        actionLabel="New Project"
        onAction={handleAction}
      />
    );
    const actionBtn = screen.getByRole('button', { name: /new project/i });
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  test('does not render button when actionLabel is omitted', () => {
    render(<EmptyState title="No Activity" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
