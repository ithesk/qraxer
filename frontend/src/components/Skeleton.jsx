/**
 * Skeleton Loader Components
 * iOS-style shimmer loading states
 */

// Base skeleton with shimmer
export function Skeleton({ width, height, radius = 'var(--radius-sm)', style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        width: width || '100%',
        height: height || '16px',
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

// Text line skeleton
export function SkeletonText({ width = '100%', lines = 1, gap = 8 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? '70%' : width}
          height="14px"
        />
      ))}
    </div>
  );
}

// Avatar skeleton
export function SkeletonAvatar({ size = 40 }) {
  return (
    <Skeleton
      width={size}
      height={size}
      radius="var(--radius-full)"
    />
  );
}

// Client card skeleton
export function SkeletonClientCard() {
  return (
    <div
      className="client-card"
      style={{ cursor: 'default', pointerEvents: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <SkeletonAvatar size={40} />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="16px" style={{ marginBottom: '6px' }} />
          <Skeleton width="40%" height="14px" />
        </div>
      </div>
      <Skeleton width="60px" height="36px" radius="var(--radius-sm)" />
    </div>
  );
}

// History item skeleton
export function SkeletonHistoryItem() {
  return (
    <div className="history-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <div className="history-item-info">
        <Skeleton width="50%" height="15px" style={{ marginBottom: '6px' }} />
        <Skeleton width="70%" height="13px" />
      </div>
      <Skeleton width="70px" height="24px" radius="var(--radius-full)" />
    </div>
  );
}

// Multiple history items
export function SkeletonHistoryList({ count = 3 }) {
  return (
    <div className="history-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonHistoryItem key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
