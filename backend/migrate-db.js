const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Migrating Database...');

// Add missing columns
db.serialize(() => {
  // Add generated_timetable column
  db.run(`ALTER TABLE timetables ADD COLUMN generated_timetable TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding generated_timetable column:', err.message);
    } else {
      console.log('✅ generated_timetable column added/exists');
    }
  });
  
  // Add is_generated column
  db.run(`ALTER TABLE timetables ADD COLUMN is_generated BOOLEAN DEFAULT FALSE`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding is_generated column:', err.message);
    } else {
      console.log('✅ is_generated column added/exists');
    }
  });
  
  // Verify the schema
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='timetables'", (err, row) => {
    if (err) {
      console.error('❌ Error:', err);
    } else {
      console.log('\n🎉 Updated schema:');
      console.log(row.sql);
    }
    
    db.close(() => {
      console.log('\n✅ Database migration complete!');
    });
  });
});
