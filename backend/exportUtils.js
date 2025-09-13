const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');

class TimetableExporter {
  constructor(timetableData, config) {
    this.timetableData = timetableData;
    this.config = config;
  }

  async exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Timetable');

    // Set worksheet properties
    worksheet.properties.defaultRowHeight = 25;

    // Add title and metadata
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = this.config.name || 'College Timetable';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF1f2937' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFe5e7eb' }
    };

    // Add metadata
    let currentRow = 3;
    const metadata = [
      ['Generated on:', new Date().toLocaleDateString()],
      ['Total Classes:', this.timetableData.metadata.totalClasses],
      ['Subjects:', this.timetableData.metadata.subjects],
      ['Teachers:', this.timetableData.metadata.teachers],
      ['Classrooms:', this.timetableData.metadata.classrooms]
    ];

    metadata.forEach(([label, value]) => {
      worksheet.getCell(`A${currentRow}`).value = label;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      worksheet.getCell(`B${currentRow}`).value = value;
      currentRow++;
    });

    currentRow += 2; // Add some spacing

    // Create timetable headers
    const headerRow = worksheet.getRow(currentRow);
    const headers = ['Time/Day', ...this.timetableData.days];
    
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3b82f6' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    currentRow++;

    // Add timetable data
    this.timetableData.timeSlots.forEach(timeSlot => {
      const row = worksheet.getRow(currentRow);
      
      // Time slot column
      const timeCell = row.getCell(1);
      timeCell.value = timeSlot.displayTime;
      timeCell.font = { bold: true };
      timeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFf3f4f6' }
      };
      timeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      timeCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Day columns
      this.timetableData.days.forEach((day, dayIndex) => {
        const cell = row.getCell(dayIndex + 2);
        const classData = this.timetableData.schedule[day][timeSlot.id];
        
        if (classData) {
          cell.value = `${classData.subject}\n${classData.teacher}\n${classData.classroom}`;
          cell.font = { size: 10 };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFdbeafe' }
          };
        } else {
          cell.value = '-';
          cell.font = { color: { argb: 'FF9ca3af' } };
        }
        
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      currentRow++;
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    worksheet.getColumn(1).width = 25; // Time column wider

    // Add teacher workload summary
    currentRow += 3;
    worksheet.getCell(`A${currentRow}`).value = 'Teacher Workload Summary';
    worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
    currentRow += 2;

    Object.entries(this.timetableData.teacherWorkload).forEach(([teacher, workload]) => {
      worksheet.getCell(`A${currentRow}`).value = teacher;
      worksheet.getCell(`B${currentRow}`).value = `${workload.classes} classes`;
      worksheet.getCell(`C${currentRow}`).value = `${workload.percentage}%`;
      currentRow++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  async exportToPDF() {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          layout: 'landscape'
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Title
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#1f2937')
           .text(this.config.name || 'College Timetable', { align: 'center' });

        doc.moveDown(1);

        // Metadata
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#4b5563');

        const metadata = [
          `Generated on: ${new Date().toLocaleDateString()}`,
          `Total Classes: ${this.timetableData.metadata.totalClasses}`,
          `Subjects: ${this.timetableData.metadata.subjects}`,
          `Teachers: ${this.timetableData.metadata.teachers}`,
          `Classrooms: ${this.timetableData.metadata.classrooms}`
        ];

        doc.text(metadata.join(' | '), { align: 'center' });
        doc.moveDown(1);

        // Calculate table dimensions
        const tableTop = doc.y;
        const tableWidth = doc.page.width - 80;
        const colWidth = tableWidth / (this.timetableData.days.length + 1);
        const rowHeight = 40;

        // Draw table headers
        let currentX = 40;
        let currentY = tableTop;

        // Header background
        doc.rect(currentX, currentY, tableWidth, rowHeight)
           .fillAndStroke('#3b82f6', '#2563eb');

        // Header text
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('white');

        // Time/Day header
        doc.text('Time/Day', currentX + 5, currentY + 15, {
          width: colWidth - 10,
          align: 'center'
        });
        currentX += colWidth;

        // Day headers
        this.timetableData.days.forEach(day => {
          doc.text(day, currentX + 5, currentY + 15, {
            width: colWidth - 10,
            align: 'center'
          });
          currentX += colWidth;
        });

        currentY += rowHeight;

        // Draw timetable rows
        this.timetableData.timeSlots.forEach((timeSlot, rowIndex) => {
          currentX = 40;

          // Alternate row colors
          const rowColor = rowIndex % 2 === 0 ? '#f9fafb' : '#ffffff';
          doc.rect(currentX, currentY, tableWidth, rowHeight)
             .fillAndStroke(rowColor, '#e5e7eb');

          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor('#374151');

          // Time slot
          doc.text(timeSlot.displayTime, currentX + 2, currentY + 5, {
            width: colWidth - 4,
            align: 'center'
          });
          currentX += colWidth;

          // Classes for each day
          this.timetableData.days.forEach(day => {
            const classData = this.timetableData.schedule[day][timeSlot.id];
            
            if (classData) {
              doc.fontSize(7)
                 .font('Helvetica')
                 .fillColor('#1f2937');

              const classText = `${classData.subject}\n${classData.teacher}\n${classData.classroom}`;
              doc.text(classText, currentX + 2, currentY + 5, {
                width: colWidth - 4,
                align: 'center',
                lineGap: 2
              });
            } else {
              doc.fontSize(10)
                 .font('Helvetica')
                 .fillColor('#9ca3af');
              doc.text('-', currentX + 2, currentY + 15, {
                width: colWidth - 4,
                align: 'center'
              });
            }

            currentX += colWidth;
          });

          currentY += rowHeight;

          // Check if we need a new page
          if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = 40;
          }
        });

        // Add teacher workload summary
        if (currentY > doc.page.height - 200) {
          doc.addPage();
          currentY = 40;
        } else {
          currentY += 30;
        }

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1f2937')
           .text('Teacher Workload Summary', 40, currentY);

        currentY += 30;

        Object.entries(this.timetableData.teacherWorkload).forEach(([teacher, workload]) => {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor('#374151')
             .text(`${teacher}: ${workload.classes} classes (${workload.percentage}%)`, 40, currentY);
          currentY += 15;
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Remove duplicate methods - the main methods are defined above
}

module.exports = TimetableExporter;
