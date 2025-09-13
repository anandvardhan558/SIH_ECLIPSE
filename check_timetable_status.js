const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking timetable status in database...\n');

// Check timetable table schema
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='timetables'", (err, row) => {
  if (err) {
    console.error('Error getting schema:', err);
    return;
  }
  console.log('📋 Table schema:');
  console.log(row.sql);
  console.log('\n');
});

// Check all timetables and their status
db.all("SELECT id, name, is_generated, CASE WHEN generated_timetable IS NULL THEN 'NULL' ELSE 'Has Data' END as generated_data, created_at FROM timetables", (err, rows) => {
  if (err) {
    console.error('Error fetching timetables:', err);
    return;
  }

  console.log('📊 All timetables:');
  console.table(rows.map(row => ({
    ID: row.id,
    Name: row.name,
    'Is Generated': row.is_generated ? 'Yes' : 'No',
    'Generated Data': row.generated_data,
    'Created': new Date(row.created_at).toLocaleString()
  })));

  console.log('\n');
  
  // Check if any timetables have generated data but is_generated is false
  const inconsistent = rows.filter(row => row.generated_data === 'Has Data' && !row.is_generated);
  if (inconsistent.length > 0) {
    console.log('⚠️  Found timetables with generated data but is_generated = false:');
    console.table(inconsistent.map(row => ({
      ID: row.id,
      Name: row.name,
      'Is Generated': row.is_generated ? 'Yes' : 'No',
      'Generated Data': row.generated_data
    })));
    
    console.log('\n💡 You may need to fix these by running:');
    inconsistent.forEach(row => {
      console.log(`UPDATE timetables SET is_generated = 1 WHERE id = ${row.id};`);
    });
  } else {
    console.log('✅ All timetables have consistent status.');
  }

  db.close();
});
