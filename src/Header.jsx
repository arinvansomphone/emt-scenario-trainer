import { Link, useNavigate } from 'react-router-dom';

export default function Header({ timeLeft, isTimerRunning }) {
  const navigate = useNavigate();

  const handleTitleClick = () => {
    navigate('/');
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 bg-white shadow-md z-50"
      style={{ 
        boxSizing: 'border-box', 
        margin: 0, 
        padding: 0,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ 
          position: 'relative',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px'
        }}
      >
        <span 
          className="text-base font-extrabold header-inter"
          style={{ 
            fontWeight: 800,
            fontFamily: "'Inter', sans-serif",
            color: '#000000',
            cursor: 'pointer'
          }}
          onClick={handleTitleClick}
        >
          EMED Scenario Trainer
        </span>
        
        {/* Timer in center */}
        {isTimerRunning && (
          <div 
            className="text-center"
            style={{ 
              color: timeLeft <= 60 ? '#E60000' : '#000000',
              fontSize: '1.25rem',
              fontWeight: '500',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            {formatTime(timeLeft)}
          </div>
        )}
        
        <Link
          to="/about"
          className="text-base font-normal about-link"
          style={{
            color: '#000000',
            textDecoration: 'none',
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          About
        </Link>
      </div>
    </header>
  );
}