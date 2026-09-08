// test-backend.js
// Run this with: node test-backend.js

async function testBackend() {
    console.log('Testing backend connection...\n');
    
    // Test 1: Root endpoint
    try {
      console.log('1. Testing root endpoint:');
      const response = await fetch('http://localhost:8000/');
      const data = await response.json();
      console.log('✅ Status:', response.status);
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('\n---\n');
    
    // Test 2: Mappings endpoint
    try {
      console.log('2. Testing mappings endpoint:');
      const response = await fetch('http://localhost:8000/api/mappings');
      const data = await response.json();
      console.log('✅ Status:', response.status);
      console.log('✅ Response:', Array.isArray(data) ? `${data.length} mappings found` : data);
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('\n---\n');
    
    // Test 3: Document identification with a test file
    try {
      console.log('3. Testing document identification:');
      
      // Create a test XML content
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <ClinicalDocument>
    <recordTarget>
      <patientRole>
        <id root="2.16.840.1.113883.19.5" extension="12345"/>
      </patientRole>
    </recordTarget>
  </ClinicalDocument>`;
      
      // Create a File object
      const file = new File([xmlContent], 'test.xml', { type: 'text/xml' });
      
      // Create FormData
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('http://localhost:8000/api/internal/identify-document', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      console.log('✅ Status:', response.status);
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  testBackend();