const TimetableGenerator = require('./timetableAlgorithm');

console.log('🧪 Testing Timetable Algorithm...');

// Test configuration
const testConfig = {
  name: 'Test Timetable',
  classrooms: 3,
  batches: 2,
  subjects: ['Mathematics', 'Programming', 'Physics', 'English'],
  maxClassesPerDay: 6,
  classesPerSubject: {
    'Mathematics': 4,
    'Programming': 5,
    'Physics': 3,
    'English': 2
  },
  faculties: {
    'Mathematics': 'Dr. Smith',
    'Programming': 'Prof. Johnson',
    'Physics': 'Dr. Brown',
    'English': 'Ms. Davis'
  },
  fixedSlots: {}
};

try {
  console.log('✅ Creating TimetableGenerator instance...');
  const generator = new TimetableGenerator(testConfig);
  
  console.log('✅ TimetableGenerator created successfully');
  console.log('✅ Config loaded:', {
    subjects: generator.config.subjects.length,
    days: generator.days.length,
    timeSlots: generator.timeSlots.length
  });
  
  console.log('🚀 Generating timetable...');
  const result = generator.generateTimetable();
  
  console.log('✅ Timetable generated successfully!');
  console.log('📊 Results:', {
    totalClasses: result.metadata.totalClasses,
    teachers: result.metadata.teachers,
    subjects: result.metadata.subjects,
    days: result.days.length,
    timeSlots: result.timeSlots.length
  });
  
  console.log('🎉 Algorithm test PASSED!');
} catch (error) {
  console.error('❌ Algorithm test FAILED:', error.message);
  console.error('Stack trace:', error.stack);
}
