const axios = require('axios');

async function testTimetableGeneration() {
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      withCredentials: true,
      jar: true
    });

    if (loginResponse.status === 200) {
      console.log('✅ Login successful');
      
      // Get the session cookie from the response
      const cookies = loginResponse.headers['set-cookie'];
      
      // Generate timetable for ID 9 (CSE-DS)
      console.log('🎯 Generating timetable for ID 9...');
      const generateResponse = await axios.post('http://localhost:5000/api/timetable/generate', {
        timetableId: 9
      }, {
        withCredentials: true,
        headers: {
          'Cookie': cookies.join('; ')
        }
      });

      if (generateResponse.status === 200) {
        console.log('✅ Timetable generated successfully!');
        console.log('Generated timetable data preview:', JSON.stringify(generateResponse.data, null, 2).substring(0, 500) + '...');
      } else {
        console.error('❌ Generation failed:', generateResponse.status, generateResponse.data);
      }
    } else {
      console.error('❌ Login failed:', loginResponse.status);
    }
  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
  }
}

testTimetableGeneration();
