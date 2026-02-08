import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies default primary variant', () => {
    const { container } = render(<Button>Test</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-primary');
  });

  it('applies secondary variant', () => {
    const { container } = render(<Button variant="secondary">Test</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-secondary');
  });

  it('applies danger variant', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-danger');
  });

  it('applies ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-ghost');
  });

  it('applies size classes correctly', () => {
    const { container: sm } = render(<Button size="sm">S</Button>);
    expect(sm.querySelector('button')).toHaveClass('btn-sm');

    const { container: md } = render(<Button size="md">M</Button>);
    expect(md.querySelector('button')).toHaveClass('btn-md');

    const { container: lg } = render(<Button size="lg">L</Button>);
    expect(lg.querySelector('button')).toHaveClass('btn-lg');
  });

  it('sets button type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    const btn = screen.getByText('Submit');
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('defaults to button type', () => {
    render(<Button>Test</Button>);
    const btn = screen.getByText('Test');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Test</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('custom-class');
  });

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });
});
