export default function Skeleton({ className = '', style = {}, ...props }) {
  return (
    <div className={`skeleton-loading ${className}`} style={{
      background: 'linear-gradient(90deg, #121212 25%, #222222 50%, #121212 75%)',
      backgroundSize: '400% 100%',
      animation: 'skeletonLoading 1.6s infinite ease-in-out',
      borderRadius: '8px',
      ...style
    }} {...props}>
      <style jsx>{`
        @keyframes skeletonLoading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
