"use client";
import { useState, useEffect } from "react";
// import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { DateTime } from "luxon";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { db } from "../lib/firebase";
import autoTable from "jspdf-autotable";

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
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidaysSnap = await getDocs(collection(db, "PCA Holidays"));
        const fetched = holidaysSnap.docs.map((d) => d.data().date);
        setSettings((prev) => ({ ...(prev || {}), holidays: fetched }));
        console.log("✅ Loaded holidays:", fetched);
      } catch (err) {
        console.error("Failed to load holidays:", err);
      }
    };
    loadHolidays();
  }, []);

  const handleGenerate = async () => {
    if (!logs.length) return alert("Please upload a CSV first.");

    // Wait until settings are loaded
    if (!settings) {
      alert("Settings not loaded yet, please try again in a few seconds.");
      return;
    }

    // Use offline mode for now
    const offlineHolidays = settings.holidays || [];
    const offlineAdjustments = [];

    console.log("Generating report using", logs.length, "rows…");
    // Wait until autoRange or dateRange are available
    const start = dateRange.start || autoRange.start;
    const end = dateRange.end || autoRange.end;

    if (!start || !end) {
      console.warn("⚠️ No valid date range detected yet. Retrying in 1s...");
      setTimeout(() => handleGenerate(), 1000);
      return;
    }

    console.log("📅 Using date range:", start, "→", end);
    await computeSummary(true, offlineHolidays, offlineAdjustments);

    // await computeSummary(true, offlineHolidays, offlineAdjustments);

    // console.log("✅ Summary generated");
  };

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
  //   // Save full report summary to Firebase
  const saveReportToFirebase = async () => {
    if (!summary.length) return alert("Generate a report first!");
    const report = {
      title: `Attendance Report ${dateRange.start || autoRange.start} → ${
        dateRange.end || autoRange.end
      }`,
      dateRange: {
        start: dateRange.start || autoRange.start,
        end: dateRange.end || autoRange.end,
      },
      createdAt: new Date(),
      summary,
    };
    await addDoc(collection(db, "PCA Reports"), report);
    alert("Report saved to Firebase ✅");
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
        // 🔹 Normalize headers: trim spaces
        const cleanData = result.data.map((row) => {
          const newRow = {};
          for (const key in row) {
            if (!key) continue;
            const cleanKey = key.trim();
            newRow[cleanKey] = row[key];
          }
          return newRow;
        });

        setLogs(cleanData);
        console.log("First row sample:", cleanData[0]);
        console.log("Available keys:", Object.keys(cleanData[0]));

        detectRange(cleanData);
        setMode("csv");

        console.log("✅ Parsed rows:", cleanData.length);
        console.log("✅ Columns:", Object.keys(cleanData[0]));

        // setTimeout(() => handleGenerate(), 300);
      },
    });
  };

  // 🔹 Export adjusted CSV (with date range + holidays noted)
  const exportAdjustedCSV = () => {
    if (!summary.length) return alert("Generate the report first!");

    const rangeLabel = `${dateRange.start || autoRange.start}_to_${
      dateRange.end || autoRange.end
    }`;
    const headerRows = [
      ["Adjusted Attendance Report"],
      [
        `Period: ${dateRange.start || autoRange.start} -> ${
          dateRange.end || autoRange.end
        }`,
      ],
      [],
    ];

    // Add totals + adjustment summary columns if needed
    const fieldHeaders = [
      "Employee ID",
      "Name",
      "Normal",
      "Overtime",
      "Holiday",
      "Sunday",
      "Night",
      "T/L Allow",
      "Attend Allow",
      "Open Shifts",
    ];

    const dataRows = summary.map((row) => [
      row.empId,
      row.name,
      row.normal,
      row.overtime,
      row.holiday,
      row.sunday,
      row.night,
      row.transport,
      row.attendance,
      row.openShifts,
    ]);

    const csv = Papa.unparse({ fields: fieldHeaders, data: dataRows });
    const fullCsv = [...headerRows.map((r) => r.join(",")), csv].join("\n");

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `adjusted_report_${rangeLabel}.csv`);
  };

  // 🔹 Compute Report
  // Put this inside ReportsPage (replace previous computeSummary)
  async function computeSummary(
    useOfflineLogs = false,
    offlineHolidays = null,
    offlineAdjustments = null
  ) {
    // logs is component state (set earlier)
    if (!logs.length) return;

    // load settings if not already loaded
    let s = settings;
    if (!s) {
      const sSnap = await getDoc(doc(db, "PCA Settings", "Attendance"));
      if (sSnap.exists()) s = sSnap.data();
      else {
        // fallback sensible defaults
        s = {
          normalShift: 10,
          nightStart: "22:00",
          nightEnd: "06:00",
          transportAllowance: 0,
          attendanceAllowance: 0,
          holidays: [],
        };
      }
      setSettings(s);
    }

    // Load holidays from collection if available (or use provided offlineHolidays)
    let holidays = offlineHolidays || [];
    if (!offlineHolidays) {
      const hSnap = await getDocs(collection(db, "holidays"));
      holidays = hSnap.docs.map((d) => d.data().date); // ISO strings
    }

    // Load adjustments if available
    let adjustments = offlineAdjustments || [];
    if (!offlineAdjustments) {
      const aSnap = await getDocs(collection(db, "adjustments"));
      adjustments = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const start = dateRange.start || autoRange.start;
    const end = dateRange.end || autoRange.end;

    if (!start || !end) {
      console.warn("⚠️ No valid date range detected in computeSummary!");
      return;
    }

    // 🔹 Identify header keys dynamically (handles extra spaces or variations)
    const firstRow = logs[0] || {};
    const keys = Object.keys(firstRow).reduce((acc, k) => {
      const clean = k.trim().toLowerCase();
      if (clean.includes("employee") && clean.includes("id")) acc.empId = k;
      if (clean.includes("first") && clean.includes("name")) acc.firstName = k;
      if (clean === "name") acc.firstName = k;
      if (clean === "date") acc.date = k;
      if (clean === "time") acc.time = k;
      if (clean.includes("punch") || clean.includes("state")) acc.punch = k;
      return acc;
    }, {});

    console.log("Detected column keys:", keys);

    // Group logs
    const grouped = {};
    logs.forEach((row) => {
      const empId = row[keys.empId]?.toString().trim();
      const name = row[keys.firstName]?.trim() || "";
      const date = row[keys.date]?.trim();
      const time = row[keys.time]?.trim();
      const state = row[keys.punch]?.trim();

      if (!empId || !date || !time) return;

      let ts = DateTime.fromFormat(`${date} ${time}`, "dd-MM-yyyy HH:mm");

      if (!ts.isValid) {
        // Try common alternative formats (just in case)
        ts = DateTime.fromFormat(`${date} ${time}`, "dd/MM/yyyy HH:mm");
      }
      if (!ts.isValid) {
        console.warn("⚠️ Invalid date/time:", date, time);
        return;
      }
      // if (start && end) {
      //   const t = "00:00";
      //   const sISO = DateTime.fromISO(start);
      //   // const sISO = DateTime.fromFormat(`${start} ${t}`, "dd/MM/yyyy HH:mm");
      //   // const sISO = DateTime.fromFormat(`${end} ${t}`, "dd/MM/yyyy HH:mm");
      //   const eISO = DateTime.fromISO(end);
      //   if (ts < sISO || ts > eISO) {
      //     console.log("⏩ Skipping out-of-range log", empId, date, time);
      //     return;
      //   }
      // }

      // if (start && ts < DateTime.fromISO(start)) return;
      // if (end && ts > DateTime.fromISO(end)) return;

      if (!grouped[empId]) grouped[empId] = { empId, name, days: {} };
      if (!grouped[empId].days[date]) grouped[empId].days[date] = [];
      grouped[empId].days[date].push({ time: ts, state });
    });

    console.log("Grouped employees:", Object.keys(grouped));

    for (const [id, emp] of Object.entries(grouped)) {
      console.log(`Employee ${id} → ${Object.keys(emp.days).length} days`);
    }

    const summaries = Object.values(grouped).map((emp) => {
      let totalNormal = 0,
        totalOT = 0,
        totalNight = 0,
        totalHoliday = 0,
        totalSunday = 0;
      let totalTransport = 0,
        totalAttendance = 0,
        openShifts = 0;

      Object.entries(emp.days).forEach(([date, punches]) => {
        // Sort by actual time
        punches.sort((a, b) => a.time - b.time);

        // Create proper pairs (In → Out)
        let i = 0;
        while (i < punches.length) {
          const current = punches[i];
          const next = punches[i + 1];
          const isIn = current.state === "Check In";
          const isOut = current.state === "Check Out";

          // 🧠 Case 1: In followed by Out → valid pair
          if (isIn && next && next.state === "Check Out") {
            const firstIn = current.time;
            const lastOut = next.time;
            const hours = lastOut.diff(firstIn, "hours").hours;

            const dayOfWeek = DateTime.fromFormat(date, "dd-MM-yyyy").weekday;
            if (dayOfWeek === 7) totalSunday += hours;

            const isoDate = DateTime.fromFormat(date, "dd-MM-yyyy").toISODate();
            const isHoliday = holidays.includes(isoDate);
            if (isHoliday) totalHoliday += hours;

            // Night overlap
            const nightStart = DateTime.fromFormat(
              `${date} ${s.nightStart}`,
              "dd-MM-yyyy HH:mm"
            );
            let nightEnd = DateTime.fromFormat(
              `${date} ${s.nightEnd}`,
              "dd-MM-yyyy HH:mm"
            );
            if (nightEnd <= nightStart) nightEnd = nightEnd.plus({ days: 1 });

            const overlapSeconds = (a, b, ws, we) => {
              let start = a < ws ? ws : a;
              let end = b > we ? we : b;
              if (end < start) return 0;
              return end.diff(start, "seconds").seconds;
            };

            const nightSec = overlapSeconds(
              firstIn,
              lastOut,
              nightStart,
              nightEnd
            );
            const nightHours = nightSec / 3600;
            totalNight += nightHours;

            // Split into normal + overtime
            if (hours > s.normalShift) {
              totalNormal += s.normalShift;
              totalOT += hours - s.normalShift;
            } else {
              totalNormal += hours;
            }

            totalTransport += s.transportAllowance || 0;
            totalAttendance += s.attendanceAllowance || 0;

            i += 2; // skip paired
          }
          // 🧠 Case 2: In without Out → open shift
          else if (isIn && (!next || next.state === "Check In")) {
            openShifts++;
            i++; // skip to next
          }
          // 🧠 Case 3: Out without preceding In → skip or count partial
          else {
            openShifts++;
            i++;
          }
        }
      });

      // Apply adjustments for this employee
      // adjustments: array loaded earlier
      const empAdjustments = adjustments.filter((a) => {
        if (a.scope === "global") return true;
        if (
          a.scope === "employee" &&
          String(a.employeeId) === String(emp.empId)
        )
          return true;
        return false;
      });

      // Apply per-date and global adjustments:
      // We'll treat type:
      // - add_hours: add hours (per date if date set else global)
      // - subtract_hours: subtract hours
      // - override_hours: set employee totalNormal to provided hours for that date (not implemented per-day here, but you could)
      let adjustmentTotal = 0;
      for (const adj of empAdjustments) {
        if (adj.date) {
          // per-date: add/subtract to that date - so add to totalNormal (simple)
          // Only apply if date in current report range
          const adjDate = DateTime.fromISO(adj.date);
          const startDt = DateTime.fromISO(start);
          const endDt = DateTime.fromISO(end);
          if (adjDate < startDt || adjDate > endDt) continue;
          if (adj.type === "add_hours") adjustmentTotal += adj.hours;
          else if (adj.type === "subtract_hours") adjustmentTotal -= adj.hours;
          else if (adj.type === "override_hours") adjustmentTotal += adj.hours; // treat override as add for reporting; implement custom if needed
        } else {
          // global adjustment apply to whole period (one-time)
          if (adj.type === "add_hours") adjustmentTotal += adj.hours;
          else if (adj.type === "subtract_hours") adjustmentTotal -= adj.hours;
        }
      }

      // Apply adjustmentTotal to normal hours (or you may prefer to add to a separate adjustments field)
      totalNormal += adjustmentTotal;

      // Round
      return {
        empId: emp.empId,
        name: emp.name,
        normal: Number(totalNormal.toFixed(2)),
        overtime: Number(totalOT.toFixed(2)),
        holiday: Number(totalHoliday.toFixed(2)),
        sunday: Number(totalSunday.toFixed(2)),
        night: Number(totalNight.toFixed(2)),
        transport: Number(totalTransport.toFixed(2)),
        attendance: Number(totalAttendance.toFixed(2)),
        openShifts,
        days: emp.days,
      };
    });

    try {
      console.log("Summaries computed for", summaries.length, "employees");
      setSummary(summaries);
    } catch (err) {
      console.error("❌ Failed to compute summary:", err);
    }
  }

  const exportCSV = () => {
    if (!summary.length) return;

    const rangeLabel = `${dateRange.start || autoRange.start} → ${
      dateRange.end || autoRange.end
    }`;

    // custom title + subtitle rows
    const headerRows = [
      ["Attendance Summary Report"], // Title
      [`Period: ${rangeLabel}`],
      [], // spacer row
    ];

    // let Papa generate table portion
    const csvTable = Papa.unparse(summary);

    // prepend header rows manually
    const fullCsv = [...headerRows.map((r) => r.join(",")), csvTable].join(
      "\n"
    );

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8" });
    saveAs(
      blob,
      `attendance_summary_${rangeLabel.replace(/ → /g, "_to_")}.csv`
    );
  };

  // 🔹 Export CSV
  //   const exportCSV = () => {
  //     const csv = Papa.unparse(summary);
  //     const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  //     saveAs(blob, "attendance_summary.csv");
  //   };

  const exportPayrollCSV = () => {
    if (!summary.length) return;

    const rangeLabel = `${dateRange.start || autoRange.start}_to_${
      dateRange.end || autoRange.end
    }`;

    const headerRows = [
      ["Payroll Attendance Report"], // Title
      [
        `Period: ${dateRange.start || autoRange.start} -> ${
          dateRange.end || autoRange.end
        }`,
      ],
      [], // empty row
    ];

    const fieldHeaders = [
      "EMP ID",
      "Full Name",
      "PAY TYPE",
      "NORMAL",
      "OVERTIME",
      "HOLIDAY",
      "NIGHT",
      "T/L ALLOW",
      "ATTEND ALLOW",
    ];

    const dataRows = summary.map((row) => [
      row.empId,
      row.name,
      "Monthly", // adjust if you have actual PAY TYPE
      row.normal,
      row.overtime,
      row.holiday,
      row.night,
      row.transport,
      row.attendance,
    ]);

    const csv = Papa.unparse({
      fields: fieldHeaders,
      data: dataRows,
    });

    // prepend title + subtitle
    const fullCsv = [...headerRows.map((r) => r.join(",")), csv].join("\n");

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `payroll_report_${rangeLabel}.csv`);
  };

  //   // Export summary as PDF
  const exportPDF = () => {
    if (!summary.length) return;

    const doc = new jsPDF();

    // Title + subtitle
    const title = "Attendance Report";
    const period = `Period: ${dateRange.start || autoRange.start} -> ${
      dateRange.end || autoRange.end
    }`;

    doc.setFontSize(14);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(period, 14, 28);

    // Table data
    const tableData = summary.map((row) => [
      row.empId,
      row.name,
      row.normal,
      row.overtime,
      row.holiday,
      row.sunday,
      row.night,
      row.transport,
      row.attendance,
      row.openShifts,
    ]);

    // Generate table
    autoTable(doc, {
      startY: 35,
      head: [
        [
          "Emp ID",
          "Name",
          "Normal",
          "OT",
          "Holiday",
          "Sunday",
          "Night",
          "T/L Allow",
          "Attend Allow",
          "Open Shifts",
        ],
      ],
      body: tableData,
      styles: { fontSize: 9 }, // make it more compact if many rows
      headStyles: { fillColor: [41, 128, 185] }, // nice blue header
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Save file
    const rangeLabel = `${dateRange.start || autoRange.start}_to_${
      dateRange.end || autoRange.end
    }`;
    doc.save(`attendance_report_${rangeLabel}.pdf`);
  };

  // const exportDrilldownPDF = () => {
  //   if (!selectedEmployee) return;

  //   const doc = new jsPDF();

  //   const title = `Breakdown Report - ${selectedEmployee.name} (${selectedEmployee.empId})`;
  //   const period = `Period: ${dateRange.start || autoRange.start} -> ${dateRange.end || autoRange.end}`;

  //   // Title
  //   doc.setFontSize(14);
  //   doc.text(title, 14, 20);
  //   doc.setFontSize(11);
  //   doc.text(period, 14, 28);

  //   // Prepare table data
  //   const tableData = Object.entries(selectedEmployee.days).map(([date, punches]) => {
  //     punches.sort((a, b) => a - b);
  //     let hours = "-";
  //     let status = "OK";
  //     if (punches.length % 2 !== 0) {
  //       status = "Open Shift";
  //     } else {
  //       hours = punches[punches.length - 1]
  //         .diff(punches[0], "hours")
  //         .hours.toFixed(2);
  //     }
  //     return [
  //       date,
  //       punches.map((p) => p.toFormat("HH:mm")).join(", "),
  //       hours,
  //       status,
  //     ];
  //   });

  //   // Table
  //   autoTable(doc, {
  //     startY: 35,
  //     head: [["Date", "Punches", "Hours", "Status"]],
  //     body: tableData,
  //   });

  //   // Save
  //   doc.save(`breakdown_${selectedEmployee.empId}.pdf`);
  // };

  const exportDrilldownPDF = () => {
    if (!selectedEmployee) return;

    const doc = new jsPDF();

    const title = `Breakdown Report - ${selectedEmployee.name} (${selectedEmployee.empId})`;
    const period = `Period: ${dateRange.start || autoRange.start} -> ${
      dateRange.end || autoRange.end
    }`;

    // Title
    doc.setFontSize(14);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(period, 14, 28);

    // Prepare table data + total
    let totalHours = 0;

    const tableData = Object.entries(selectedEmployee.days).map(
      ([date, punches]) => {
        punches.sort((a, b) => a - b);
        let hours = "-";
        let status = "OK";
        if (punches.length % 2 !== 0) {
          status = "Open Shift";
        } else {
          hours = punches[punches.length - 1]
            .diff(punches[0], "hours")
            .hours.toFixed(2);

          totalHours += parseFloat(hours);
        }
        return [
          date,
          punches.map((p) => p.toFormat("HH:mm")).join(", "),
          hours,
          status,
        ];
      }
    );

    // Add total row
    tableData.push(["TOTAL", "", totalHours.toFixed(2), ""]);

    // Table
    autoTable(doc, {
      startY: 35,
      head: [["Date", "Punches", "Hours", "Status"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Save
    doc.save(
      `Breakdown-${selectedEmployee.name}_${selectedEmployee.empId}.pdf`
    );
  };

  const exportDrilldownCSV = () => {
    if (!selectedEmployee) return;

    const rangeLabel = `${dateRange.start || autoRange.start}_to_${
      dateRange.end || autoRange.end
    }`;

    const headerRows = [
      ["Breakdown Report"],
      [
        `Period: ${dateRange.start || autoRange.start} -> ${
          dateRange.end || autoRange.end
        }`,
      ],
      [],
    ];

    const fieldHeaders = ["Employee", "Date", "Punches", "Hours", "Status"];

    let totalHours = 0;

    const dataRows = Object.entries(selectedEmployee.days).map(
      ([date, punches]) => {
        punches.sort((a, b) => a - b);
        let hours = "-";
        let status = "OK";
        if (punches.length % 2 !== 0) {
          status = "Open Shift";
        } else {
          hours = punches[punches.length - 1]
            .diff(punches[0], "hours")
            .hours.toFixed(2);

          totalHours += parseFloat(hours);
        }
        return [
          `${selectedEmployee.name} (${selectedEmployee.empId})`,
          date,
          punches.map((p) => p.toFormat("HH:mm")).join(", "),
          hours,
          status,
        ];
      }
    );

    // Add totals row
    dataRows.push([
      `${selectedEmployee.name} (${selectedEmployee.empId})`,
      "TOTAL",
      "",
      totalHours.toFixed(2),
      "",
    ]);

    const csv = Papa.unparse({
      fields: fieldHeaders,
      data: dataRows,
    });

    const fullCsv = [...headerRows.map((r) => r.join(",")), csv].join("\n");

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8" });
    saveAs(
      blob,
      `Breakdown-${selectedEmployee.name}_${selectedEmployee.empId}_${rangeLabel}.csv`
    );
  };

  return (
    <div className="bg-white h-auto text-black p-6 rounded shadow space-y-6">
      <h1 className="text-xl font-bold">Reports</h1>

      {/* Data Source */}
      <div className="flex gap-4">
        {/* <button
          onClick={loadFromFirebase}
          className={`px-4 py-2 rounded ${
            mode === "firebase" ? "bg-blue-700 text-white" : "bg-blue-100"
          }`}
        >
          Load from Firebase
        </button> */}
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

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Export Attendance CSV
        </button>

        <button
          onClick={exportAdjustedCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Export Adjusted CSV
        </button>

        <button
          onClick={exportPayrollCSV}
          className="px-4 py-2 bg-yellow-600 text-white rounded"
        >
          Export Payroll CSV
        </button>

        <button
          onClick={exportPDF}
          className="px-4 py-2 bg-purple-600 text-white rounded"
        >
          Export Attendance PDF
        </button>
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
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="p-2 border rounded"
        />
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Generate Report
        </button>
      </div>
      {summary.length === 0 && (
        <p className="text-sm text-gray-500">
          No summary yet. Upload a CSV and click Generate.
        </p>
      )}

      {/* Summary Table */}
      {summary.length > 0 && (
        <>
          <p className="text-sm mt-2">
            Showing report for: <b>{dateRange.start || autoRange.start}</b> →{" "}
            <b>{dateRange.end || autoRange.end}</b>
          </p>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-orange-500">
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
                      Breakdown
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Drilldown Full-Screen */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-2">
              Daily Breakdown - {selectedEmployee.name} (
              {selectedEmployee.empId})
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
                {Object.entries(selectedEmployee.days).map(
                  ([date, punches], i) => {
                    punches.sort((a, b) => a - b);
                    let hours = "-";
                    let status = "OK";
                    if (punches.length % 2 !== 0) {
                      status = "Open Shift ⚠️";
                    } else {
                      hours = punches[punches.length - 1]
                        .diff(punches[0], "hours")
                        .hours.toFixed(2);
                    }
                    return (
                      <tr key={i}>
                        <td className="p-2 border">{date}</td>
                        {/* <td className="p-2 border">
                          {time}
                        </td> */}
                        <td className="p-2 border">{hours}</td>
                        {/* <td className="p-2 border">{status}</td> */}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>

            {/* ✅ Total Hours */}
            <p className="mt-3 text-sm font-semibold text-right">
              Total Hours:{" "}
              {Object.entries(selectedEmployee.days)
                .reduce((sum, [_, punches]) => {
                  punches.sort((a, b) => a - b);
                  if (punches.length % 2 === 0) {
                    const hrs = punches[punches.length - 1]
                      .diff(punches[0], "hours")
                      .hours.toFixed(2);
                    return sum + parseFloat(hrs);
                  }
                  return sum;
                }, 0)
                .toFixed(2)}
            </p>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={exportDrilldownPDF}
                className="px-4 py-2 bg-purple-600 text-white rounded"
              >
                Export PDF
              </button>
              <button
                onClick={exportDrilldownCSV}
                className="px-4 py-2 bg-yellow-600 text-white rounded"
              >
                Export CSV
              </button>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
