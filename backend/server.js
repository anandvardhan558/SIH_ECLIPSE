const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const TimetableGenerator = require('./timetableAlgorithm');
const TimetableExporter = require('./exportUtils');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Configure CORS origins
const corsOrigins = process.env.CORS_ORIGIN 
  ? [process.env.CORS_ORIGIN]
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: 'college-timetable-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Timetables table
  db.run(`CREATE TABLE IF NOT EXISTS timetables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    classrooms INTEGER NOT NULL,
    batches INTEGER NOT NULL,
    subjects TEXT NOT NULL,
    max_classes_per_day INTEGER NOT NULL,
    classes_per_subject TEXT NOT NULL,
    faculties TEXT NOT NULL,
    fixed_slots TEXT,
    generated_timetable TEXT,
    is_generated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Seed demo user if not exists
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, 
    ['admin', hashedPassword], function(err) {
      if (err) {
        console.error('Error seeding demo user:', err);
      } else {
        console.log('Demo user seeded (username: admin, password: admin123)');
      }
    });
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Routes

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ 
      message: 'Login successful', 
      user: { id: user.id, username: user.username } 
    });
  });
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Check session route
app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      authenticated: true, 
      user: { id: req.session.userId, username: req.session.username } 
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Save timetable route
app.post('/api/timetable/save', requireAuth, (req, res) => {
  const {
    name,
    classrooms,
    batches,
    subjects,
    maxClassesPerDay,
    classesPerSubject,
    faculties,
    fixedSlots
  } = req.body;

  if (!name || !classrooms || !batches || !subjects || !maxClassesPerDay) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const query = `INSERT INTO timetables 
    (user_id, name, classrooms, batches, subjects, max_classes_per_day, classes_per_subject, faculties, fixed_slots)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    req.session.userId,
    name,
    classrooms,
    batches,
    JSON.stringify(subjects),
    maxClassesPerDay,
    JSON.stringify(classesPerSubject || {}),
    JSON.stringify(faculties || {}),
    JSON.stringify(fixedSlots || {})
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to save timetable' });
    }

    const timetableId = this.lastID;

    // Auto-generate timetable after saving
    try {
      const config = {
        name,
        classrooms,
        batches,
        subjects,
        maxClassesPerDay,
        classesPerSubject: classesPerSubject || {},
        faculties: faculties || {},
        fixedSlots: fixedSlots || {}
      };

      // Generate timetable
      const generator = new TimetableGenerator(config);
      const generatedTimetable = generator.generateTimetable();

      // Save generated timetable
      const updateQuery = `UPDATE timetables SET generated_timetable = ?, is_generated = TRUE WHERE id = ?`;
      
      db.run(updateQuery, [JSON.stringify(generatedTimetable), timetableId], function(updateErr) {
        if (updateErr) {
          console.error('Database error during auto-generation:', updateErr);
          // Still return success for the save, even if generation failed
          return res.json({ 
            message: 'Timetable saved successfully, but auto-generation failed', 
            id: timetableId,
            generated: false
          });
        }

        res.json({ 
          message: 'Timetable saved and generated successfully', 
          id: timetableId,
          generated: true,
          timetable: generatedTimetable
        });
      });

    } catch (genError) {
      console.error('Generation error during auto-generation:', genError);
      // Still return success for the save, even if generation failed
      res.json({ 
        message: 'Timetable saved successfully, but auto-generation failed', 
        id: timetableId,
        generated: false,
        error: genError.message
      });
    }
  });
});

// Get timetables route
app.get('/api/timetable/get', requireAuth, (req, res) => {
  const query = `SELECT * FROM timetables WHERE user_id = ? ORDER BY created_at DESC`;

  db.all(query, [req.session.userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to fetch timetables' });
    }

    const timetables = rows.map(row => ({
      id: row.id,
      name: row.name,
      classrooms: row.classrooms,
      batches: row.batches,
      subjects: JSON.parse(row.subjects || '[]'),
      maxClassesPerDay: row.max_classes_per_day,
      classesPerSubject: JSON.parse(row.classes_per_subject || '{}'),
      faculties: JSON.parse(row.faculties || '{}'),
      fixedSlots: JSON.parse(row.fixed_slots || '{}'),
      isGenerated: Boolean(row.is_generated),
      createdAt: row.created_at
    }));

    res.json(timetables);
  });
});

// Delete timetable route
app.delete('/api/timetable/:id', requireAuth, (req, res) => {
  const timetableId = req.params.id;

  const query = `DELETE FROM timetables WHERE id = ? AND user_id = ?`;

  db.run(query, [timetableId, req.session.userId], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to delete timetable' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    res.json({ message: 'Timetable deleted successfully' });
  });
});

