"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { DateTime } from "luxon";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { db } from "../lib/firebase";

export default function ReportsPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [settings, setSettings] = useState(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [autoRange, setAutoRange] = useState({ start: "", end: "" });
  const [mode, setMode] = useState("firebase");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const sSnap = await getDoc(doc(db, "PCA Settings", "Attendance"));
      if (sSnap.exists()) setSettings(sSnap.data());
    };
    loadSettings();
  }, []);

  // 🔹 Detect range
  const detectRange = (rows) => {
    const dates = rows
      .map((r) => r["Date"])
      .filter(Boolean)
      .map((d) => DateTime.fromFormat(d, "dd-MM-yyyy"));
    if (dates.length === 0) return;
    const minDate = DateTime.min(...dates).toISODate();
    const maxDate = DateTime.max(...dates).toISODate();
    setAutoRange({ start: minDate, end: maxDate });
    if (!dateRange.start && !dateRange.end) {
      setDateRange({ start: minDate, end: maxDate });
    }
  };

  // 🔹 Load from Firebase
  const loadFromFirebase = async () => {
    let all = [];
    const snap = await getDocs(collection(db, "PCA logs"));
    for (let logDoc of snap.docs) {
      const entriesSnap = await getDocs(
        collection(db, `PCA logs/${logDoc.id}/entries`)
      );
      entriesSnap.forEach((e) => {
        all = all.concat(e.data().data);
      });
    }
    setLogs(all);
    detectRange(all);
    setMode("firebase");
  };

  // 🔹 Load from CSV
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setLogs(result.data);
        detectRange(result.data);
        setMode("csv");
      },
    });
  };

  // 🔹 Compute Report
  const computeSummary = () => {
    if (!logs.length || !settings) return;

    const start = dateRange.start || autoRange.start;
    const end = dateRange.end || autoRange.end;

    const grouped = {};
    logs.forEach((row) => {
      const empId = row["Employee ID"];
      const name = row["First Name"] || row["Name"];
      const date = row["Date"];
      const time = row["Time"];
      if (!empId || !date || !time) return;

      const ts = DateTime.fromFormat(`${date} ${time}`, "dd-MM-yyyy HH:mm");
      if (start && ts < DateTime.fromISO(start)) return;
      if (end && ts > DateTime.fromISO(end)) return;

      if (!grouped[empId]) grouped[empId] = { empId, name, days: {} };
      if (!grouped[empId].days[date]) grouped[empId].days[date] = [];
      grouped[empId].days[date].push(ts);
    });

    const summaries = Object.values(grouped).map((emp) => {
      let totalNormal = 0,
        totalOT = 0,
        totalNight = 0,
        totalHoliday = 0,
        totalSunday = 0,
        totalTransport = 0,
        totalAttendance = 0,
        openShifts = 0;

      Object.entries(emp.days).forEach(([date, punches]) => {
        punches.sort((a, b) => a - b);

        if (punches.length % 2 !== 0) {
          openShifts++;
          return;
        }

        const firstIn = punches[0];
        const lastOut = punches[punches.length - 1];
        let hours = lastOut.diff(firstIn, "hours").hours;

        const dayOfWeek = DateTime.fromFormat(date, "dd-MM-yyyy").weekday;

        // Sunday hours
        if (dayOfWeek === 7) {
          totalSunday += hours;
        }

        // Holiday check
        if (
          settings.holidays.includes(
            DateTime.fromFormat(date, "dd-MM-yyyy").toISODate()
          )
        ) {
          totalHoliday += hours;
          hours *= 2;
        }

        // Night hours
        const nightStart = DateTime.fromFormat(
          `${date} ${settings.nightStart}`,
          "dd-MM-yyyy HH:mm"
        );
        const nightEnd = DateTime.fromFormat(
          `${date} ${settings.nightEnd}`,
          "dd-MM-yyyy HH:mm"
        ).plus({ days: 1 });

        if (firstIn < nightEnd && lastOut > nightStart) {
          totalNight += Math.min(hours, settings.normalShift);
        }

        // Normal vs OT
        if (hours > settings.normalShift) {
          totalNormal += settings.normalShift;
          totalOT += hours - settings.normalShift;
        } else {
          totalNormal += hours;
        }

        // Allowances
        totalTransport += settings.transportAllowance || 0;
        totalAttendance += settings.attendanceAllowance || 0;
      });

      return {
        empId: emp.empId,
        name: emp.name,
        normal: totalNormal.toFixed(2),
        overtime: totalOT.toFixed(2),
        holiday: totalHoliday.toFixed(2),
        sunday: totalSunday.toFixed(2),
        night: totalNight.toFixed(2),
        transport: totalTransport.toFixed(2),
        attendance: totalAttendance.toFixed(2),
        openShifts,
        days: emp.days, // keep raw for drilldown
      };
    });

    setSummary(summaries);
  };

  // 🔹 Export CSV
  const exportCSV = () => {
    const csv = Papa.unparse(summary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "attendance_summary.csv");
  };

  return (
    <div className="bg-white p-6 rounded shadow space-y-6">
      <h1 className="text-xl font-bold">Reports</h1>

      {/* Data Source */}
      <div className="flex gap-4">
        <button
          onClick={loadFromFirebase}
          className={`px-4 py-2 rounded ${
            mode === "firebase" ? "bg-blue-700 text-white" : "bg-blue-100"
          }`}
        >
          Load from Firebase
        </button>
        <label className="px-4 py-2 rounded bg-gray-100 cursor-pointer">
          Upload CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Auto-detected period */}
      {autoRange.start && autoRange.end && (
        <p className="text-sm text-gray-600">
          Period detected: <b>{autoRange.start}</b> → <b>{autoRange.end}</b>
        </p>
      )}

      {/* Date Range Inputs */}
      <div className="flex gap-4">
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) =>
            setDateRange({ ...dateRange, start: e.target.value })
          }
          className="p-2 border rounded"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) =>
            setDateRange({ ...dateRange, end: e.target.value })
          }
          className="p-2 border rounded"
        />
        <button
          onClick={computeSummary}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Generate Report
        </button>
      </div>

      {/* Summary Table */}
      {summary.length > 0 && (
        <>
          <p className="text-sm mt-2">
            Showing report for:{" "}
            <b>{dateRange.start || autoRange.start}</b> →{" "}
            <b>{dateRange.end || autoRange.end}</b>
          </p>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Employee ID</th>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Normal</th>
                <th className="p-2 border">OT</th>
                <th className="p-2 border">Holiday</th>
                <th className="p-2 border">Sunday</th>
                <th className="p-2 border">Night</th>
                <th className="p-2 border">T/L Allow</th>
                <th className="p-2 border">Attend Allow</th>
                <th className="p-2 border">Open Shifts</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border">{row.empId}</td>
                  <td className="p-2 border">{row.name}</td>
                  <td className="p-2 border">{row.normal}</td>
                  <td className="p-2 border">{row.overtime}</td>
                  <td className="p-2 border">{row.holiday}</td>
                  <td className="p-2 border">{row.sunday}</td>
                  <td className="p-2 border">{row.night}</td>
                  <td className="p-2 border">{row.transport}</td>
                  <td className="p-2 border">{row.attendance}</td>
                  <td className="p-2 border text-red-600">{row.openShifts}</td>
                  <td className="p-2 border text-blue-600">
                    <button
                      onClick={() => setSelectedEmployee(row)}
                      className="underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={exportCSV}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded"
          >
            Export CSV
          </button>
        </>
      )}

      {/* Drilldown Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-2">
              Daily Breakdown - {selectedEmployee.name} ({selectedEmployee.empId})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Punches</th>
                  <th className="p-2 border">Hours</th>
                  <th className="p-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selectedEmployee.days).map(([date, punches], i) => {
                  punches.sort((a, b) => a - b);
                  let hours = "-";
                  let status = "OK";
                  if (punches.length % 2 !== 0) {
                    status = "Open Shift ⚠️";
                  } else {
                    hours = punches[punches.length - 1].diff(punches[0], "hours").hours.toFixed(2);
                  }
                  return (
                    <tr key={i}>
                      <td className="p-2 border">{date}</td>
                      <td className="p-2 border">
                        {punches.map((p) => p.toFormat("HH:mm")).join(", ")}
                      </td>
                      <td className="p-2 border">{hours}</td>
                      <td className="p-2 border">{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              onClick={() => setSelectedEmployee(null)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



// "use client";
// import { useState, useEffect } from "react";
// // import { db } from "../../lib/firebase";
// import { collection, getDocs, doc, getDoc } from "firebase/firestore";
// import { DateTime } from "luxon";
// import Papa from "papaparse";
// import { saveAs } from "file-saver";
// import { db } from "../lib/firebase";

// export default function ReportsPage() {
//   const [logs, setLogs] = useState([]);
//   const [summary, setSummary] = useState([]);
//   const [settings, setSettings] = useState(null);
//   const [dateRange, setDateRange] = useState({ start: "", end: "" });
//   const [autoRange, setAutoRange] = useState({ start: "", end: "" });
//   const [mode, setMode] = useState("firebase");

//   useEffect(() => {
//     const loadSettings = async () => {
//       const sSnap = await getDoc(doc(db, "PCA Settings", "Attendance"));
//       if (sSnap.exists()) setSettings(sSnap.data());
//     };
//     loadSettings();
//   }, []);

//   // 🔹 Detect date range automatically from logs
//   const detectRange = (rows) => {
//     const dates = rows
//       .map((r) => r["Date"])
//       .filter(Boolean)
//       .map((d) => DateTime.fromFormat(d, "dd-MM-yyyy"));
//     if (dates.length === 0) return;
//     const minDate = DateTime.min(...dates).toISODate();
//     const maxDate = DateTime.max(...dates).toISODate();
//     setAutoRange({ start: minDate, end: maxDate });
//     if (!dateRange.start && !dateRange.end) {
//       setDateRange({ start: minDate, end: maxDate });
//     }
//   };

//   // 🔹 Load logs from Firebase
//   const loadFromFirebase = async () => {
//     let all = [];
//     const snap = await getDocs(collection(db, "PCA logs"));
//     for (let logDoc of snap.docs) {
//       const entriesSnap = await getDocs(
//         collection(db, `PCA logs/${logDoc.id}/entries`)
//       );
//       entriesSnap.forEach((e) => {
//         all = all.concat(e.data().data);
//       });
//     }
//     setLogs(all);
//     detectRange(all);
//     setMode("firebase");
//   };

//   // 🔹 Load logs from CSV
//   const handleCSVUpload = (e) => {
//     const file = e.target.files[0];
//     Papa.parse(file, {
//       header: true,
//       skipEmptyLines: true,
//       complete: (result) => {
//         setLogs(result.data);
//         detectRange(result.data);
//         setMode("csv");
//       },
//     });
//   };

//   // 🔹 Compute Report
//   const computeSummary = () => {
//     if (!logs.length || !settings) return;

//     const start = dateRange.start || autoRange.start;
//     const end = dateRange.end || autoRange.end;

//     const grouped = {};
//     logs.forEach((row) => {
//       const empId = row["Employee ID"];
//       const name = row["First Name"] || row["Name"];
//       const date = row["Date"];
//       const time = row["Time"];
//       if (!empId || !date || !time) return;

//       const ts = DateTime.fromFormat(`${date} ${time}`, "dd-MM-yyyy HH:mm");
//       if (start && ts < DateTime.fromISO(start)) return;
//       if (end && ts > DateTime.fromISO(end)) return;

//       if (!grouped[empId]) grouped[empId] = { empId, name, days: {} };
//       if (!grouped[empId].days[date]) grouped[empId].days[date] = [];
//       grouped[empId].days[date].push(ts);
//     });

//     const summaries = Object.values(grouped).map((emp) => {
//       let totalNormal = 0,
//         totalOT = 0,
//         totalNight = 0,
//         totalHoliday = 0,
//         totalTransport = 0,
//         totalAttendance = 0,
//         openShifts = 0;

//       Object.entries(emp.days).forEach(([date, punches]) => {
//         punches.sort((a, b) => a - b);

//         if (punches.length % 2 !== 0) {
//           openShifts++;
//           return;
//         }

//         const firstIn = punches[0];
//         const lastOut = punches[punches.length - 1];
//         let hours = lastOut.diff(firstIn, "hours").hours;

//         // Holiday check
//         if (
//           settings.holidays.includes(
//             DateTime.fromFormat(date, "dd-MM-yyyy").toISODate()
//           )
//         ) {
//           totalHoliday += hours;
//           hours *= 2;
//         }

//         // Night hours
//         const nightStart = DateTime.fromFormat(
//           `${date} ${settings.nightStart}`,
//           "dd-MM-yyyy HH:mm"
//         );
//         const nightEnd = DateTime.fromFormat(
//           `${date} ${settings.nightEnd}`,
//           "dd-MM-yyyy HH:mm"
//         ).plus({ days: 1 });

//         if (firstIn < nightEnd && lastOut > nightStart) {
//           totalNight += Math.min(hours, settings.normalShift);
//         }

//         // Normal vs OT
//         if (hours > settings.normalShift) {
//           totalNormal += settings.normalShift;
//           totalOT += hours - settings.normalShift;
//         } else {
//           totalNormal += hours;
//         }

//         // Allowances
//         totalTransport += settings.transportAllowance || 0;
//         totalAttendance += settings.attendanceAllowance || 0;
//       });

//       return {
//         empId: emp.empId,
//         name: emp.name,
//         normal: totalNormal.toFixed(2),
//         overtime: totalOT.toFixed(2),
//         holiday: totalHoliday.toFixed(2),
//         night: totalNight.toFixed(2),
//         transport: totalTransport.toFixed(2),
//         attendance: totalAttendance.toFixed(2),
//         openShifts,
//       };
//     });

//     setSummary(summaries);
//   };

//   // 🔹 Export CSV
//   const exportCSV = () => {
//     const csv = Papa.unparse(summary);
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//     saveAs(blob, "attendance_summary.csv");
//   };

//   return (
//     <div className="bg-white text-black p-6 rounded shadow space-y-6">
//       <h1 className="text-xl font-bold">Reports</h1>

//       {/* Data Source */}
//       <div className="flex gap-4">
//         <button
//           onClick={loadFromFirebase}
//           className={`px-4 py-2 rounded ${
//             mode === "firebase" ? "bg-blue-700 text-white" : "bg-blue-100"
//           }`}
//         >
//           Load from Firebase
//         </button>
//         <label className="px-4 py-2 rounded bg-gray-100 cursor-pointer">
//           Upload CSV
//           <input
//             type="file"
//             accept=".csv"
//             onChange={handleCSVUpload}
//             className="hidden"
//           />
//         </label>
//       </div>

