import React from 'react';
import Header from './Header';

export default function About() {
  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#1e3a8a',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white'
      }}>
        <Header />
      </div>
      <div style={{
        marginTop: '76px',
        flexGrow: 1,
        padding: '6rem 1rem 2rem',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#000000',
            marginBottom: '1.5rem',
            marginTop: '0'
          }}>
            About EMED Scenario Trainer
          </h1>
          <p style={{
            fontSize: '1rem',
            lineHeight: '1.6',
            color: '#000000',
            marginBottom: '1rem'
          }}>
            EMED Scenario Trainer is a platform designed to help EMT students practice and improve their reasoning and communication abilities in a variety of medical and trauma scenarios. The site provides realistic situations that EMTs might encounter in the field, allowing them to practice their skills in an accessible place.
          </p>
          <p style={{
            fontSize: '1rem',
            lineHeight: '1.6',
            color: '#000000',
          }}>
            Questions? Feedback? Email{' '}
            <a 
              href="mailto:arinv@stanford.edu" 
              style={{
                color: '#0000FF',
                textDecoration: 'none',
                fontWeight: 'normal'
              }}
            >
              arinv@stanford.edu
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}