// Generate timetable route
app.post('/api/timetable/generate', requireAuth, (req, res) => {
  const { timetableId } = req.body;

  if (!timetableId) {
    return res.status(400).json({ message: 'Timetable ID is required' });
  }

  // Get timetable configuration
  const query = `SELECT * FROM timetables WHERE id = ? AND user_id = ?`;

  db.get(query, [timetableId, req.session.userId], (err, timetableConfig) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to fetch timetable configuration' });
    }

    if (!timetableConfig) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    try {
      // Parse configuration
      const config = {
        name: timetableConfig.name,
        classrooms: timetableConfig.classrooms,
        batches: timetableConfig.batches,
        subjects: JSON.parse(timetableConfig.subjects || '[]'),
        maxClassesPerDay: timetableConfig.max_classes_per_day,
        classesPerSubject: JSON.parse(timetableConfig.classes_per_subject || '{}'),
        faculties: JSON.parse(timetableConfig.faculties || '{}'),
        fixedSlots: JSON.parse(timetableConfig.fixed_slots || '{}')
      };

      // Generate timetable
      const generator = new TimetableGenerator(config);
      const generatedTimetable = generator.generateTimetable();

      // Save generated timetable
      const updateQuery = `UPDATE timetables SET generated_timetable = ?, is_generated = TRUE WHERE id = ?`;
      
      db.run(updateQuery, [JSON.stringify(generatedTimetable), timetableId], function(updateErr) {
        if (updateErr) {
          console.error('Database error:', updateErr);
          return res.status(500).json({ message: 'Failed to save generated timetable' });
        }

        res.json({
          message: 'Timetable generated successfully',
          timetable: generatedTimetable
        });
      });

    } catch (error) {
      console.error('Generation error:', error);
      res.status(500).json({ message: 'Failed to generate timetable', error: error.message });
    }
  });
});

// Get generated timetable route
app.get('/api/timetable/generated/:id', requireAuth, (req, res) => {
  const timetableId = req.params.id;

  const query = `SELECT * FROM timetables WHERE id = ? AND user_id = ?`;

  db.get(query, [timetableId, req.session.userId], (err, timetable) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Failed to fetch timetable' });
    }

    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    if (!timetable.is_generated || !timetable.generated_timetable) {
      return res.status(400).json({ message: 'Timetable not generated yet' });
    }

    try {
      const generatedTimetable = JSON.parse(timetable.generated_timetable);
      res.json({
        config: {
          name: timetable.name,
          classrooms: timetable.classrooms,
          batches: timetable.batches,
          subjects: JSON.parse(timetable.subjects),
          maxClassesPerDay: timetable.max_classes_per_day,
          classesPerSubject: JSON.parse(timetable.classes_per_subject),
          faculties: JSON.parse(timetable.faculties),
          fixedSlots: JSON.parse(timetable.fixed_slots || '{}')
        },
        timetable: generatedTimetable
      });
    } catch (parseError) {
      console.error('Parse error:', parseError);
      res.status(500).json({ message: 'Failed to parse generated timetable' });
    }
  });
});

// Export timetable to Excel
app.get('/api/timetable/export/excel/:id', requireAuth, async (req, res) => {
  const timetableId = req.params.id;

  try {
    const query = `SELECT * FROM timetables WHERE id = ? AND user_id = ?`;
    
    db.get(query, [timetableId, req.session.userId], async (err, timetable) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Failed to fetch timetable' });
      }

      if (!timetable || !timetable.is_generated || !timetable.generated_timetable) {
        return res.status(404).json({ message: 'Generated timetable not found' });
      }

      try {
        const generatedTimetable = JSON.parse(timetable.generated_timetable);
        const config = {
          name: timetable.name,
          classrooms: timetable.classrooms,
          batches: timetable.batches
        };

        const exporter = new TimetableExporter(generatedTimetable, config);
        const buffer = await exporter.exportToExcel();

        const filename = `${timetable.name.replace(/[^a-zA-Z0-9]/g, '_')}_timetable.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      } catch (exportError) {
        console.error('Export error:', exportError);
        res.status(500).json({ message: 'Failed to export timetable' });
      }
    });
  } catch (error) {
    console.error('Export route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export timetable to PDF
app.get('/api/timetable/export/pdf/:id', requireAuth, async (req, res) => {
  const timetableId = req.params.id;

  try {
    const query = `SELECT * FROM timetables WHERE id = ? AND user_id = ?`;
    
    db.get(query, [timetableId, req.session.userId], async (err, timetable) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Failed to fetch timetable' });
      }

      if (!timetable || !timetable.is_generated || !timetable.generated_timetable) {
        return res.status(404).json({ message: 'Generated timetable not found' });
      }

      try {
        const generatedTimetable = JSON.parse(timetable.generated_timetable);
        const config = {
          name: timetable.name,
          classrooms: timetable.classrooms,
          batches: timetable.batches
        };

        const exporter = new TimetableExporter(generatedTimetable, config);
        const buffer = await exporter.exportToPDF();

        const filename = `${timetable.name.replace(/[^a-zA-Z0-9]/g, '_')}_timetable.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      } catch (exportError) {
        console.error('Export error:', exportError);
        res.status(500).json({ message: 'Failed to export timetable' });
      }
    });
  } catch (error) {
    console.error('Export route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Homepage route
app.get('/', (req, res) => {
  res.json({ 
    message: 'College Timetable Optimizer API', 
    version: '1.0.0',
    endpoints: {
      login: 'POST /api/login',
      logout: 'POST /api/logout',
      auth_check: 'GET /api/auth/check',
      save_timetable: 'POST /api/timetable/save',
      get_timetables: 'GET /api/timetable/get',
      delete_timetable: 'DELETE /api/timetable/:id',
      health: 'GET /api/health'
    },
    demo_credentials: {
      username: 'admin',
      password: 'admin123'
    }
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database path: ${dbPath}`);
});

// Graceful shutdown - commented out to prevent immediate shutdown
// process.on('SIGINT', () => {
//   console.log('\nShutting down gracefully...');
//   db.close((err) => {
//     if (err) {
//       console.error('Error closing database:', err);
//     } else {
//       console.log('Database connection closed.');
//     }
//     process.exit(0);
//   });
// });
