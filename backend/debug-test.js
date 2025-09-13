const TimetableGenerator = require('./timetableAlgorithm');

// Test the algorithm directly
const testConfig = {
  name: 'Test Timetable',
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

console.log('🧪 Testing Timetable Algorithm Directly...');

try {
  const generator = new TimetableGenerator(testConfig);
  const result = generator.generateTimetable();
  
  console.log('✅ Algorithm Test PASSED!');
  console.log('Generated data structure:');
  console.log('- Days:', result.days.length);
  console.log('- Time slots:', result.timeSlots.length);
  console.log('- Total classes:', result.metadata.totalClasses);
  console.log('- Teachers:', result.metadata.teachers);
  
  // Check if we can stringify it (JSON compatibility)
  const jsonString = JSON.stringify(result);
  console.log('✅ JSON serialization successful, length:', jsonString.length);
  
  // Parse it back
  const parsed = JSON.parse(jsonString);
  console.log('✅ JSON parsing successful');
  
} catch (error) {
  console.error('❌ Algorithm Test FAILED:', error.message);
  console.error('Stack:', error.stack);
}
