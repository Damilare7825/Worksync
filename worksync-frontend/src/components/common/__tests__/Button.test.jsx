import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button.jsx';
import { Check } from 'lucide-react';

describe('Button component', () => {
  test('renders children label correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('applies disabled state and prevents click handler invocation', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled Action
      </Button>
    );
    const button = screen.getByRole('button', { name: /disabled action/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders with icon and custom variant classes', () => {
    render(
      <Button variant="danger" icon={Check}>
        Delete Item
      </Button>
    );
    const button = screen.getByRole('button', { name: /delete item/i });
    expect(button.className).toContain('bg-red-600');
  });
});
