import React, { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AgentTransitionFlow } from './components/AgentTransitionFlow';
import './App.css';

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleGetStarted = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(1);
      setIsTransitioning(false);
    }, 500); // Wait for fade-out animation
  };

  const handleAgentFlowComplete = () => {
    console.log('Agent flow complete');
    // Future: Move to Agent 4 or final results
  };

  return (
    <div>
      {currentStep === 0 && (
        <WelcomeScreen 
          onGetStarted={handleGetStarted} 
          isTransitioning={isTransitioning}
        />
      )}
      {currentStep === 1 && (
        <AgentTransitionFlow 
          onComplete={handleAgentFlowComplete}
        />
      )}
    </div>
  );
};
