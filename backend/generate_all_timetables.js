const axios = require('axios');

async function generateAllTimetables() {
  
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      withCredentials: true
    });

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    console.log('✅ Login successful');
    
    // Get cookies from login response
    const cookies = loginResponse.headers['set-cookie'] || [];
    const cookieString = cookies.join('; ');
    
    // IDs of timetables that need to be generated (excluding ID 9 which is already generated)
    const timetablesToGenerate = [10, 11, 12, 13];
    const names = ['cse', 'sjnxjc', 'it', 'ELECTRICAL'];
    
    console.log(`\n🎯 Generating timetables for ${timetablesToGenerate.length} configurations...\n`);
    
    // Generate each timetable
    for (let i = 0; i < timetablesToGenerate.length; i++) {
      const timetableId = timetablesToGenerate[i];
      const name = names[i];
      
      console.log(`⏳ Generating timetable ${i + 1}/${timetablesToGenerate.length}: ID ${timetableId} (${name})...`);
      
      try {
        const generateResponse = await axios.post('http://localhost:5000/api/timetable/generate', {
          timetableId: timetableId
        }, {
          headers: {
            'Cookie': cookieString,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        });

        if (generateResponse.status === 200) {
          console.log(`✅ Successfully generated timetable for ${name} (ID ${timetableId})`);
        } else {
          console.error(`❌ Failed to generate timetable for ${name} (ID ${timetableId}): ${generateResponse.status}`);
        }
      } catch (genError) {
        console.error(`❌ Error generating timetable for ${name} (ID ${timetableId}):`, genError.response?.data || genError.message);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Generation process completed! Checking final status...\n');
    
    // Verify results by checking database status
    const { exec } = require('child_process');
    exec('node check_timetable_status.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking status:', error);
        return;
      }
      console.log(stdout);
    });
    
  } catch (error) {
    console.error('❌ Error in generation process:', error.response?.data || error.message);
  }
}

generateAllTimetables();
