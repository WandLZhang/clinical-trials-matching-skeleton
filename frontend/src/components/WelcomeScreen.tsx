import React from 'react';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  isTransitioning?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, isTransitioning }) => {
  return (
    <div className="welcome-screen">
      <div className={`welcome-card ${isTransitioning ? 'fade-out' : ''}`}>
        <div className="welcome-logo">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>
            medical_services
          </span>
        </div>
        
        <h1 className="display-small welcome-title">
          <span className="title-part-1">Clinical Trials</span>{' '}
          <span className="title-part-2">Accelerator</span>
        </h1>
        
        <p className="body-large welcome-subtitle">
          Tooling for connecting and onboarding patients to trials
        </p>
        
        <button className="welcome-button" onClick={onGetStarted}>
          <span className="label-large">Get Started</span>
        </button>
      </div>
    </div>
  );
};
