import { useState } from 'react';

export default function TestConnection() {
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const testAPI = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello, this is a test message',
          conversation: []
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTestResult('✅ API Connection Successful! Backend is working.');
      } else {
        setTestResult(`❌ API Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult('❌ Connection Failed: Make sure the backend server is running on port 3000');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>API Connection Test</h2>
      <button 
        onClick={testAPI}
        disabled={isTesting}
        style={{
          padding: '10px 20px',
          backgroundColor: '#E60000',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isTesting ? 'not-allowed' : 'pointer',
          opacity: isTesting ? 0.6 : 1
        }}
      >
        {isTesting ? 'Testing...' : 'Test API Connection'}
      </button>
      
      {testResult && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px',
          backgroundColor: testResult.includes('✅') ? '#d4edda' : '#f8d7da',
          borderRadius: '5px',
          color: testResult.includes('✅') ? '#155724' : '#721c24'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
} 