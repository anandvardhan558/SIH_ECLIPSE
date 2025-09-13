const TimetableGenerator = require('./timetableAlgorithm');
const TimetableExporter = require('./exportUtils');

// Test the export functionality
const testConfig = {
  name: 'Test Export Timetable',
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

async function testExports() {
  console.log('🧪 Testing Export Functionality...');
  
  try {
    // Generate timetable
    const generator = new TimetableGenerator(testConfig);
    const timetableData = generator.generateTimetable();
    
    console.log('✅ Timetable generated successfully');
    
    // Test Excel export
    console.log('📊 Testing Excel export...');
    const exporter = new TimetableExporter(timetableData, testConfig);
    
    const excelBuffer = await exporter.exportToExcel();
    console.log('✅ Excel export successful, buffer size:', excelBuffer.length);
    
    // Test PDF export
    console.log('📄 Testing PDF export...');
    const pdfBuffer = await exporter.exportToPDF();
    console.log('✅ PDF export successful, buffer size:', pdfBuffer.length);
    
    console.log('\n🎉 All export tests PASSED!');
    
  } catch (error) {
    console.error('❌ Export test FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
}

testExports();
