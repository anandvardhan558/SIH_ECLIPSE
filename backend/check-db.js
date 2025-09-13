const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking Database Schema...');

db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='timetables'", (err, row) => {
  if (err) {
    console.error('❌ Error:', err);
    return;
  }
  
  console.log('✅ Timetables table schema:');
  console.log(row.sql);
  
  // Check existing data
  db.all("SELECT id, name, is_generated, length(generated_timetable) as data_length FROM timetables", (err, rows) => {
    if (err) {
      console.error('❌ Error fetching data:', err);
    } else {
      console.log('\n📊 Existing timetables:');
      rows.forEach(row => {
        console.log(`- ID: ${row.id}, Name: ${row.name}, Generated: ${row.is_generated}, Data Length: ${row.data_length || 0}`);
      });
    }
    
    db.close();
  });
});
