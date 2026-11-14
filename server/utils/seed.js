/* Sample data for demos, development and screenshots. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  User, Task, StudyGroup, Message, Resource, Event, EventRegistration, Announcement, Notification, Activity,
} = require('../models');
const { RESOURCE_DIR } = require('../middleware/upload');

const DOMAIN = 'campusconnect.edu';
const ADMIN = { email: `admin@${DOMAIN}`, password: 'Admin@123' };
const STUDENT_PASSWORD = 'Student@123';

const hoursFromNow = (h) => new Date(Date.now() + h * 36e5);
const daysFromNow = (d, hour = 10) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(hour, 0, 0, 0);
  return x;
};

/** Builds a small but valid single-page PDF so sample downloads actually open. */
function buildPdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = [
    'BT', '/F1 20 Tf', '72 740 Td', `(${esc(title)}) Tj`, '/F1 11 Tf', '0 -30 Td',
    ...lines.flatMap((l) => [`(${esc(l)}) Tj`, '0 -18 Td']),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function writeSampleFile(title, lines) {
  fs.mkdirSync(RESOURCE_DIR, { recursive: true });
  const filename = `seed-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const buf = buildPdf(title, lines);
  fs.writeFileSync(path.join(RESOURCE_DIR, filename), buf);
  return { originalName: `${title.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')}.pdf`, filename, mimeType: 'application/pdf', size: buf.length };
}

async function seedDatabase({ log = false } = {}) {
  const say = (m) => log && console.log(`[seed] ${m}`);

  await Promise.all([
    User.deleteMany({}), Task.deleteMany({}), StudyGroup.deleteMany({}), Message.deleteMany({}), Resource.deleteMany({}),
    Event.deleteMany({}), EventRegistration.deleteMany({}), Announcement.deleteMany({}), Notification.deleteMany({}),
    Activity.deleteMany({}),
  ]);
  // Remove previously seeded files.
  if (fs.existsSync(RESOURCE_DIR)) {
    fs.readdirSync(RESOURCE_DIR).filter((f) => f.startsWith('seed-')).forEach((f) => fs.unlinkSync(path.join(RESOURCE_DIR, f)));
  }

  /* ---------- Users (created with save() so passwords are hashed) ---------- */
  const admin = await new User({
    name: 'Dr. Meera Kapoor', email: ADMIN.email, password: ADMIN.password, role: 'admin',
    department: 'Computer Science', semester: 1, isVerified: true, bio: 'Dean of Student Affairs',
  }).save();

  const studentData = [
    ['Aarav Sharma', 'aarav', 'Computer Science', 5, 'CS21001'],
    ['Priya Patel', 'priya', 'Computer Science', 5, 'CS21014'],
    ['Rohan Mehta', 'rohan', 'Information Technology', 5, 'IT21007'],
    ['Ananya Iyer', 'ananya', 'Electronics', 3, 'EC22011'],
    ['Kabir Singh', 'kabir', 'Mechanical', 7, 'ME20003'],
    ['Sara Khan', 'sara', 'Computer Science', 3, 'CS22020'],
  ];
  const students = [];
  for (const [name, handle, department, semester, rollNumber] of studentData) {
    // eslint-disable-next-line no-await-in-loop
    students.push(await new User({
      name, email: `${handle}@${DOMAIN}`, password: STUDENT_PASSWORD, department, semester, rollNumber,
      isVerified: true, lastLoginAt: hoursFromNow(-Math.random() * 72),
    }).save());
  }
  const [aarav, priya, rohan, ananya, kabir, sara] = students;
  say(`${students.length + 1} users created`);

  /* ---------- Tasks ---------- */
  const taskTemplates = [
    ['DBMS Assignment 3 – Normalization', 'Database Systems', 'assignment', 'high', 20, 'todo'],
    ['Operating Systems lab record', 'Operating Systems', 'assignment', 'medium', 46, 'in_progress'],
    ['Read chapter 5: Transport layer', 'Computer Networks', 'task', 'low', 96, 'todo'],
    ['Prepare mid-sem notes for DAA', 'Algorithms', 'task', 'high', 70, 'todo'],
    ['Submit internship report draft', 'Career', 'assignment', 'high', -10, 'todo'],
    ['Web Dev mini project UI', 'Web Development', 'assignment', 'medium', 150, 'in_progress'],
    ['Revise Graph algorithms', 'Algorithms', 'task', 'medium', 200, 'todo'],
    ['Compiler Design quiz prep', 'Compiler Design', 'task', 'low', -40, 'completed'],
    ['Networks assignment 2', 'Computer Networks', 'assignment', 'high', -60, 'completed'],
    ['Update resume for placements', 'Career', 'task', 'medium', -100, 'completed'],
    ['Software Engineering case study', 'Software Engineering', 'assignment', 'medium', -150, 'completed'],
    ['Practice SQL joins', 'Database Systems', 'task', 'low', -200, 'completed'],
  ];
  const tasks = [];
  students.forEach((s, si) => {
    taskTemplates.forEach(([title, subject, type, priority, dueInHours, status], ti) => {
      if (si > 0 && ti % (si + 1) === 1) return; // vary task lists per student
      const dueDate = hoursFromNow(dueInHours + si * 3);
      tasks.push({
        user: s._id, title, subject, type, priority, status, dueDate,
        description: `${type === 'assignment' ? 'Graded assignment' : 'Personal study task'} for ${subject}.`,
        reminderAt: dueInHours > 30 && status !== 'completed' ? hoursFromNow(dueInHours - 24) : undefined,
        completedAt: status === 'completed' ? new Date(dueDate.getTime() - (ti % 3 === 0 ? -6 : 12) * 36e5) : undefined,
        createdAt: hoursFromNow(-24 * (14 - (ti % 14))),
        tags: [subject.split(' ')[0].toLowerCase()],
      });
    });
  });
  // insertMany skips save hooks, so set derived fields explicitly.
  await Task.insertMany(tasks.map((t) => ({ ...t, priorityRank: { low: 1, medium: 2, high: 3 }[t.priority] })));
  say(`${tasks.length} tasks created`);

  /* ---------- Study groups + chat ---------- */
  const groupsData = [
    { name: 'DSA Grinders', subject: 'Algorithms', description: 'Daily LeetCode practice and placement prep. Weekly contests every Sunday.', owner: aarav, members: [priya, rohan, sara], tags: ['dsa', 'placements'] },
    { name: 'DBMS Study Circle', subject: 'Database Systems', description: 'Normalization, SQL, transactions — we solve previous year papers together.', owner: priya, members: [aarav, sara], tags: ['sql'] },
    { name: 'Embedded Systems Lab', subject: 'Embedded Systems', description: 'Arduino and microcontroller projects for ECE students.', owner: ananya, members: [kabir], tags: ['iot', 'hardware'] },
    { name: 'Final Year Project – Team Phoenix', subject: 'Project', description: 'Private workspace for our final year project.', owner: kabir, members: [rohan], isPrivate: true, tags: ['project'] },
  ];
  const groups = [];
  for (const g of groupsData) {
    // eslint-disable-next-line no-await-in-loop
    groups.push(await StudyGroup.create({
      name: g.name, subject: g.subject, description: g.description, owner: g.owner._id, isPrivate: Boolean(g.isPrivate), tags: g.tags,
      members: [{ user: g.owner._id, role: 'owner' }, ...g.members.map((m, i) => ({ user: m._id, role: i === 0 ? 'admin' : 'member' }))],
      invites: g.name === 'Embedded Systems Lab' ? [{ user: aarav._id, invitedBy: ananya._id }] : [],
    }));
  }
  const chat = [
    [0, aarav, 'Welcome everyone! Contest this Sunday at 8 PM 🚀'],
    [0, priya, 'I will share the DP problem list tonight.'],
    [0, rohan, 'Can we also cover graphs — Dijkstra & topological sort?'],
    [0, sara, 'Yes please! Struggling with topo sort.'],
    [0, aarav, "Sure, let's do graphs on Wednesday."],
    [1, priya, 'Uploaded the normalization notes. 3NF vs BCNF examples are on page 2.'],
    [1, aarav, 'Thanks! The BCNF decomposition example is super clear.'],
    [2, ananya, 'Lab kit arrives Monday. Bring your laptops.'],
    [3, kabir, 'Synopsis submission is due next Friday.'],
  ];
  let minute = 600;
  for (const [gi, sender, content] of chat) {
    minute -= 37;
    // eslint-disable-next-line no-await-in-loop
    await Message.create({ group: groups[gi]._id, sender: sender._id, content, createdAt: new Date(Date.now() - minute * 60000) });
  }
  say(`${groups.length} study groups created`);

  /* ---------- Resources (real PDF files) ---------- */
  const resourcesData = [
    ['Database Normalization – Complete Notes', 'Database Systems', 5, 'notes', priya, null, ['1NF, 2NF, 3NF and BCNF with examples', 'Functional dependencies and closures', 'Lossless join decomposition']],
    ['Operating Systems – Process Scheduling', 'Operating Systems', 5, 'notes', aarav, null, ['FCFS, SJF, Round Robin, Priority scheduling', 'Gantt charts and waiting time calculations']],
    ['Computer Networks PYQ 2024', 'Computer Networks', 5, 'question_paper', rohan, null, ['End-semester question paper 2024', 'Section A: OSI model, Section B: TCP congestion control']],
    ['Dynamic Programming Patterns', 'Algorithms', 5, 'pdf', aarav, groups[0], ['0/1 Knapsack, LIS, LCS, Matrix chain', 'Shared with DSA Grinders']],
    ['Digital Electronics Lab Manual', 'Digital Electronics', 3, 'assignment', ananya, null, ['Experiments 1-10: logic gates, flip-flops, counters']],
    ['Thermodynamics Formula Sheet', 'Thermodynamics', 7, 'notes', kabir, null, ['Laws of thermodynamics', 'Carnot, Otto and Diesel cycles']],
    ['React Hooks Cheat Sheet', 'Web Development', 5, 'slides', sara, null, ['useState, useEffect, useMemo, useCallback, useContext', 'Custom hooks best practices']],
    ['Software Engineering – UML Diagrams', 'Software Engineering', 5, 'slides', rohan, null, ['Use case, class, sequence and activity diagrams']],
  ];
  const resources = [];
  for (const [title, subject, semester, type, by, group, lines] of resourcesData) {
    // eslint-disable-next-line no-await-in-loop
    resources.push(await Resource.create({
      title, subject, semester, type, uploadedBy: by._id, group: group ? group._id : null,
      description: lines[0], file: writeSampleFile(title, lines), downloads: Math.floor(Math.random() * 60) + 3,
      tags: [subject.split(' ')[0].toLowerCase()],
    }));
  }
  await User.updateOne({ _id: aarav._id }, { bookmarks: [resources[0]._id, resources[2]._id] });
  await Resource.updateMany({ _id: { $in: [resources[0]._id, resources[2]._id] } }, { $inc: { bookmarkCount: 1 } });
  say(`${resources.length} resources created`);

  /* ---------- Events + registrations ---------- */
  const eventsData = [
    ['HackCampus 2026 – 24h Hackathon', 'technical', 'Innovation Lab, Block C', 'Coding Club', 6, 30, 200, 'Build solutions for campus problems in 24 hours. Teams of up to 4. Prizes worth ₹1,00,000, mentorship from industry engineers, and food all night.'],
    ['Placement Drive Orientation', 'career', 'Main Auditorium', 'Training & Placement Cell', 2, 2, 400, 'Overview of the upcoming placement season: eligibility, company list, resume guidelines and mock interview schedule.'],
    ['Spring Cultural Fest – Rang', 'cultural', 'Open Air Theatre', 'Cultural Committee', 14, 8, 0, 'Three days of music, dance, drama and food stalls. Register to participate in competitions or volunteer.'],
    ['Workshop: Intro to Machine Learning', 'workshop', 'Seminar Hall 2', 'AI Society', 9, 3, 60, 'Hands-on workshop covering regression, classification and model evaluation with Python and scikit-learn. Bring your laptop.'],
    ['Inter-Department Football League', 'sports', 'University Sports Ground', 'Sports Council', 20, 6, 0, 'Annual football league between departments. Register your team or come cheer!'],
    ['Guest Lecture: Cloud-Native Architecture', 'seminar', 'Seminar Hall 1', 'Department of CSE', -7, 2, 120, 'Industry talk on microservices, Kubernetes and scalable system design.'],
  ];
  const events = [];
  for (const [title, category, venue, organizer, inDays, durationHours, capacity, description] of eventsData) {
    const startDate = daysFromNow(inDays, 10);
    // eslint-disable-next-line no-await-in-loop
    events.push(await Event.create({
      title, category, venue, organizer, capacity, description, startDate,
      endDate: new Date(startDate.getTime() + durationHours * 36e5),
      registrationDeadline: inDays > 3 ? daysFromNow(inDays - 1, 23) : undefined,
      createdBy: admin._id,
    }));
  }
  const regs = [
    [events[0], [aarav, priya, rohan, sara]], [events[1], [aarav, priya, rohan, kabir]], [events[3], [priya, sara, ananya]],
    [events[2], [ananya, kabir]], [events[5], [aarav, rohan]],
  ];
  for (const [event, users] of regs) {
    // eslint-disable-next-line no-await-in-loop
    await EventRegistration.insertMany(users.map((u) => ({ event: event._id, user: u._id })));
    // eslint-disable-next-line no-await-in-loop
    await Event.updateOne({ _id: event._id }, { registrationsCount: users.length });
  }
  say(`${events.length} events created`);

  /* ---------- Announcements ---------- */
  const announcements = await Announcement.insertMany([
    { title: 'Mid-semester examination schedule released', content: 'The mid-semester exams will be held from the 2nd to the 9th of next month. Detailed timetable is available on the exam portal. Carry your ID cards to every exam.', category: 'exam', priority: 'important', isPinned: true, author: admin._id },
    { title: 'Library extended hours during exams', content: 'The central library will remain open until midnight on weekdays during the examination period.', category: 'academic', author: admin._id, createdAt: hoursFromNow(-20) },
    { title: 'Amazon & Microsoft campus recruitment', content: 'Final-year CSE and IT students: registrations for upcoming campus drives close this Friday. Update your profiles on the placement portal.', category: 'placement', department: 'Computer Science', semester: 7, priority: 'important', author: admin._id, createdAt: hoursFromNow(-30) },
    { title: '5th semester CSE: Lab re-scheduling', content: 'The DBMS lab on Thursday has been moved to Friday 2 PM in Lab 4 due to maintenance.', category: 'academic', department: 'Computer Science', semester: 5, author: admin._id, createdAt: hoursFromNow(-5) },
    { title: 'Campus Wi-Fi maintenance on Sunday', content: 'Wi-Fi services will be unavailable on Sunday between 6 AM and 10 AM for scheduled upgrades.', category: 'general', author: admin._id, createdAt: hoursFromNow(-50) },
  ]);
  say(`${announcements.length} announcements created`);

  /* ---------- Notifications + activity ---------- */
  await Notification.insertMany([
    { recipient: aarav._id, type: 'announcement', title: 'Mid-semester examination schedule released', message: 'The mid-semester exams will be held from the 2nd…', link: `/announcements?highlight=${announcements[0]._id}` },
    { recipient: aarav._id, type: 'group_invite', title: 'Study group invitation', message: 'Ananya Iyer invited you to join "Embedded Systems Lab"', link: `/groups/${groups[2]._id}` },
    { recipient: aarav._id, type: 'deadline', title: 'Deadline approaching: DBMS Assignment 3 – Normalization', message: 'Due in about 20 hours · high priority', link: '/tasks', isRead: false },
    { recipient: aarav._id, type: 'event', title: 'Registration confirmed', message: "You're registered for HackCampus 2026 – 24h Hackathon.", link: `/events/${events[0]._id}`, isRead: true },
  ]);

  const actions = [
    ['task.completed', 'task', 'Completed "Networks assignment 2"'],
    ['resource.uploaded', 'resource', 'Uploaded "Operating Systems – Process Scheduling"'],
    ['group.created', 'group', 'Created study group "DSA Grinders"'],
    ['event.registered', 'event', 'Registered for "HackCampus 2026 – 24h Hackathon"'],
    ['task.created', 'task', 'Created assignment "DBMS Assignment 3 – Normalization"'],
    ['auth.login', 'auth', 'Logged in'],
  ];
  const activity = [];
  students.forEach((s) => {
    for (let d = 0; d < 21; d += 1) {
      const n = (d * 7 + s.name.length) % 4;
      for (let k = 0; k < n; k += 1) {
        const [action, entityType, description] = actions[(d + k) % actions.length];
        activity.push({ user: s._id, action, entityType, description, createdAt: hoursFromNow(-d * 24 - k * 2) });
      }
    }
  });
  await Activity.insertMany(activity);

  say('Done ✔');
  say(`Admin login:   ${ADMIN.email} / ${ADMIN.password}`);
  say(`Student login: aarav@${DOMAIN} / ${STUDENT_PASSWORD}  (also priya, rohan, ananya, kabir, sara)`);
  return { admin, students, groups, resources, events };
}

module.exports = { seedDatabase, buildPdf, ADMIN, STUDENT_PASSWORD, DOMAIN };
