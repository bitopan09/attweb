// pages/index.js
import React, { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import * as XLSX from "xlsx";
import { classes as initialClasses } from "../data/students";

const STORAGE_KEY = "attendanceApp_v4";

function toISO(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

export default function Home() {
  const [classes, setClasses] = useState(initialClasses || []);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);

  const [selectedDates, setSelectedDates] = useState([]);
  const [attendanceView, setAttendanceView] = useState({});
  const [searchFilter, setSearchFilter] = useState("");

  const [newClassName, setNewClassName] = useState("");
  const [newName, setNewName] = useState("");
  const [newRoll, setNewRoll] = useState("");

  // load saved attendance
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const saved = raw ? JSON.parse(raw) : {};
    const view = {};
    selectedDates.forEach(d => {
      const iso = toISO(d);
      view[iso] = {};
      const cls = saved[selectedClassId];
      if (cls && cls[iso]) {
        view[iso] = { ...cls[iso] };
      }
    });
    setAttendanceView(view);
  }, [selectedClassId, selectedDates]);

  const selectedClass = classes.find(c => c.id === selectedClassId) || null;
  const students = selectedClass ? selectedClass.students : [];

  // attendance toggle
  const handleToggle = (dateISO, roll) => {
    setAttendanceView(prev => {
      const cur = prev[dateISO] ? { ...prev[dateISO] } : {};
      const currentStatus = cur[roll] || "Absent";
      const next = currentStatus === "Present" ? "Absent" : "Present";
      cur[roll] = next;
      return { ...prev, [dateISO]: cur };
    });
  };

  const saveAttendance = () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[selectedClassId]) data[selectedClassId] = {};
    Object.keys(attendanceView).forEach(dateISO => {
      data[selectedClassId][dateISO] = attendanceView[dateISO];
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    alert(`Saved attendance for ${selectedClass?.name || "class"} (${Object.keys(attendanceView).length} dates)`);
  };

  const markAll = (status) => {
    setAttendanceView(prev => {
      const updated = { ...prev };
      selectedDates.forEach(d => {
        const iso = toISO(d);
        updated[iso] = {};
        students.forEach(s => {
          updated[iso][s.roll] = status;
        });
      });
      return updated;
    });
  };

  const exportExcel = () => {
    const rows = [["Class", "Date", "Roll", "Name", "Status"]];
    const className = selectedClass?.name || "Unknown";
    selectedDates.forEach(d => {
      const iso = toISO(d);
      students.forEach(s => {
        const status = attendanceView[iso]?.[s.roll] || "Absent";
        rows.push([className, iso, s.roll, s.name, status]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${className.replace(/\s+/g, "_")}_attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // classrooms
  const addClassroom = () => {
    if (!newClassName.trim()) { alert("Enter a class name"); return; }
    const newId = classes.length ? Math.max(...classes.map(c => c.id)) + 1 : 1;
    const newClass = { id: newId, name: newClassName.trim(), students: [] };
    setClasses(prev => [...prev, newClass]);
    setSelectedClassId(newId);
    setNewClassName("");
  };

  const removeClassroom = (id) => {
    if (!confirm("Remove this classroom and its students?")) return;
    setClasses(prev => prev.filter(c => c.id !== id));
    if (selectedClassId === id) setSelectedClassId(classes[0]?.id || null);
  };

  // students
  const addStudent = () => {
    if (!newName || !newRoll) { alert("Enter name and roll."); return; }
    setClasses(prev => prev.map(c =>
      c.id === selectedClassId
        ? { ...c, students: [...c.students, { name: newName.trim(), roll: newRoll.trim() }] }
        : c
    ));
    setNewName(""); setNewRoll("");
  };

  const removeStudent = (roll) => {
    if (!confirm("Remove this student?")) return;
    setClasses(prev => prev.map(c =>
      c.id === selectedClassId
        ? { ...c, students: c.students.filter(s => s.roll !== roll) }
        : c
    ));
    setAttendanceView(prev => {
      const nxt = {};
      Object.keys(prev).forEach(dateISO => {
        const obj = { ...prev[dateISO] };
        delete obj[roll];
        nxt[dateISO] = obj;
      });
      return nxt;
    });
  };

  // 📥 Import students from Excel
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Expect header ["Roll","Name"]
      const newStudents = rows.slice(1).map(r => ({ roll: String(r[0]), name: r[1] }));
      setClasses(prev => prev.map(c =>
        c.id === selectedClassId ? { ...c, students: newStudents } : c
      ));
      alert("Imported students from Excel!");
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredStudents = students.filter(s =>
    (s.name + " " + s.roll).toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-root">
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="logo">🧭</div>
          <div>
            <div className="title">Attendance Studio</div>
            <div className="subtitle">Dark · Multi-class · Excel Import</div>
          </div>
        </div>

        <div className="actions">
          <select
            className="class-select"
            value={selectedClassId || ""}
            onChange={e => setSelectedClassId(Number(e.target.value))}
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn small danger" onClick={() => removeClassroom(selectedClassId)}>Delete</button>
          <input className="class-input" placeholder="New Class" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
          <button className="btn accent small" onClick={addClassroom}>Add Class</button>
        </div>
      </div>

      {/* Main Layout */}
      <main className="container">
        {/* Left Sidebar */}
        <aside className="left-card">
          <h3>Pick dates</h3>
          <p className="muted">Select multiple days for attendance.</p>
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={(d) => {
              let arr = [];
              if (!d) arr = [];
              else if (Array.isArray(d)) arr = d;
              else arr = [d];
              arr = Array.from(new Set(arr.map(x => toISO(x)))).map(s => new Date(s)).sort((a,b)=>a-b);
              setSelectedDates(arr);
            }}
          />
          <div className="controls">
            <button className="btn primary" onClick={() => markAll("Present")}>All Present</button>
            <button className="btn warn" onClick={() => markAll("Absent")}>All Absent</button>
            <button className="btn" onClick={saveAttendance}>Save</button>
            <button className="btn accent" onClick={exportExcel}>Export</button>
          </div>
        </aside>

        {/* Right Section */}
        <section className="right-card">
          <div className="row top-row">
            <div>
              <h3>{selectedClass?.name || "No class selected"}</h3>
              <div className="muted">{students.length} students · {selectedDates.length} dates</div>
            </div>
            <div className="inline-controls">
              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="file-input" />
              <input className="search" placeholder="Search..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
              <div className="add-form">
                <input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input placeholder="Roll" value={newRoll} onChange={e => setNewRoll(e.target.value)} />
                <button className="btn" onClick={addStudent}>Add</button>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  {selectedDates.map(d => <th key={toISO(d)}>{toISO(d)}</th>)}
                  <th>Remove</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => (
                  <tr key={s.roll}>
                    <td className="mono">{s.roll}</td>
                    <td>{s.name}</td>
                    {selectedDates.map(d => {
                      const iso = toISO(d);
                      const st = attendanceView[iso]?.[s.roll] || "Absent";
                      return (
                        <td key={iso}>
                          <button
                            className={`status ${st === "Present" ? "present" : "absent"}`}
                            onClick={() => handleToggle(iso, s.roll)}
                          >
                            {st}
                          </button>
                        </td>
                      );
                    })}
                    <td><button className="btn small danger" onClick={() => removeStudent(s.roll)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Black Theme Styles */}
      <style jsx>{`
        html, body, #__next {
          height:100%; margin:0;
          font-family: Inter, sans-serif;
          background:#000;
          color:#e6eef8;
        }
        .page-root { padding:20px; max-width:1200px; margin:0 auto; }
        .topbar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:20px; gap:10px; }
        .brand { display:flex; gap:12px; align-items:center; }
        .logo { background:linear-gradient(135deg,#7c5cff,#00d4ff); width:50px; height:50px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; }
        .title { font-size:18px; font-weight:700; }
        .subtitle { font-size:12px; color:#9aa4b2; }
        .actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .class-select, .class-input, .search, .add-form input {
          padding:8px 10px;
          border-radius:8px;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          color:inherit;
        }
        .btn { padding:8px 12px; border-radius:8px; cursor:pointer; border:none; background:rgba(255,255,255,0.08); color:inherit; transition:.2s; }
        .btn:hover { background:rgba(255,255,255,0.15); }
        .btn.primary { background:linear-gradient(90deg,#1de9b6,#00b894); color:#022; }
        .btn.warn { background:linear-gradient(90deg,#ffd166,#ff8a00); color:#221; }
        .btn.accent { background:linear-gradient(90deg,#7c5cff,#00d4ff); color:#041328; }
        .btn.danger { background:linear-gradient(90deg,#ff6b6b,#ff3b3b); color:white; }
        .btn.small { padding:5px 8px; font-size:13px; }
        .file-input { color:#e6eef8; }
        .container { display:grid; grid-template-columns:320px 1fr; gap:20px; }
        .left-card, .right-card { background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); }
        .controls { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
        .row.top-row { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }
        .inline-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .add-form { display:flex; flex-wrap:wrap; gap:8px; }
        .table-wrap { overflow:auto; max-height:60vh; border-radius:10px; }
        table { width:100%; border-collapse:collapse; min-width:600px; }
        th, td { padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; }
        th { font-size:13px; color:#9aa4b2; }
        .mono { font-family:monospace; font-size:13px; }
        .status { padding:6px 10px; border-radius:8px; border:none; font-weight:600; cursor:pointer; }
        .status.present { background:linear-gradient(90deg,#1de9b6,#00b894); color:#022; }
        .status.absent { background:linear-gradient(90deg,#ff8fa3,#ff5c7a); color:#411; }
        @media(max-width:900px){
          .container { grid-template-columns:1fr; }
          .table-wrap { max-height:40vh; }
        }
      `}</style>
    </div>
  );
}
