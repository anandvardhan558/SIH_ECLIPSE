class TimetableGenerator {
  constructor(config) {
    this.config = config;
    this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    this.timeSlots = this.generateTimeSlots();
    this.timetable = {};
    this.teacherSchedule = {};
    this.classroomSchedule = {};
    this.subjectWeights = this.calculateSubjectWeights();
  }

  generateTimeSlots() {
    const slots = [];
    const startTime = 9; // 9 AM
    const maxSlots = this.config.maxClassesPerDay;
    
    for (let i = 0; i < maxSlots; i++) {
      const hour = startTime + i;
      const period = i + 1;
      slots.push({
        id: `slot_${i + 1}`,
        period: period,
        time: `${hour}:00 - ${hour + 1}:00`,
        displayTime: `Period ${period} (${hour}:00-${hour + 1}:00)`
      });
    }
    return slots;
  }

  calculateSubjectWeights() {
    // Classify subjects as heavy or light based on common patterns
    const heavySubjects = ['Mathematics', 'Physics', 'Chemistry', 'Programming', 'Data Structures', 'Algorithms'];
    const weights = {};
    
    this.config.subjects.forEach(subject => {
      const isHeavy = heavySubjects.some(heavy => 
        subject.toLowerCase().includes(heavy.toLowerCase())
      );
      weights[subject] = isHeavy ? 'heavy' : 'light';
    });
    
    return weights;
  }

  initializeSchedules() {
    // Initialize empty schedules
    this.days.forEach(day => {
      this.timetable[day] = {};
      this.timeSlots.forEach(slot => {
        this.timetable[day][slot.id] = null;
      });
    });

    // Initialize teacher schedules
    Object.keys(this.config.faculties).forEach(subject => {
      const teacher = this.config.faculties[subject];
      if (!this.teacherSchedule[teacher]) {
        this.teacherSchedule[teacher] = {
          schedule: {},
          workload: 0,
          subjects: []
        };
        this.days.forEach(day => {
          this.teacherSchedule[teacher].schedule[day] = {};
          this.timeSlots.forEach(slot => {
            this.teacherSchedule[teacher].schedule[day][slot.id] = false;
          });
        });
      }
      this.teacherSchedule[teacher].subjects.push(subject);
    });

    // Initialize classroom schedules
    for (let i = 1; i <= this.config.classrooms; i++) {
      const classroom = `Room ${i}`;
      this.classroomSchedule[classroom] = {};
      this.days.forEach(day => {
        this.classroomSchedule[classroom][day] = {};
        this.timeSlots.forEach(slot => {
          this.classroomSchedule[classroom][day][slot.id] = false;
        });
      });
    }
  }

  isSlotAvailable(day, slotId, teacher, classroom) {
    // Check if teacher is available
    if (this.teacherSchedule[teacher]?.schedule[day][slotId]) {
      return false;
    }
    
    // Check if classroom is available
    if (this.classroomSchedule[classroom]?.[day][slotId]) {
      return false;
    }
    
    return true;
  }

  checkConsecutiveClasses(day, slotId) {
    // Check if this would create more than 2 consecutive classes
    const currentSlotIndex = this.timeSlots.findIndex(slot => slot.id === slotId);
    let consecutiveCount = 0;
    
    // Count backward
    for (let i = currentSlotIndex - 1; i >= 0; i--) {
      if (this.timetable[day][this.timeSlots[i].id]) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    // Count forward
    for (let i = currentSlotIndex + 1; i < this.timeSlots.length; i++) {
      if (this.timetable[day][this.timeSlots[i].id]) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    return consecutiveCount < 2; // Max 3 consecutive (current + 2 others)
  }

  balanceSubjectDistribution(day, slotId, subject) {
    // Try to balance heavy and light subjects
    const subjectWeight = this.subjectWeights[subject];
    const currentSlotIndex = this.timeSlots.findIndex(slot => slot.id === slotId);
    
    // Check adjacent slots
    const adjacentSlots = [
      currentSlotIndex > 0 ? this.timeSlots[currentSlotIndex - 1] : null,
      currentSlotIndex < this.timeSlots.length - 1 ? this.timeSlots[currentSlotIndex + 1] : null
    ].filter(slot => slot !== null);
    
    let heavyAdjacent = 0;
    adjacentSlots.forEach(slot => {
      const adjacentClass = this.timetable[day][slot.id];
      if (adjacentClass && this.subjectWeights[adjacentClass.subject] === 'heavy') {
        heavyAdjacent++;
      }
    });
    
    // Avoid placing heavy subjects adjacent to each other when possible
    if (subjectWeight === 'heavy' && heavyAdjacent > 0) {
      return Math.random() > 0.7; // 30% chance to allow for flexibility
    }
    
    return true;
  }

  assignClass(day, slotId, subject, teacher, classroom) {
    this.timetable[day][slotId] = {
      subject,
      teacher,
      classroom,
      batch: `Batch ${Math.ceil(Math.random() * this.config.batches)}`
    };
    
    // Mark teacher as busy
    this.teacherSchedule[teacher].schedule[day][slotId] = true;
    this.teacherSchedule[teacher].workload++;
    
    // Mark classroom as busy
    this.classroomSchedule[classroom][day][slotId] = true;
  }

  getAvailableClassroom(day, slotId) {
    const classrooms = Object.keys(this.classroomSchedule);
    const availableClassrooms = classrooms.filter(classroom => 
      !this.classroomSchedule[classroom][day][slotId]
    );
    
    if (availableClassrooms.length === 0) return null;
    return availableClassrooms[Math.floor(Math.random() * availableClassrooms.length)];
  }

  distributeTeacherWorkload() {
    // Calculate target workload per teacher
    const totalSlots = this.days.length * this.timeSlots.length;
    const teachers = Object.keys(this.teacherSchedule);
    const targetWorkload = Math.floor(totalSlots / teachers.length);
    
    return targetWorkload;
  }

  generateTimetable() {
    this.initializeSchedules();
    
    // Create subject pool based on weekly requirements
    const subjectPool = [];
    this.config.subjects.forEach(subject => {
      const weeklyHours = this.config.classesPerSubject[subject] || 3;
      for (let i = 0; i < weeklyHours; i++) {
        subjectPool.push(subject);
      }
    });
    
    // Handle fixed slots first
    Object.keys(this.config.fixedSlots || {}).forEach(slotKey => {
      const [day, slotId] = slotKey.split('_');
      const subject = this.config.fixedSlots[slotKey];
      if (this.config.subjects.includes(subject)) {
        const teacher = this.config.faculties[subject];
        const classroom = this.getAvailableClassroom(day, slotId);
        
        if (teacher && classroom && this.isSlotAvailable(day, slotId, teacher, classroom)) {
          this.assignClass(day, slotId, subject, teacher, classroom);
          // Remove from subject pool
          const index = subjectPool.indexOf(subject);
          if (index > -1) subjectPool.splice(index, 1);
        }
      }
    });
    
    // Shuffle subject pool for randomization
    for (let i = subjectPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [subjectPool[i], subjectPool[j]] = [subjectPool[j], subjectPool[i]];
    }
    
    // Assign remaining subjects
    let subjectIndex = 0;
    this.days.forEach(day => {
      this.timeSlots.forEach(slot => {
        if (!this.timetable[day][slot.id] && subjectIndex < subjectPool.length) {
          const subject = subjectPool[subjectIndex];
          const teacher = this.config.faculties[subject];
          
          if (teacher) {
            const classroom = this.getAvailableClassroom(day, slot.id);
            
            if (classroom && 
                this.isSlotAvailable(day, slot.id, teacher, classroom) &&
                this.checkConsecutiveClasses(day, slot.id) &&
                this.balanceSubjectDistribution(day, slot.id, subject)) {
              
              this.assignClass(day, slot.id, subject, teacher, classroom);
              subjectIndex++;
            }
          }
        }
      });
    });
    
    // Fill remaining empty slots with available subjects (if any)
    this.fillRemainingSlots();
    
    return this.formatTimetable();
  }

  fillRemainingSlots() {
    this.days.forEach(day => {
      this.timeSlots.forEach(slot => {
        if (!this.timetable[day][slot.id]) {
          // Find least loaded teacher
          const availableTeachers = Object.keys(this.teacherSchedule).filter(teacher =>
            !this.teacherSchedule[teacher].schedule[day][slot.id]
          );
          
          if (availableTeachers.length > 0) {
            availableTeachers.sort((a, b) => 
              this.teacherSchedule[a].workload - this.teacherSchedule[b].workload
            );
            
            const teacher = availableTeachers[0];
            const teacherSubjects = this.teacherSchedule[teacher].subjects;
            
            if (teacherSubjects.length > 0) {
              const subject = teacherSubjects[Math.floor(Math.random() * teacherSubjects.length)];
              const classroom = this.getAvailableClassroom(day, slot.id);
              
              if (classroom && this.checkConsecutiveClasses(day, slot.id)) {
                this.assignClass(day, slot.id, subject, teacher, classroom);
              }
            }
          }
        }
      });
    });
  }

  formatTimetable() {
    const formattedTimetable = {
      schedule: {},
      metadata: {
        totalClasses: 0,
        subjects: this.config.subjects.length,
        teachers: Object.keys(this.teacherSchedule).length,
        classrooms: this.config.classrooms,
        days: this.days.length,
        slotsPerDay: this.timeSlots.length,
        generatedAt: new Date().toISOString()
      },
      timeSlots: this.timeSlots,
      days: this.days,
      teacherWorkload: {},
      subjectDistribution: {}
    };
    
    // Format schedule for frontend
    this.days.forEach(day => {
      formattedTimetable.schedule[day] = {};
      this.timeSlots.forEach(slot => {
        formattedTimetable.schedule[day][slot.id] = this.timetable[day][slot.id];
        if (this.timetable[day][slot.id]) {
          formattedTimetable.metadata.totalClasses++;
        }
      });
    });
    
    // Calculate teacher workload statistics
    Object.keys(this.teacherSchedule).forEach(teacher => {
      formattedTimetable.teacherWorkload[teacher] = {
        classes: this.teacherSchedule[teacher].workload,
        subjects: this.teacherSchedule[teacher].subjects,
        percentage: Math.round((this.teacherSchedule[teacher].workload / (this.days.length * this.timeSlots.length)) * 100)
      };
    });
    
    // Calculate subject distribution
    this.config.subjects.forEach(subject => {
      let count = 0;
      this.days.forEach(day => {
        this.timeSlots.forEach(slot => {
          if (this.timetable[day][slot.id]?.subject === subject) {
            count++;
          }
        });
      });
      formattedTimetable.subjectDistribution[subject] = count;
    });
    
    return formattedTimetable;
  }
}

module.exports = TimetableGenerator;