//       {/* Auto-detected period */}
//       {autoRange.start && autoRange.end && (
//         <p className="text-sm text-gray-600">
//           Period detected: <b>{autoRange.start}</b> → <b>{autoRange.end}</b>
//         </p>
//       )}

//       {/* Date Range Inputs */}
//       <div className="flex gap-4">
//         <input
//           type="date"
//           value={dateRange.start}
//           onChange={(e) =>
//             setDateRange({ ...dateRange, start: e.target.value })
//           }
//           className="p-2 border rounded"
//         />
//         <input
//           type="date"
//           value={dateRange.end}
//           onChange={(e) =>
//             setDateRange({ ...dateRange, end: e.target.value })
//           }
//           className="p-2 border rounded"
//         />
//         <button
//           onClick={computeSummary}
//           className="px-4 py-2 bg-green-600 text-white rounded"
//         >
//           Generate Report
//         </button>
//       </div>

//       {/* Summary Table */}
//       {summary.length > 0 && (
//         <>
//           <p className="text-sm mt-2">
//             Showing report for:{" "}
//             <b>{dateRange.start || autoRange.start}</b> →{" "}
//             <b>{dateRange.end || autoRange.end}</b>
//           </p>

//           <table className="mt-4 w-full border-collapse text-sm">
//             <thead>
//               <tr className="bg-gray-100">
//                 <th className="p-2 border">Employee ID</th>
//                 <th className="p-2 border">Name</th>
//                 <th className="p-2 border">Normal</th>
//                 <th className="p-2 border">OT</th>
//                 <th className="p-2 border">Holiday</th>
//                 <th className="p-2 border">Night</th>
//                 <th className="p-2 border">T/L Allow</th>
//                 <th className="p-2 border">Attend Allow</th>
//                 <th className="p-2 border">Open Shifts</th>
//               </tr>
//             </thead>
//             <tbody>
//               {summary.map((row, i) => (
//                 <tr key={i}>
//                   <td className="p-2 border">{row.empId}</td>
//                   <td className="p-2 border">{row.name}</td>
//                   <td className="p-2 border">{row.normal}</td>
//                   <td className="p-2 border">{row.overtime}</td>
//                   <td className="p-2 border">{row.holiday}</td>
//                   <td className="p-2 border">{row.night}</td>
//                   <td className="p-2 border">{row.transport}</td>
//                   <td className="p-2 border">{row.attendance}</td>
//                   <td className="p-2 border text-red-600">{row.openShifts}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>

//           <button
//             onClick={exportCSV}
//             className="mt-4 px-4 py-2 bg-purple-600 text-white rounded"
//           >
//             Export CSV
//           </button>
//         </>
//       )}
//     </div>
//   );
// }
