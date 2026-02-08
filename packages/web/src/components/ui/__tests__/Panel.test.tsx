import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Panel } from '../Panel';

describe('Panel', () => {
  it('renders children', () => {
    render(<Panel>Panel Content</Panel>);
    expect(screen.getByText('Panel Content')).toBeInTheDocument();
  });

  it('applies base panel class', () => {
    const { container } = render(<Panel>Test</Panel>);
    expect(container.querySelector('.panel')).toBeInTheDocument();
  });

  it('applies subtle gradient by default', () => {
    const { container } = render(<Panel>Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).toHaveClass('panel-subtle');
  });

  it('applies brand gradient when specified', () => {
    const { container } = render(<Panel gradient="brand">Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).toHaveClass('panel-brand');
  });

  it('applies no gradient class when set to none', () => {
    const { container } = render(<Panel gradient="none">Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).not.toHaveClass('panel-brand');
    expect(panel).not.toHaveClass('panel-subtle');
  });

  it('applies hover class by default', () => {
    const { container } = render(<Panel>Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).toHaveClass('panel-hover');
  });

  it('does not apply hover class when hover is false', () => {
    const { container } = render(<Panel hover={false}>Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).not.toHaveClass('panel-hover');
  });

  it('applies custom className', () => {
    const { container } = render(<Panel className="extra">Test</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel).toHaveClass('extra');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Panel onClick={handleClick}>Clickable</Panel>);
    fireEvent.click(screen.getByText('Clickable'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
