import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RankedList } from '../RankedList';

const mockItems = [
  { id: '1', name: 'Agent Alpha', value: 100 },
  { id: '2', name: 'Agent Beta', value: 75, subtitle: 'Secondary agent' },
  { id: '3', name: 'Agent Gamma', value: 50, badge: 'new' },
];

describe('RankedList', () => {
  it('renders all items', () => {
    render(<RankedList items={mockItems} />);
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Agent Beta')).toBeInTheDocument();
    expect(screen.getByText('Agent Gamma')).toBeInTheDocument();
  });

  it('renders item values', () => {
    render(<RankedList items={mockItems} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders rank numbers', () => {
    const { container } = render(<RankedList items={mockItems} />);
    const ranks = container.querySelectorAll('.ranked-list-rank');
    expect(ranks).toHaveLength(3);
    expect(ranks[0]).toHaveTextContent('1');
    expect(ranks[1]).toHaveTextContent('2');
    expect(ranks[2]).toHaveTextContent('3');
  });

  it('renders subtitle when provided', () => {
    render(<RankedList items={mockItems} />);
    expect(screen.getByText('Secondary agent')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<RankedList items={mockItems} />);
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    render(<RankedList items={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(<RankedList items={[]} emptyMessage="Nothing to show" />);
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('renders empty action button', () => {
    const handleAction = vi.fn();
    render(
      <RankedList
        items={[]}
        emptyMessage="No items"
        emptyAction={handleAction}
        emptyActionLabel="Add item"
      />
    );
    const button = screen.getByText('Add item');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button without both action and label', () => {
    render(
      <RankedList items={[]} emptyAction={() => {}} />
    );
    // No button without label
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});
