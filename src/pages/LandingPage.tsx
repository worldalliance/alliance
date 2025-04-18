import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Globe from '../components/Globe';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="content">
        <div className="row">
          <Navbar isHomePage={true} />
        </div>
        <p className="intro-text">
          An online democratic polity to solve the world's most pressing issues in climate, AI, inequality, and other such things like that.
        </p>
        <div className="row stats-container">
          <div className="column" style={{ textAlign: 'right' }}>
            <p><strong>12,643</strong> members</p>
            <p><strong>$99,999,999</strong> donated to land conservation</p>
            <p><strong>6</strong> landlords disembowled </p>
          </div>
          <Globe />
          <div className="column" style={{ textAlign: 'left' }}>
            <p>Feeding <strong>3</strong> baby calves daily</p>
            <p>Saved <strong>2000</strong> shrimp souls</p>
            <p>Lorem'd <strong>3</strong> ipsums</p>
          </div>
        </div>
        <Link to="/home" className="join-link">Join Today.</Link>
      </div>
    </div>
  );
};

export default LandingPage;