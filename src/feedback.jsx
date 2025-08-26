import React from 'react';
import Header from './Header';

export default function About() {
  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFF0F6 0%, #F5F0FF 100%)',
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
        marginTop: '76px', // Adjust this value based on your header height
        flexGrow: 1,
        padding: '2rem',
      }}>
        {/* About page content will go here */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#333'
        }}>
          About EMT Scenario Trainer
        </h1>
        <p style={{
          fontSize: '1rem',
          lineHeight: '1.5',
          color: '#666',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          EMT Scenario Trainer is an innovative application designed to help Emergency Medical Technicians (EMTs) practice and improve their skills in a variety of medical scenarios. Our platform provides realistic, challenging situations that EMTs might encounter in the field, allowing them to make critical decisions in a safe, controlled environment.
        </p>
        {/* Add more content as needed */}
      </div>
    </div>
  );
}