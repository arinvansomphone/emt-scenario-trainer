import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

export default function SelectionScreen() {
  const navigate = useNavigate();
  const [sunetId, setSunetId] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [medicalSubScenario, setMedicalSubScenario] = useState('');
  const [traumaSubScenario, setTraumaSubScenario] = useState('');
  const [difficulty, setDifficulty] = useState('novice');

  const scenarios = [
    'Medical Scenario',
    'Trauma Scenario'
  ];

  const medicalScenarios = [
    'Random Scenario',
    'Respiratory Scenario',
    'Cardiac Scenario',
    'Neurologic Scenario',
    'Metabolic Scenario',
    'Abdominal Scenario',
    'Environmental Scenario',
    'OB/GYN Scenario'
  ];

  const traumaScenarios = [
    'Random Scenario',
    'MVC Scenario',
    'Fall Scenario',
    'Assault Scenario',
    'Sport Injury Scenario',
    'Stabbing Scenario',
    'GSW Scenario',
    'Burn Scenario'
  ];

  const handleScenarioChange = (e) => {
    const newScenario = e.target.value;
    setSelectedScenario(newScenario);
    if (newScenario !== 'Medical Scenario') {
      setMedicalSubScenario('');
    }
    if (newScenario !== 'Trauma Scenario') {
      setTraumaSubScenario('');
    }
  };

  const isFormValid = () => {
    if (!sunetId.trim()) return false;
    
    if (selectedScenario === 'Medical Scenario') {
      return !!medicalSubScenario;
    }
    if (selectedScenario === 'Trauma Scenario') {
      return !!traumaSubScenario;
    }
    return false;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid()) {
      let finalSubScenario;
      
      // Handle random scenario selection
      if (selectedScenario === 'Medical Scenario') {
        if (medicalSubScenario === 'Random Scenario') {
          // Get all medical scenarios except 'Random Scenario'
          const availableMedicalScenarios = medicalScenarios.filter(scenario => scenario !== 'Random Scenario');
          // Randomly select one
          finalSubScenario = availableMedicalScenarios[Math.floor(Math.random() * availableMedicalScenarios.length)];
        } else {
          finalSubScenario = medicalSubScenario;
        }
      } else if (selectedScenario === 'Trauma Scenario') {
        if (traumaSubScenario === 'Random Scenario') {
          // Get all trauma scenarios except 'Random Scenario'
          const availableTraumaScenarios = traumaScenarios.filter(scenario => scenario !== 'Random Scenario');
          // Randomly select one
          finalSubScenario = availableTraumaScenarios[Math.floor(Math.random() * availableTraumaScenarios.length)];
        } else {
          finalSubScenario = traumaSubScenario;
        }
      }
      
      // Create scenario data object
      const scenarioData = {
        sunetId: sunetId,
        mainScenario: selectedScenario,
        subScenario: finalSubScenario,
        difficulty: difficulty
      };
      
      // Navigate to app with scenario data
      navigate('/app', { state: scenarioData });
    }
  };

  return (
    <div style={{ height: '100vh', background: '#3b82f6', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ 
        flex: 1,
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: '500px',
          minWidth: '320px'
        }}>
          <h1 style={{ 
            fontSize: '2.25rem',
            fontWeight: 'bold',
            marginBottom: '2rem',
            color: '#E60000',
            textAlign: 'center'
          }}>
            EMED Scenario Trainer
          </h1>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block',
                marginBottom: '0.5rem',
                color: '#000000',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Enter your name
              </label>
              <input
                type="text"
                value={sunetId}
                onChange={(e) => setSunetId(e.target.value)}
                placeholder=""
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                  color: '#000000'
                }}
                required
              />
            </div>

            <div style={{ width: '100%' }}>
              <select
                value={selectedScenario}
                onChange={handleScenarioChange}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                  color: '#000000'
                }}
                required
              >
                <option value="">Choose a scenario</option>
                {scenarios.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {scenario}
                  </option>
                ))}
              </select>
            </div>

            {selectedScenario === 'Medical Scenario' && (
              <div style={{ width: '100%' }}>
                <select
                  value={medicalSubScenario}
                  onChange={(e) => setMedicalSubScenario(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: 'white',
                    boxSizing: 'border-box',
                    color: '#000000'
                  }}
                  required
                >
                  <option value="">Choose a medical scenario</option>
                  {medicalScenarios.map((scenario) => (
                    <option key={scenario} value={scenario}>
                      {scenario}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedScenario === 'Trauma Scenario' && (
              <div style={{ width: '100%' }}>
                <select
                  value={traumaSubScenario}
                  onChange={(e) => setTraumaSubScenario(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: 'white',
                    boxSizing: 'border-box',
                    color: '#000000'
                  }}
                  required
                >
                  <option value="">Choose a trauma scenario</option>
                  {traumaScenarios.map((scenario) => (
                    <option key={scenario} value={scenario}>
                      {scenario}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#000000',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Difficulty
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { value: 'novice',       label: 'Beginner',     active: '#16a34a', bg: '#dcfce7', text: '#14532d' },
                  { value: 'intermediate', label: 'Intermediate',  active: '#d97706', bg: '#fef3c7', text: '#78350f' },
                  { value: 'advanced',     label: 'Hard',          active: '#dc2626', bg: '#fee2e2', text: '#7f1d1d' }
                ].map(({ value, label, active, bg, text }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0',
                      borderRadius: '0.5rem',
                      border: `2px solid ${difficulty === value ? active : '#D1D5DB'}`,
                      backgroundColor: difficulty === value ? bg : 'white',
                      color: difficulty === value ? text : '#6B7280',
                      fontWeight: difficulty === value ? '600' : '400',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!isFormValid()}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                backgroundColor: isFormValid() ? '#FFEBEB' : '#E5E7EB',
                color: isFormValid() ? '#000000' : '#9CA3AF',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: isFormValid() ? 'pointer' : 'not-allowed'
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
