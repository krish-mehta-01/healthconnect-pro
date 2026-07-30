export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-container">
      <div className="spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      <p className="loading-text">{message}</p>
    </div>
  );
}
