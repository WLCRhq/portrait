export default function LoadingSpinner({ light = false }) {
  const color = light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
  const accentColor = light ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    }}>
      <div style={{ position: 'relative', width: 80, height: 24 }}>
        {/* WLCR logo with pulse animation */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 921.4 254.8"
          style={{
            width: 80, height: 'auto',
            animation: 'logoFade 1.8s ease-in-out infinite',
          }}
        >
          <path fill={accentColor} d="M278.98,5.13h37.43l-45.43,212.44c-4.84,24.1-16.39,35.65-35.26,35.65s-31.41-10.86-37.04-33.88l-37.83-146.47-37.73,146.37c-5.63,23.01-17.78,33.88-36.74,33.88s-30.42-11.56-35.65-35.65L5.7,5.13h38.42l43.36,208.98L126.59,62.12c5.23-22.02,18.57-32.49,34.57-32.49s29.33,10.47,34.57,32.49l39.51,153.38L278.98,5.13Z"/>
          <path fill={accentColor} d="M352.36,249.67V5.13h36.74v185.48c0,14.72,10.47,24.49,24.49,24.49h76.24c10.47,0,18.57,7.7,18.57,17.09,0,10.17-8,17.48-18.57,17.48h-137.48Z"/>
          <path fill={accentColor} d="M508.3,127.4c0-69.53,52.74-125.82,126.81-125.82,27.75,0,53.33,8.89,73.78,24.1,8.49,6.32,9.58,18.57,2.47,26.47-6.02,6.72-16.2,7.9-23.6,2.67-14.91-10.37-33.09-16.49-52.64-16.49-49.58,0-87.41,39.11-87.41,89.08s37.73,89.08,87.41,89.08c25.18,0,47.9-10.17,64.29-26.57l24.49,25.88c-22.32,23.41-53.83,37.43-88.79,37.43-74.07,0-126.81-56.29-126.81-125.82h0Z"/>
          <path fill={accentColor} d="M915.7,249.67h-43.36l-57.58-97.87h-20.25v97.87h-36.74V5.13h76.15c42.27,0,75.45,32.49,75.45,73.38,0,33.88-22.42,61.53-53.43,70.22l59.75,100.94h0ZM831.55,117.23h.4c20.94,0,38.12-17.48,38.12-38.81s-17.09-38.81-38.12-38.81h-.4c-22.32,0-39.11,17.09-39.11,38.81s16.69,38.81,39.11,38.81Z"/>
        </svg>
      </div>

      {/* Shimmer bar */}
      <div style={{
        width: 80, height: 2, borderRadius: 1,
        background: color, overflow: 'hidden',
      }}>
        <div style={{
          width: '40%', height: '100%',
          background: accentColor,
          animation: 'shimmerSlide 1.2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes logoFade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
