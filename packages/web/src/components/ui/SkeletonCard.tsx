export function SkeletonCard() {
  return (
    <div className="bg-layer-1 border border-white/10 rounded-lg p-6" data-testid="skeleton-card">
      <div className="skeleton h-3 w-2/5 mb-4" />
      <div className="skeleton h-9 w-3/5 mb-2" />
      <div className="skeleton h-4 w-1/3" />
    </div>
  );
}

export default SkeletonCard;
