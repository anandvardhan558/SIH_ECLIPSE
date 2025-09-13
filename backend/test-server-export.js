const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api';

async function testServerExport() {
  console.log('🧪 Testing Server Export Endpoints...');

  try {
    const jar = new tough.CookieJar();
    const client = wrapper(axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      jar
    }));

    // Login
    console.log('✅ Logging in...');
    await client.post(`/login`, {
      username: 'admin',
      password: 'admin123'
    });

    // Save timetable
    console.log('✅ Saving test timetable...');
    const timetableData = {
      name: 'Export Test Timetable',
      classrooms: 3,
      batches: 2,
      subjects: ['Mathematics', 'Programming', 'Physics'],
      maxClassesPerDay: 6,
      classesPerSubject: {
        'Mathematics': 4,
        'Programming': 5,
        'Physics': 3
      },
      faculties: {
        'Mathematics': 'Dr. Smith',
        'Programming': 'Prof. Johnson',
        'Physics': 'Dr. Brown'
      },
      fixedSlots: {}
    };

    const saveResponse = await client.post(`/timetable/save`, timetableData);
    const timetableId = saveResponse.data.id;
    console.log('✅ Timetable saved with ID:', timetableId);

    // Generate timetable
    console.log('✅ Generating timetable...');
    await client.post(`/timetable/generate`, { timetableId });

    // Test Excel export
    console.log('📊 Testing Excel export endpoint...');
    try {
      const excelResponse = await client.get(`/timetable/export/excel/${timetableId}`, {
        responseType: 'arraybuffer'
      });
      console.log('✅ Excel export successful, size:', excelResponse.data.byteLength);
      
      // Save file to verify
      fs.writeFileSync('test_export.xlsx', excelResponse.data);
      console.log('✅ Excel file saved as test_export.xlsx');
      
    } catch (excelError) {
      console.error('❌ Excel export failed:', excelError.response?.data?.toString() || excelError.message);
    }

    // Test PDF export
    console.log('📄 Testing PDF export endpoint...');
    try {
      const pdfResponse = await client.get(`/timetable/export/pdf/${timetableId}`, {
        responseType: 'arraybuffer'
      });
      console.log('✅ PDF export successful, size:', pdfResponse.data.byteLength);
      
      // Save file to verify
      fs.writeFileSync('test_export.pdf', pdfResponse.data);
      console.log('✅ PDF file saved as test_export.pdf');
      
    } catch (pdfError) {
      console.error('❌ PDF export failed:', pdfError.response?.data?.toString() || pdfError.message);
    }

    console.log('\n🎉 Server export test completed!');

  } catch (error) {
    console.error('❌ Server export test FAILED:', error.response?.data || error.message);
  }
}

testServerExport();
